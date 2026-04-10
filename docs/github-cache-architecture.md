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
- `github_revalidation_signal`: timestamped invalidation signals used by
  webhook and client revalidation flows.
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
- My pull request dashboard slices.
- My issue dashboard slices.
- Pull detail data.
- Pull comments.
- Pull commits.
- Pull status.
- Pull files pages.
- Pull file summaries.
- Pull review comments.
- Issue detail data.
- Issue comments.
- Repo collaborators.
- Org teams.
- Repo labels.

Most resource opt-ins are in:

```text
apps/dashboard/src/lib/github.functions.ts
```

## Rate-Limit Behavior

There are two layers of rate-limit protection.

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

## PR Status Refresh

The pull detail page no longer polls PR status every 15 seconds.

Status fetching is owned by the merge status section in:

```text
apps/dashboard/src/components/pulls/detail/pull-detail-activity.tsx
```

It still refreshes on window focus, but it avoids constant background polling.
Webhook invalidation and server cache freshness now carry more of the load.

## Operational Requirements

Before this architecture is active in an environment:

1. The `GITHUB_CACHE_KV` binding must exist in Wrangler.
2. The `github_cache_namespace` D1 migration must be applied.
3. Existing legacy D1 cache entries can remain in place.

Migration commands:

```sh
pnpm --filter @diffkit/dashboard migrate:local
pnpm --filter @diffkit/dashboard migrate:remote
```

If the KV binding is unavailable, the cache layer falls back to legacy D1
behavior.

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
- Realtime client updates still depend on the existing client revalidation
  model rather than server push.
- KV is used for payloads only. It should not become the source of truth for
  invalidation.

## Future Work

Likely next steps:

- Remove or reduce legacy D1 payload mirroring after the split cache has run in
  production safely.
- Add cross-request coalescing for hot GitHub reads.
- Add metrics for KV hit rate, D1 fallback rate, stale-if-rate-limited events,
  and GitHub quota pressure.
- Move more realtime behavior toward push-based delivery if 10 second
  revalidation polling becomes too noisy.
