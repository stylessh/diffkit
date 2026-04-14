# Contributing to DiffKit

Thanks for your interest in contributing to DiffKit! This guide will help you get started.

## Development Setup

Follow the [Getting Started](README.md#getting-started) section in the README to set up your local environment. You'll need both a GitHub OAuth App and a GitHub App configured.

For webhook testing during local development, use an ngrok tunnel (or similar) and set `DEV_TUNNEL_URL` in your `.dev.vars`.

## Project Architecture

DiffKit is a **pnpm monorepo** managed with **Turborepo**:

```
diffkit/
├── apps/
│   └── dashboard/          # Main web app (TanStack Start + Cloudflare Workers)
│       ├── src/
│       │   ├── components/ # App-specific React components
│       │   ├── db/         # Drizzle ORM schema and database access
│       │   ├── lib/        # Auth, GitHub API clients, caching, utilities
│       │   └── routes/     # File-based routes (TanStack Router)
│       │       ├── api/    # API routes (auth callbacks, webhooks)
│       │       └── _protected/ # Auth-gated routes
│       └── drizzle/        # SQL migration files
├── extensions/
│   └── diffkit-redirect/   # Browser extension (GitHub → DiffKit redirects)
├── packages/
│   ├── ui/                 # Shared UI components (Radix UI + Tailwind CSS)
│   ├── icons/              # Icon wrapper package
│   └── typescript-config/  # Shared TypeScript configurations
├── scripts/                # Migration runner and dev utilities
└── docs/                   # Architecture documentation
```

### Key Technologies

- **TanStack Start** — Full-stack React 19 framework on Cloudflare Workers
- **TanStack Router** — File-based routing in `apps/dashboard/src/routes/`
- **TanStack Query** — Server state management and caching
- **Drizzle ORM** — Database schema and migrations in `apps/dashboard/src/db/` and `apps/dashboard/drizzle/`
- **Better Auth** — Authentication with a GitHub OAuth App, plus GitHub App user and installation tokens for installed repos
- **Cloudflare D1** — SQLite database at the edge (auth data, cache control state)
- **Cloudflare KV** — Hot payload cache for GitHub API responses (`GITHUB_CACHE_KV` binding)
- **Cloudflare Durable Objects** — `SignalRelay` for real-time webhook-to-client revalidation over WebSocket
- **Vite** — Build tooling via `@cloudflare/vite-plugin`
- **Vitest** — Test framework (`pnpm --filter dashboard test`)
- **Biome** — Linting and formatting

### GitHub Integration

DiffKit uses a hybrid GitHub auth model:

- The **GitHub OAuth App** signs users in and powers broad user-context reads, including public or external repositories where the GitHub App is not installed.
- The **GitHub App user token** (`ghu_` prefix) powers installation discovery via `GET /user/installations`.
- The **GitHub App installation token** is preferred for repo-scoped reads and writes when the app is installed for that owner. Tokens are cached in KV (with in-memory fallback) and reused until five minutes before expiry.

Auth callbacks:
- OAuth App: `/api/auth/callback/github`
- GitHub App user authorization: `/api/github/app/callback`
- GitHub App setup URL: `/setup` (with **Redirect on update** enabled)

Environment variables are documented in `apps/dashboard/.dev.vars.example`. Do not commit real `.dev.vars` values or private keys. If a private key is exposed, revoke it in GitHub App settings and generate a replacement.

### Caching & Revalidation

DiffKit uses a split-cache architecture to minimize GitHub API calls while keeping data fresh. For a deep dive, see [`docs/github-cache-architecture.md`](docs/github-cache-architecture.md). Here's the overview:

**Split KV/D1 cache** — GitHub API responses are cached in Cloudflare KV for fast reads, with D1 as the authoritative control plane for invalidation state. Key files:

- `apps/dashboard/src/lib/github-cache.ts` — Core cache read/write logic
- `apps/dashboard/src/lib/github-revalidation.ts` — Signal key definitions and webhook-to-signal mapping
- `apps/dashboard/src/lib/github.functions.ts` — GitHub API operations with cache mode opt-ins

**Invalidation flow** — When a GitHub webhook arrives or a mutation runs:

1. Affected signal keys are resolved (e.g. `pull:{owner}/{repo}#{number}`, `pulls.mine`)
2. D1 revalidation signal timestamps and namespace versions are bumped
3. Future cache reads build a different KV key from the new namespace version, naturally bypassing stale entries
4. Connected clients are notified in real time via the `SignalRelay` Durable Object

**Real-time revalidation** — The `SignalRelay` Durable Object (`apps/dashboard/src/lib/signal-relay.server.ts`) maintains WebSocket connections per user. When the webhook handler broadcasts signal keys, subscribed clients receive them instantly. Detail routes use a one-shot signal check (`apps/dashboard/src/lib/use-github-signal-stream.ts`) to invalidate only the active query when a newer server-side signal exists.

**Rate-limit resilience** — The cache layer extends freshness when GitHub quota is low (≤100 remaining: 2-min floor; ≤25 remaining: 5-min floor or until reset). If GitHub returns a rate-limit error and a cached payload exists, the stale payload is served instead of failing.

### Webhook Handler

The webhook endpoint at `apps/dashboard/src/routes/api/webhooks/github.ts` verifies the HMAC-SHA256 signature, maps events to cache signal keys, writes invalidation state to D1, and broadcasts to connected WebSocket clients. Supported events include `pull_request`, `issues`, `issue_comment`, `check_run`, `check_suite`, `pull_request_review`, and more.

### Adding a New Route

Routes live in `apps/dashboard/src/routes/`. TanStack Router uses file-based routing — create a new file and the route is automatically registered.

Protected routes go under `_protected/` which enforces authentication.

### Adding a UI Component

Shared components go in `packages/ui/src/components/`. App-specific components go in `apps/dashboard/src/components/`.

### Database Migrations

Migration files live in `apps/dashboard/drizzle/`. To run migrations:

```bash
pnpm --filter dashboard migrate        # Local D1
pnpm --filter dashboard migrate:remote  # Remote D1
```

If you add a new table or column, create a new numbered SQL file in `apps/dashboard/drizzle/`.

## Workflow

1. **Fork the repo** and create your branch from `main`
2. **Make your changes** — keep commits focused and atomic
3. **Run checks** before pushing:
   ```bash
   pnpm check-types   # Type checking
   pnpm lint           # Linting
   pnpm format         # Formatting
   ```
4. **Run tests** if you touched caching or GitHub integration:
   ```bash
   pnpm --filter dashboard test
   ```
5. **Open a pull request** against `main`

## Code Style

This project uses [Biome](https://biomejs.dev/) for linting and formatting. Run `pnpm format` to auto-format your code. Pre-commit hooks via Husky and lint-staged will also catch issues before they're committed.

A few conventions:

- Prefer editing existing files over creating new ones
- Keep components in the appropriate package (`apps/dashboard` for app-specific, `packages/ui` for shared)
- Use `cn()` for composing class names (not template literals)
- Use `flex` + `gap` for spacing (not `space-x` / `space-y`)

## Pull Requests

- Keep PRs focused — one feature or fix per PR
- Write a clear title and description explaining what changed and why
- Include screenshots for UI changes
- Make sure all checks pass before requesting review

## Reporting Bugs

Open an [issue](https://github.com/stylessh/diffkit/issues) with:

- A clear description of the bug
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable

## Suggesting Features

Open an [issue](https://github.com/stylessh/diffkit/issues) with the `enhancement` label describing:

- The problem you're trying to solve
- Your proposed solution
- Any alternatives you've considered

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
