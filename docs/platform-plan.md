# Platform Plan

## Incidents

### 2026-11-08: Sign-in and dashboard down (D1 database full)

**Impact.** New GitHub sign-ins have failed since about 2026-08-17: the last
`session` row was created then, though existing sessions kept refreshing. On
2026-11-08, after #189 shipped, the signed-in dashboard also failed on most
page loads. Every GitHub webhook delivery returned 500.

**Root cause.** The production D1 database (`quickhub-db`) reached Cloudflare's
10 GB per-database limit. SQLite reported 9,999,998,976 bytes. Inserts failed;
in-place updates kept working, which is why existing sessions survived. The
space went to cache and revalidation bookkeeping that was never pruned:

| Table | Rows | Approx. size |
| --- | --- | --- |
| `github_webhook_event` | 32.3M | ~8 GB (one row per delivery, never deleted) |
| `github_revalidation_signal` | 6.0M | — |
| `github_cache_namespace` | 6.0M | — |
| `github_response_cache` | 73k | ~0.6 GB of payloads |

- Sign-in failed because the OAuth callback could not insert verification,
  account or session rows.
- The dashboard broke with #189. It replaced
  `getGitHubResourceLocalFirst`, which served the cached payload and ran the
  refresh and D1 write in the background with errors swallowed. Every read
  then awaited the D1 write on the request path, so each cache write failure
  became a page error.

**Detection.** `wrangler tail` showed every `/api/webhooks/github` request
failing with `Failed query: insert into "github_webhook_event" …`.
`wrangler d1 info` reported `database_size: 10 GB`. Nothing alerted. The full
database went unnoticed for about 11 weeks.

**Mitigation.**
1. Dropped `github_response_cache` (owner).
2. Recreated it empty so the deployed bundle kept working.
3. Purged the other cache tables in throttled batches. 50k-row deletes tripped
   D1's 7429 "too many resources in a 10 second window" error and slowed live
   queries, and 500k-row deletes hit the per-query time limit. A 20k-row batch
   with a 4 s pause stayed clear of both.

**Fix (hotfix PR).** Removed the server-side GitHub cache and webhook
revalidation entirely:
- `getOrRevalidateGitHubResource` now calls GitHub directly, with request-scoped
  de-duplication only.
- Bust, bump and mark helpers are no-ops.
- The webhook route only verifies signatures and invalidates installation
  tokens.
- The four tables were removed from the Drizzle schema.

A follow-up migration drops the tables once the purge finishes; dropping an
8 GB table in one statement would block the deploy pipeline.

**Follow-ups.**
- Design a replacement data-fetching and caching strategy. Requirements: bounded
  storage with TTL or pruning built in from day one; no storage writes on the
  request path, or failures that degrade to "no cache"; a size and growth
  metric with an alert.
- Remove the inert cache-era call-site options (`signalKeys`, `namespaceKeys`,
  `cacheMode`, `freshForMs`, bust and bump calls) in `github.functions.ts` as
  part of that rewrite. Done in phase 3 (data-fetching.md, "Phase 3 decisions").
- Watch GitHub rate limits. Client polling (`github-refetch-policy.ts`) now hits
  GitHub on every interval, and ETag 304s, which GitHub does not count against
  the limit, are gone. Audited in phase 3; the open items are listed in
  data-fetching.md, "Rate-limit exposure after phase 3".
- Add a D1 size alert, at 80% of the limit, for any database the dashboard
  uses. Done for the dashboard database in the change-feed PR: the cron logs
  `d1_size_warning`; see data-fetching.md, "Monitoring and alerting".
