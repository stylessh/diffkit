# Data Fetching, Caching and Revalidation

Status: **phases 1–3 implemented** (L1 client cache, L2 change feed,
call-site cleanup); phase 4 proposed.
Replaces the server cache removed in #193; see
[platform-plan.md, Incidents](./platform-plan.md#incidents).

## Goal

The dashboard should feel like Linear:

- **Instant paint.** Anything you have seen before renders from cache on the
  first frame, with no skeletons or spinners.
- **Background revalidation.** Fresh data replaces cached data in place.
- **Targeted refetches.** When GitHub tells us something changed, only the
  affected queries refetch.
- **Skeletons only for data we have never had**, and even then prefetching on
  hover/intent should usually win the race.

## Why not a sync engine

Linear owns its database and streams a replicated object graph to every client.
None of that holds for a GitHub client:

- **No write authority.** GitHub is the source of truth. We can't subscribe to
  its database, only receive webhooks, and only for repos where the GitHub App is
  installed. OAuth-only repos send us nothing.
- **Unbounded, per-user data.** Every user sees a different, permissioned slice
  of GitHub. There is no shared graph to replicate, and syncing it would mean
  storing other people's private data we don't need.
- **Every read costs rate limit.** That's 5,000 REST requests and 5,000 GraphQL
  points per user per hour. A sync engine's "fetch everything up front" model
  burns the limit.

So we want the *experience* of a sync engine, local data first and pushes for
freshness, built on stale-while-revalidate plus change hints.

## Where the skeletons come from today

Measured on `main` at 232e626:

| Cause | Where | Effect |
| --- | --- | --- |
| `defaultPendingMs: 0` | `src/router.tsx` | The pending component (skeleton) shows on the first frame of any loader wait, even a 30 ms one. |
| Loaders `await` a server function to read a cookie | `pulls`, `issues`, `reviews`, `repos` (`getFilterCookie`) | A network round trip on every navigation, during which the skeleton shows, **even when the query data is already cached**. |
| `_protected.beforeLoad` awaits `getSession()` + `checkSetupComplete()` | `src/routes/_protected.tsx` | A blocking round trip before anything renders on every cold load. |
| Partial client persistence | `src/lib/query-client.tsx` | 21 of 59 query types persist, to localStorage, which has a ~5 MB quota and is serialized synchronously. Open-tab data is pruned when the tab closes. Everything else starts empty after a reload. |
| `ssr: false` | 30 of 40 routes | The server never contributes data to first paint. This is fine **if** the client cache is warm (see L1). |

The data layer itself (React Query + `githubQueryKeys`) is a good foundation.
Most of the work is removing blocking waits and persisting more, better.

## Design: three layers

### L1: Client cache (the fast path)

The client cache is what makes the UI instant. The server is never on the
critical path for data the user has already seen.

1. **Persist every GitHub query to IndexedDB**, not localStorage. Use the async
   persister (`@tanstack/query-async-storage-persister` + `idb-keyval`), with one
   database per user ID so accounts on a shared browser never mix.
   - Budget of about 50 MB, with least-recently-used eviction by `dataUpdatedAt`.
   - The cache buster is the app's query-schema version; bump it when a payload
     shape changes, as #191 did with `pulls.repo.v2`.
   - Wipe the cache on sign-out.
   - Large blobs stay opt-out, as they are now: PR patches and file contents.
2. **Restore before first render.** `PersistQueryClientProvider` gates rendering
   on `isRestoring`, typically 10–50 ms from IndexedDB. During restore we render
   the app shell (nav, layout) but **not** a skeleton, so it reads as "loaded",
   not "loading".
3. **Never block a route on data.** Loaders call
   `prefetchQuery`/`ensureQueryData` without `await`. Components read the cache
   with `useQuery`, which also refetches in the background when the data is
   stale.
   - Set `defaultPendingMs` to about 300 ms with `pendingMinMs` around 200 ms,
     so a skeleton can only appear for genuinely slow, uncached loads, and never
     flashes.
   - Read the filter cookie on the client (`document.cookie`) instead of through
     a server function.
4. **Seed details from lists.** When opening a PR or issue from a list, set the
   detail query's `placeholderData` from the list row (title, state, author,
   labels). The header renders immediately and the body streams in.
5. **Optimistic auth.** Persist the last known viewer and session summary. On a
   cold load, render the dashboard from the persisted viewer while
   `getSession()` validates in the background. If it fails, redirect to
   `/login` and clear the cache. This removes the blocking `beforeLoad` round
   trip for returning users.
6. **Keep prefetch-on-intent** (`defaultPreload: "intent"`). It already exists
   and becomes far cheaper once loaders don't block.

### L2: Revalidation via a change feed

The aim is to replace "every query polls GitHub on its own" with "one cheap
request tells the client what changed".

```
GitHub webhook ──► /api/webhooks/github ──► github_change (D1, 15 min TTL)
                                                  │
client (visible tab) ── every 15 s + on focus ──► /api/changes?since=<cursor>
        │                                          returns entity keys for
        ▼                                          repos the user can access
queryClient.invalidateQueries(keysFor(entity))   → only active, affected
                                                   queries refetch
```

- **Entity keys** describe what changed, e.g. `pull:owner/repo#12`,
  `issue:owner/repo#4`, `repo:owner/repo`, `checks:owner/repo@sha`. The webhook
  handler maps events to keys; the old `getGitHubWebhookRevalidationSignalKeys`
  mapping in git history is a starting point.
- **Keys to queries.** One registry in `github.query.ts` maps an entity key to
  the `githubQueryKeys` prefixes it affects. Mutations use the same registry for
  optimistic updates and targeted invalidation, replacing the scattered
  `bustGitHubCache` and `bumpGitHubCacheNamespaces` calls.
- **Access control.** `/api/changes` must only return keys for repos the viewer
  can read, otherwise it leaks activity in private repos. The client sends the
  repo set it is watching, which comes from its active queries, and the server
  intersects that with the user's installation repo access. The server already
  computes that access as `installationAccess`.
- **Storage is bounded by design.**
  - `github_change(id, repo, entity_key, changed_at)` with an index on
    `(repo, id)`.
  - Rows older than 15 minutes are useless, so a cron trigger deletes them in
    batches.
  - At the current ~50k deliveries a day, the table holds about 500 rows.
  - A client that has been away longer than 15 minutes gets a "cursor expired"
    response and refetches its active queries on focus.
- **Polling is kept only for things that change without a webhook we receive.**
  - Running CI is covered by the existing adaptive intervals in
    `github-refetch-policy.ts`, which stop once runs are terminal.
  - OAuth-only repos fall back to refetch on focus plus `staleTime`.
  - Fixed 20–30 s polling on lists and details goes away.

### L3: Server cache (optional; for rate limits, not speed)

L1 makes the UI fast. A server cache is only worth adding if rate limits become
a problem. If it is added, it follows these rules, which are the lessons of the
incident:

- **Conditional requests.** Store `{etag, payload}` per user and resource, and
  send `If-None-Match` on every read. A 304 is served from storage and doesn't
  count against GitHub's rate limit.
- **No invalidation signals.** Freshness comes from always revalidating with
  the ETag, so there are no signal or namespace tables, and nothing keyed per
  entity grows forever. GraphQL has no ETags, so GraphQL resources such as
  "my pulls" are not cached server-side; L1 and L2 cover them.
- **KV with `expirationTtl`.** Entries expire after 7 days of disuse, so cleanup
  is automatic. Write only on a 200, never on a 304.
- **Writes in `waitUntil`, never awaited on the request path.** A failed read or
  write means a cache miss, never an error.

### Cleanup and guardrails (all layers)

- **Expiry and sweeping are part of every design.** Any new table or KV prefix
  ships with a TTL or retention rule and a sweeper, in the same PR.
- **No append-only logs in D1.** Webhook de-duplication, if needed, is a KV key
  with a 24-hour TTL.
- **Storage failure means a cache miss.** No storage read or write may turn into
  a user-facing error.
- **Monitoring.** A scheduled check alerts at 80% of D1's 10 GB limit and on
  unusual row growth. The incident went unnoticed for about 11 weeks.

## Phases

1. **Instant UI (client only).** Covers L1 items 1–6: the IndexedDB persister,
   non-blocking loaders, `pendingMs`, the client-side filter cookie, list→detail
   seeding and optimistic auth. This is the biggest UX win and needs no server
   storage.
2. **Change feed.** Covers L2: `github_change` with its cron sweeper,
   `/api/changes`, the entity→query registry, mutation invalidation through the
   registry, and removing fixed polling. Also adds the migration that drops the
   four legacy cache tables, once the production purge from the incident is done.
3. **Call-site cleanup.** Delete the inert cache-era options (`signalKeys`,
   `namespaceKeys`, `cacheMode`, `freshForMs`, bust and bump calls) from
   `github.functions.ts`, and rename `getOrRevalidateGitHubResource`.
4. **Server ETag cache (only if needed).** Covers L3, prompted by rate-limit
   metrics after phase 2.

## Phase 1 decisions

- **Storage shape.** One IndexedDB record per query (`src/lib/query-persister.ts`)
  instead of `@tanstack/query-async-storage-persister`, whose storage contract
  is one string holding the whole cache. A save only writes queries whose
  `dataUpdatedAt` changed, and disk retention is independent of in-memory
  `gcTime`.
- **Budget.** 50 MB per user, least-recently-updated eviction, 7-day max age,
  and no single entry above 10 MB. Open tabs get no special priority; a
  viewed query refetches on view, which makes it the newest entry anyway.
- **Restore timing.** `src/client.tsx` restores into the browser query
  client before `hydrateRoot`, capped at 400 ms, while the server-rendered
  shell stays on screen. `PersistQueryClientProvider` restores after first
  render, which would let client-only loaders fetch against an empty cache.
- **Optimistic auth window.** Indefinite while `getSession()` is in flight, as
  proposed. The viewer hint is a cookie, so the server render uses it too,
  and it expires with the session (capped at 30 days). Network errors keep
  the optimistic render; a missing session wipes the cache and
  hard-redirects to `/login`.
- **Hydration.** TanStack Router holds server-rendered pending matches for
  `pendingMinMs` after hydration (500 ms by default). The first load uses
  0 ms; later navigations use 200 ms.

## Phase 2 decisions

- **Entity keys** live in `src/lib/github-change-entities.ts` (shared by
  the webhook handler and the client). The registry that maps them to queries
  is `githubQueryEntityCoverage` / `githubQueryMatchesEntity` in
  `src/lib/github/query-registry.ts`, re-exported from `github.query.ts`; a test
  fails when a `githubQueryKeys` group is neither covered nor marked
  `"exempt"`.
- **Aggregates.** "My pulls/issues", user lists, repo lists and the inbox
  refetch only when the changed item is already in their cached payload, so
  one PR event in a busy org doesn't become a GitHub search request for every
  member. New items arrive on focus or `staleTime`, except items the viewer
  just created: mutations pass `change: "created"`.
- **Access.** `/api/changes` returns public-repo changes to anyone and
  private-repo changes only for repos the *user* can read through the GitHub
  App: `GET /user/installations/{id}/repositories`, not the installation's
  "all repos" coverage. Cached per user for 60 s in memory and 10 min in KV
  (`change-access:v1:`, `expirationTtl`). OAuth-only repos refresh on focus.
- **Cursor** is `<last id>.<issued at>`; `github_change.id` is
  AUTOINCREMENT, so ids never go backwards when the table empties. A cursor
  older than 14 minutes, or more than 2,000 rows behind, answers
  `expired: true`. A D1 read failure answers "nothing changed" with the
  client's own cursor, so an outage can't trigger a refetch storm.
- **Cadence.** 15 s while visible, plus focus and reconnect. SSE stays out:
  it would mean one held connection per tab again.
- **No delivery de-duplication.** A redelivered webhook only invalidates the
  same queries twice within one poll; a KV key per delivery would cost
  ~50k KV writes a day for nothing.
- **Sweeper.** A cron trigger every 5 minutes deletes rows older than 15
  minutes in batches of at most 20k with 4 s pauses (at most 10 batches per
  run).

## Phase 3 decisions

- **Module layout.** `github.functions.ts` and `github.query.ts` are barrels
  over `src/lib/github/`. Modules that define server functions export only
  server functions, types and client-safe helpers: TanStack Start strips
  handler bodies from client and SSR-caller builds, but an exported helper
  survives and pulls its server-only imports (`cloudflare:workers`, D1) into
  those builds. Shared server code lives in helper modules (`client`,
  `installations`, `mappers`, `shared`, `my-search`, `timeline`,
  `permissions`) that are imported only from handler bodies. `validators.ts`
  stays dependency-free because `.inputValidator(...)` runs in the caller.
- **Reads.** `getOrRevalidateGitHubResource` became `dedupeGitHubRead`
  (`github/request-dedup.ts`): identical reads within one server request
  share a call, and nothing outlives the request. Fetchers return data. The
  `GitHubFetchResult` / `"not-modified"` union and the response metadata are
  gone: no conditional headers were sent, and nothing read the metadata.
- **Mutations** invalidate through `invalidateGitHubEntities`
  (`github-query-updates.ts`) with the same entity keys the webhook would
  produce. None invalidates every GitHub query any more.
- **No `notifications` entity.** It fired on every PR, issue, review and
  release event, and each inbox refetch costs up to ~150 REST calls (see
  below). The inbox is an aggregate instead: it refetches only for items it
  already lists.

### Rate-limit exposure after phase 3

With polling gone, these are the remaining bursts. Fixed in phase 3:

| Pattern | Before | After |
| --- | --- | --- |
| Inbox refetch on every PR/issue event in a readable repo | ≤150 REST calls per 15 s poll | only when a listed item changes |
| PR status, CI running | ~7 REST calls every 5 s (~5,000/h per tab) | every 10 s |
| PR status, checks finished | ~7 REST calls every 30 s, forever (closed PRs too) | stops after 10 min unchanged |
| Comment, review, close/reopen mutations | refetched every active GitHub query | refetch the item's queries |

Still open:

- **Inbox enrichment** (`getNotifications`): subject, comments and reviews per
  notification, up to 50 notifications, so ≤150 calls per load. One aliased
  GraphQL query (`issueOrPullRequest { state participants }`) would make it
  one call, but the emulator's GraphQL shim needs those fields first.
- **Org-team reviewer picker** (`getOrgTeams`): one access check per org team.
  `GET /repos/{owner}/{repo}/teams` is one call but needs Administration: read
  and omits implicit-access teams on public repos.
- **"My pulls/issues"**: one 5-alias GraphQL search per installation source,
  bounded by an 18 s deadline; cost grows with installations.
- **Participation stats**: up to 6 calls 1.5 s apart while GitHub computes
  them (202).
- **Hover preload** of PR rows: one page-data GraphQL call per hovered row,
  once per row.
- **Branches page**: one compare call per visible row (5 min `staleTime`).
- **Live job logs**: every 4 s while the job runs and its page is open.

## Monitoring and alerting

The cron (`src/lib/scheduled-maintenance.server.ts`) logs one JSON line per
run:

```json
{"task":"scheduled-maintenance","sweep":{"deleted":412,"batches":1,"complete":true},
 "d1SizeBytes":81920,"d1SizeRatio":0.0000082,"changeRows":37}
```

Database size comes from D1's `meta.size_after`, the number
`wrangler d1 info` reports. At 80% of the 10 GB limit, or when
`github_change` exceeds 50k rows (a stuck sweeper), it also logs
`{"level":"warn","alert":"d1_size_warning" | "d1_change_table_growth", …}`.

To alert:

1. In the Cloudflare dashboard, open the Worker → **Observability**, filter
   on `alert = d1_size_warning OR alert = d1_change_table_growth`, and save
   the query as an alert. Notify on any match in 15 minutes.
2. Or, with Logpush, push Workers trace events and alert on the same field.
3. Also add a **Notifications → D1** usage alert for the database as a second
   signal that doesn't depend on the Worker running.

`sweep.complete: false` on consecutive runs means the backlog is outgrowing
10 × 20k rows per 5 minutes; raise `GITHUB_CHANGE_SWEEP_MAX_BATCHES`.

## Open questions

- **IndexedDB budget and eviction.** Is 50 MB per user right? Should open tabs
  get priority over least-recently-used eviction?
- **Change-feed cadence.** Is 15 s while visible fast enough, or do we want SSE
  for the visible tab later? SSE would mean holding a connection per tab, which
  is what the removed SignalRelay did.
- **Optimistic auth window.** How long may we render from a persisted viewer
  before `getSession()` confirms? Proposal: indefinitely while it's in flight,
  then hard-redirect on 401.
