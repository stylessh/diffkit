# GitHub Cache Architecture

This document describes the GitHub caching and rate-limit architecture currently
implemented in the dashboard app.

The system is designed for three goals:

- Reduce repeated GitHub API calls.
- Keep cached GitHub data invalidated by durable server-side signals.
- Degrade gracefully when GitHub rate limits are low or exhausted.

## Components

### Browser cache

The browser keeps the fastest cache layer through React Query and persisted
query state. This layer is responsible for fast route transitions, reloads, and
recently visited views.

Browser cache is not the source of truth for invalidation. Server-side
revalidation signals decide whether cached GitHub data must be refreshed.

### D1 control plane

Cloudflare D1 stores durable app data and cache control state.

Relevant tables:

- `github_response_cache`: legacy durable response cache and migration fallback.
- `github_revalidation_signal`: timestamped invalidation signals written by
  webhook and mutation flows.
- `github_cache_namespace`: version rows used by the split KV cache.

The namespace table is created by:

```text
apps/dashboard/drizzle/0003_github_cache_namespace.sql
```

D1 remains authoritative for cache invalidation because it gives us durable,
consistent control records. KV is used for hot payloads, not for authoritative
invalidation state.

### KV payload cache

Cloudflare KV stores hot GitHub response payload envelopes when a resource opts
into `cacheMode: "split"`.

The binding is:

```text
GITHUB_CACHE_KV
```

It is configured in:

```text
apps/dashboard/wrangler.jsonc
```

Each KV entry stores the same envelope shape as the legacy D1 response cache:

- `payloadJson`
- `etag`
- `lastModified`
- `fetchedAt`
- `freshUntil`
- `rateLimitRemaining`
- `rateLimitReset`
- `statusCode`

Entries default to a 7 day KV TTL.

## Split Cache Read Flow

The central implementation is:

```text
apps/dashboard/src/lib/github-cache.ts
```

For a split-cache read:

1. Normalize the request params into stable JSON.
2. Resolve the namespace versions from D1.
3. Build a KV storage key from:
   - user id
   - resource name
   - params hash
   - namespace version hash
4. Read the KV payload entry.
5. If KV misses, read the legacy D1 cache entry as a fallback.
6. If the entry is fresh and no newer invalidation signal exists, return it.
7. If the entry is stale, call GitHub with conditional headers when available.
8. If GitHub returns `304`, refresh metadata and freshness without replacing
   the payload.
9. If GitHub returns `200`, write the new payload envelope.
10. Writes are mirrored to both KV and the legacy D1 response cache.

The legacy D1 cache is intentionally still written. It provides a safe fallback
while the split cache is rolled out and lets KV hydrate on misses.

## Cache Keys And Namespaces

There are two related but separate concepts:

- Cache key: identifies one resource plus one param set for one user.
- Namespace key: identifies the invalidation group for one or more cache keys.

Examples:

- `viewer`
- `repos.list`
- `pulls.mine`
- `issues.mine`
- `pull:{owner}/{repo}#{pullNumber}`
- `issue:{owner}/{repo}#{issueNumber}`
- `repoLabels:{owner}/{repo}`
- `repoCollaborators:{owner}/{repo}`
- `orgTeams:{org}`

Namespace helpers live in:

```text
apps/dashboard/src/lib/github-revalidation.ts
```

When a namespace is bumped, future reads build a different KV key. Old KV values
are not synchronously deleted. They expire naturally by TTL, which avoids delete
storms and avoids relying on immediate KV delete consistency.

## Invalidation Flow

Webhook and mutation invalidation is durable:

1. A webhook or mutation resolves affected signal keys.
2. `markGitHubRevalidationSignals()` writes the latest signal timestamp to D1.
3. The same signal keys are passed to `bumpGitHubCacheNamespaces()`.
4. Namespace rows are inserted or incremented in D1.
5. Future split-cache reads use the newer namespace version and bypass old KV
   entries.

This also handles offline users. If a user is not in the app when a webhook
arrives, the D1 signal and namespace version remain durable. When the user comes
back later, their next read observes the newer server-side state.

## Resources Currently On The Split Path

The first implemented split-cache coverage includes:

- Authenticated viewer.
- Authenticated user repo list.
- My pull request dashboard result, fetched through installation-scoped GraphQL
  searches for installed owners plus a guarded OAuth fallback.
- My issue dashboard result, fetched through installation-scoped GraphQL searches
  for installed owners plus a guarded OAuth fallback.
- Pull detail data.
- Pull page data, with detail, first/last comments, and commits bundled through
  a repo-scoped GraphQL query plus timeline fallback reads.
- Pull comments.
- Pull commits.
- Pull status.
- Pull files pages.
- Pull file summaries.
- Pull review comments.
- Issue detail data.
- Issue page data, with detail and first/last comments bundled through a
  repo-scoped GraphQL query plus timeline fallback reads.
- Issue comments.
- Repo collaborators.
- Org teams.
- Repo labels.
- Repository overview metadata.
- Repository branches.
- Repository tree listings.
- Repository file contents.
- Repository contributors.
- Repository discussions.

Most resource opt-ins are in:

```text
apps/dashboard/src/lib/github.functions.ts
```

Repository overview also uses a single GraphQL repository query for metadata,
counts, topics, and the latest default-branch commit. This avoids the previous
multi-REST-call cold miss for the same screen.

The dashboard "my pulls" and "my issues" reads prefer GitHub App installation
tokens when the app is installed for an owner. The OAuth fallback excludes
organizations the viewer belongs to, so an OAuth-restricted organization cannot
make the whole aggregate search fail. Public repositories outside those
organizations are still discovered through the fallback.

Those dashboard aggregate searches have a hard request budget. Source discovery,
installation client setup, and each owner-scoped GraphQL search are bounded so a
slow GitHub/App-token path can be skipped and the server function can still
return partial cached/search results instead of hanging the Worker request.

Shared cached GitHub request helpers also wrap REST pagination, GraphQL calls,
and composed reads in operation deadlines. Route loaders avoid blocking
navigation on GitHub data; they prefetch and let React Query show cached data or
the normal loading state. The Worker config enables
`no_handle_cross_request_promise_resolution` to avoid cross-request promise
resolution behavior in the runtime.

## Rate-Limit Behavior

There are two layers of rate-limit protection.

During development, the Octokit request policy logs a rate-limit snapshot for
each GitHub response under the `github-rate-limit` debug scope. The token label
is non-secret and identifies the bucket being used, for example
`oauth:user:{id}`, `app-user:{id}`, or `installation:{id}`. The log includes the
method, URL, status, rate-limit resource, limit, used count, remaining count, and
reset time.

### Cache-level stale fallback

`github-cache.ts` tracks GitHub response metadata, including remaining quota and
reset time.

When GitHub budget gets low:

- remaining quota at or below `100` extends freshness to at least 2 minutes.
- remaining quota at or below `25` extends freshness to at least 5 minutes or
  until just after reset, whichever is longer.

When GitHub returns a primary or secondary rate-limit style error and a cached
payload exists:

- the cached payload is served instead of failing the request.
- `freshUntil` is extended using `retry-after`, `x-ratelimit-reset`, or a
  fallback 60 second window.
- the status code is persisted for observability.

This is stale-if-rate-limited behavior. It prioritizes keeping the app usable
over forcing a live GitHub refresh during quota pressure.

### Octokit-level throttling and retry

The Octokit client factory lives in:

```text
apps/dashboard/src/lib/github.server.ts
```

It enables Octokit's retry and throttling plugins with these rules:

- Throttling is grouped by user with `github-user:{userId}`.
- Safe read methods, `GET`, `HEAD`, and `OPTIONS`, get up to 2 transient
  retries.
- Non-idempotent writes get 0 automatic retries to avoid replaying mutations.
- Primary and secondary rate-limit callbacks retry safe reads at most once.
- Writes are throttled and logged, but not automatically replayed.

This keeps read paths resilient while avoiding duplicated side effects from
`POST`, `PATCH`, or `DELETE` requests.

### GitHub App installation token cache

Installation clients do not mint a new GitHub App installation token for every
read. The server caches installation tokens per `installationId` in memory and,
when available, in `GITHUB_CACHE_KV`. Cached tokens are reused until five
minutes before GitHub's `expiresAt` timestamp, and concurrent misses for the
same installation share one in-flight token mint.

Webhook delivery invalidates the cached token for installation access changes:

- `installation`
- `installation_repositories`
- `github_app_authorization`

This keeps normal PR and issue reads on the larger installation rate-limit
bucket without continuing to use a token after app permissions or selected
repositories change.

## Client Refresh

The browser does not poll GitHub revalidation signals and does not sweep open
tabs to preload or refetch their routes. Webhook handlers and mutation handlers
update the durable server-side invalidation state; subsequent navigation,
explicit hover/focus prefetch, or normal query reads observe that state through
the server cache.

PR detail, issue detail, and PR review routes also run a one-shot client signal
check after their page query has data. This preserves the fast path where cached
React Query data renders immediately, then asks the server for the relevant D1
webhook signal timestamp once. If that signal is newer than the active query's
cached data, only that active query is invalidated and refetched.

```text
apps/dashboard/src/lib/use-github-signal-refresh.ts
```

Tab prefetching is intentionally user-driven. Detail tabs call route preload on
hover, focus, or touch start only:

```text
apps/dashboard/src/components/layouts/dashboard-tabs.tsx
```

This keeps cached tab switches fast without turning every open tab into a
background GitHub refresh source.

## Operational Requirements

Before this architecture is active in an environment:

1. The `GITHUB_CACHE_KV` binding must exist in Wrangler.
2. The `github_cache_namespace` D1 migration must be applied.
3. Existing legacy D1 cache entries can remain in place.

`GITHUB_CACHE_KV` stores GitHub payload cache entries and short-lived GitHub App
installation tokens. Installation token entries expire before the token itself
enters its refresh window.

Migration commands:

```sh
pnpm --filter @diffkit/dashboard migrate:local
pnpm --filter @diffkit/dashboard migrate:remote
```

If the KV binding is unavailable, the payload cache layer falls back to legacy
D1 behavior, and installation token reuse is limited to the current Worker
isolate's memory cache.

## Testing Coverage

The focused tests cover:

- fresh legacy cache reads.
- conditional `304` refresh.
- request-scoped stale refresh deduplication.
- split-cache KV hits.
- KV hydration from legacy D1.
- adaptive freshness when GitHub quota is low.
- stale serving when GitHub is rate limited.
- Octokit throttling and safe-method retry policy.
- GitHub App installation token reuse and webhook invalidation.

Relevant test files:

```text
apps/dashboard/src/lib/github-cache.test.ts
apps/dashboard/src/lib/github-cache-invalidation.test.ts
apps/dashboard/src/lib/github.server.test.ts
```

## Known Limitations

- Split-cache writes still mirror payloads to legacy D1, so D1 cache churn is
  reduced but not eliminated yet.
- In-flight deduplication is request-scoped, not cross-request or cross-worker.
- Installation token in-flight deduplication is per worker isolate. The KV entry
  prevents most cross-isolate remints after the first token is stored.
- Repository tree listings intentionally avoid per-entry commit lookups because
  that pattern can turn one directory view into dozens of GitHub API calls.
- Realtime client updates are not pushed to the browser yet. Detail routes do a
  one-shot signal check on entry, but users who keep a page open indefinitely do
  not receive webhook updates until another read is triggered.
- KV is not the source of truth for invalidation.

## Future Work

Likely next steps:

- Remove or reduce legacy D1 payload mirroring after the split cache has run in
  production safely.
- Add cross-request coalescing for hot GitHub reads.
- Add metrics for KV hit rate, D1 fallback rate, stale-if-rate-limited events,
  and GitHub quota pressure.
- Add push-based client notifications if live updates are needed without
  reintroducing browser polling.
