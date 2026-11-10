# Runbook: D1 database full or filling up

Production D1 is `quickhub-db`, bound as `DB` in the `diffkit` Worker.
Cloudflare caps one D1 database at **10 GB**. On 2026-11-08 it hit the cap
after 11 weeks of unpruned cache tables, and nothing alerted (see
[platform-plan.md → Incidents](../platform-plan.md#incidents)).

## Symptoms

At the cap, **inserts fail and in-place updates keep working**. That pattern
is the tell:

- New GitHub sign-ins fail: the OAuth callback cannot insert `verification`,
  `account` or `session` rows. People who are already signed in stay signed in,
  because session refreshes are updates.
- `POST /api/webhooks/github` returns 500. `wrangler tail` shows
  `Failed query: insert into …`.
- Any code that awaits a D1 write on the request path turns the failure into a
  page error (that is how #189 took the dashboard down).

## Alerts that should have fired

| Signal | Where | Fires at |
| --- | --- | --- |
| GitHub issue **"Production alert: D1 database above 8 GB"** | [`production-alerts.yml`](../../.github/workflows/production-alerts.yml), every 15 min, reads the D1 API (`file_size`), so it works even when the Worker is down | 8 GB |
| `{"alert":"d1_size_warning"}` log line | Worker cron (`scheduled-maintenance.server.ts`), every 5 min | 80% (8 GB) |
| `{"alert":"d1_change_table_growth"}` log line | same | `github_change` > 50k rows (sweeper stuck) |
| GitHub issue **"Production alert: scheduled maintenance cron is not running cleanly"** | watchdog, via `/api/health` → `maintenance` | no clean cron run in 12 min |

Open alert issues: <https://github.com/stylessh/diffkit/issues?q=is%3Aopen+label%3Aproduction-alert>.

## 1. Measure

From `apps/dashboard`, logged in with `pnpm exec wrangler login`:

```sh
pnpm exec wrangler d1 info quickhub-db                        # database_size, num_tables
curl -s https://diff-kit.com/api/health | jq .checks.d1       # sizeBytes as seen by the Worker

# Row counts per table. List tables first, then count the suspects.
pnpm exec wrangler d1 execute quickhub-db --remote --command \
  "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
pnpm exec wrangler d1 execute quickhub-db --remote --command \
  "SELECT (SELECT COUNT(*) FROM github_change) AS github_change,
          (SELECT COUNT(*) FROM session) AS session,
          (SELECT COUNT(*) FROM verification) AS verification"
```

A `COUNT(*)` over tens of millions of rows is slow and counts toward D1's
per-query limits, so run counts one table at a time.

Expected steady state: `github_change` stays in the low thousands (one row
per entity changed in the last 15 minutes).

## 2. Stop the growth

Find the writer before you delete anything, or the purge loses the race.

- A table with no pruning: ship a fix that stops the writes or adds a TTL and
  sweeper. Every store needs one (docs/data-fetching.md).
- `github_change` growing: the cron sweeper is not running or not keeping up.
  Check the cron alert issue. In Workers → `diffkit` → Logs, search
  `"task":"scheduled-maintenance"`. `sweep.complete: false` on consecutive runs
  means the backlog is outgrowing 10 × 20k rows per 5 minutes: raise
  `GITHUB_CHANGE_SWEEP_MAX_BATCHES` in `github-change.server.ts`.

## 3. Purge a large table

Delete in **20,000-row batches with a 4-second pause**. These are the numbers
that worked on 2026-11-08:

- 50k-row batches tripped D1 error **7429** ("too many resources in a 10
  second window") and slowed live queries.
- 500k-row batches hit the per-query time limit.

```sh
TABLE=github_webhook_event   # the table to purge
WHERE="1 = 1"                # or e.g. "received_at < 1790000000000"
BATCH=20000

while true; do
  out=$(pnpm exec wrangler d1 execute quickhub-db --remote --json --command \
    "DELETE FROM $TABLE WHERE rowid IN (SELECT rowid FROM $TABLE WHERE $WHERE LIMIT $BATCH)" 2>&1)
  if echo "$out" | grep -q 7429; then
    echo "$(date -u +%T) 7429: backing off 30s"; sleep 30; continue
  fi
  changes=$(echo "$out" | jq -r '.[0].meta.changes' 2>/dev/null)
  if [ -z "$changes" ] || [ "$changes" = "null" ]; then
    echo "$out"; break        # an error that is not 7429: stop and read it
  fi
  echo "$(date -u +%T) deleted $changes"
  [ "$changes" -lt "$BATCH" ] && break
  sleep 4
done
```

On a 7429, back off and retry the same batch. If 7429s keep coming at 20k,
halve `BATCH`, because live traffic is using the headroom. Tens of millions of
rows take hours, so run the loop in `tmux` or `nohup`.

Check progress with `wrangler d1 info quickhub-db`. The reported size goes down
as rows are deleted (on 2026-11-08: 10 GB → 8.34 GB → 7.99 GB during the
purge).

### Dropping the table afterwards

Drop a table only once it is empty, or nearly so. The drop is a migration, and
deploys apply migrations before shipping the Worker (5-minute timeout,
[deploy-rollback.md](./deploy-rollback.md#migration-timed-out)). Dropping a
multi-GB table in one statement blocks the deploy pipeline. A migration PR
with `DROP TABLE` needs a `migration-destructive: approved` line in its body to
pass the **D1 migrations** check.

The incident's emergency fix (owner, 2026-11-08) was to drop
`github_response_cache` by hand, then recreate it empty so the deployed bundle
kept working. Only do this for a table that holds nothing you need. Recreate it
in the same session if the serving code still queries it.

## 4. If data was lost or damaged: Time Travel

D1 Time Travel restores the whole database to a minute in the last 30 days
(Workers Paid; 7 days on Free). A restore **discards every write after that
point**, including sign-ins and sessions, so it is a last resort, not a way to
free space.

```sh
# A bookmark for a point in time (read-only)
pnpm exec wrangler d1 time-travel info quickhub-db --timestamp 2026-11-08T05:00:00Z

# Each production deploy also prints one taken before migrations: see the
# deploy job summary, "D1 bookmark (pre-migration)".

# Restore (destructive). Wrangler prints the bookmark of the state it
# replaced; save it, because restoring to it undoes the restore.
pnpm exec wrangler d1 time-travel restore quickhub-db --bookmark <bookmark>
```

After a restore, check that the serving Worker version expects the restored
schema (`wrangler d1 migrations list quickhub-db --remote`). If it doesn't,
roll the Worker back ([deploy-rollback.md](./deploy-rollback.md)).

## 5. Afterwards

- Close the alert issue, or let the watchdog close it within 15 minutes of the
  size dropping below 8 GB.
- Add the cause to [platform-plan.md → Incidents](../platform-plan.md#incidents).
