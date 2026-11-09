# Runbook: production deploy and rollback

Production is the `diffkit` Worker on <https://diff-kit.com>, backed by the
`quickhub-db` D1 database. Every push to `main` that touches the dashboard runs
[`.github/workflows/dashboard-deploy-production.yml`](../../.github/workflows/dashboard-deploy-production.yml).
Deploys are serialized (`concurrency: dashboard-production`); a second merge
waits for the first deploy to finish.

## What a deploy does

The workflow checks that the production resource pins are set (see
[self-hosting.md](../self-hosting.md#existing-resources)), then runs
[`scripts/deploy-dashboard.mjs`](../../scripts/deploy-dashboard.mjs), which moves
through one phase at a time:

| Phase | What happened | If the job stops here |
| --- | --- | --- |
| `inspected` | Read the serving version id (the rollback target). | Nothing changed. Re-run the job. |
| `deployed` | `void deploy` saved a D1 Time Travel restore point, applied pending migrations, uploaded the Worker, checked `/__void/ready` and moved traffic to it. If `/__void/ready` fails, Void itself keeps the previous version serving. | New code serves, not yet verified. |
| `verified` | Within 2 minutes, `/login` (redirects followed) answered 200 and `/api/health` answered 200 **reporting the new version id**. | Done. |
| `rolled_back` | The gate failed, and `wrangler rollback` restored the previous version. The job fails. | Previous code serves. Investigate before you merge a fix. |
| `rollback_failed` | The gate failed and the rollback failed too. The job fails with a 🚨 headline. | Production may be broken. Roll back by hand (below). |
| `failed after <phase>` | A command threw. The phase it names is the last one that completed. | See that phase's row. |

The job summary (Actions → the run → Summary) shows the phase, the commit,
the previous and new version ids and the health-gate result. When migrations
ran, the `void deploy` log prints the restore point as a ready command:
`void db restore --bookmark=…`.

## Rolling back by hand

You need a Cloudflare login with Workers access (`pnpm exec wrangler login`).
Run these from `apps/dashboard`.

```sh
# 1. What is serving now, and what came before it?
pnpm exec wrangler deployments status --name diffkit
pnpm exec wrangler deployments list --name diffkit   # newest last; message = "<sha> <subject>"

# 2. Roll back to a known-good version id
pnpm exec wrangler rollback <version-id> --name diffkit --message "why" --yes

# 3. Confirm
curl -s https://diff-kit.com/api/health | jq '{status, version, checks}'
curl -sL -o /dev/null -w '%{http_code}\n' https://diff-kit.com/login   # expect 200
```

`/api/health` reports `version.id`. It is the version id from step 1 only for
versions deployed with the `CF_VERSION_METADATA` binding, which
`void.config.ts` declares. Older versions report `{"status":"unknown"}`.

A rollback restores code, bindings and vars of that version. It does **not**
undo D1 migrations, KV or R2 data. Write migrations that the previous version
can run against: add columns and tables first, remove them in a later deploy.

### Then stop the next deploy from re-shipping the bad commit

A rollback lasts until the next push to `main`. Revert the bad PR
(`gh pr revert <n>` or a revert commit) before you merge anything else.

## Deploying while D1 or KV is degraded

The gate requires `/api/health` to return 200, and it returns 503 when D1 or KV
fails. If the fix you need to ship is for that outage, the gate will roll the fix
back. Run the workflow by hand with the gate off:

```sh
gh workflow run dashboard-deploy-production.yml -R stylessh/diffkit -f health_gate=skip
```

The run ends in phase `unverified`. Check the site by hand afterwards.

## Migration failed or stalled

`void deploy` applies migrations before it uploads the Worker, so a failed
migration leaves the old code serving. A slow statement can still finish on
D1's side after the client gives up, so check what was applied:

```sh
pnpm exec wrangler d1 migrations list quickhub-db --remote
```

- **Listed as applied** (not under "Migrations to be applied"): re-run the
  deploy job. It skips the migration and deploys the code.
- **Still pending**: the statement is too slow for one request. Usually it is a
  `DROP TABLE` or a table rewrite on a big table. Shrink the table first with
  throttled deletes ([d1-full.md](./d1-full.md#purge-a-large-table)), then
  re-run.

Void also refuses a migration with a destructive statement unless the file
starts with `-- void:allow-destructive`.

PRs that add destructive migration statements (`DROP`, `ALTER … DROP COLUMN`,
`TRUNCATE`, or `DELETE` without `WHERE`) fail the **D1 migrations** check
unless the PR body has a line `migration-destructive: approved`. That check
also fails when a PR edits an already-applied migration (override:
`migration-edit: approved`), or when `src/db/schema.ts` and the migrations
disagree.

## Restoring D1 to the pre-deploy bookmark

Only do this when a migration damaged data. A restore rewinds **the whole
database**: every sign-in, session and change-feed row written after the
bookmark is lost.

```sh
# The bookmark is in the `void deploy` log of that run
pnpm exec wrangler d1 time-travel restore quickhub-db --bookmark <bookmark>
```

Wrangler prints the bookmark of the state it replaced. Save it, because it lets
you undo the restore with the same command. Roll the Worker back to the
version that matches the restored schema first, so code and schema agree.

To pick a point in time instead of a bookmark:

```sh
pnpm exec wrangler d1 time-travel info quickhub-db --timestamp 2026-11-08T05:00:00Z
```

Time Travel keeps 30 days on the Workers Paid plan (7 days on Free).
