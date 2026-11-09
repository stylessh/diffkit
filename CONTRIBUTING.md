# Contributing to DiffKit

Thanks for your interest in contributing to DiffKit! This guide will help you get started.

## Development Setup

Follow the [Getting Started](README.md#getting-started) section in the README to set up your local environment. You'll need both a GitHub OAuth App and a GitHub App configured.

For UI work you can skip all of that: `pnpm dev:demo` runs DiffKit against a local GitHub emulator with seeded data (see [docs/local-demo-mode.md](docs/local-demo-mode.md)). If you change a GraphQL query, run `pnpm --filter @diffkit/emulator test`; it executes every query in `apps/dashboard/src/lib/github/` against the emulator and tells you which fields the shim still needs.

For webhook testing during local development, use an ngrok tunnel (or similar) and set `DEV_TUNNEL_URL` in your `.env`.

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
│       └── db/migrations/  # SQL migration files
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
- **Drizzle ORM** — Database schema and migrations in `apps/dashboard/src/db/` and `apps/dashboard/db/migrations/`
- **Better Auth** — Authentication with a GitHub OAuth App, plus GitHub App user and installation tokens for installed repos
- **Cloudflare D1** — SQLite database at the edge (auth data, cache control state)
- **Cloudflare KV** — Hot payload cache for GitHub API responses (`GITHUB_CACHE_KV` binding)
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

Environment variables are declared in `apps/dashboard/env.ts` and documented in `apps/dashboard/env.example`. Do not commit real `.env` values or private keys. If a private key is exposed, revoke it in GitHub App settings and generate a replacement.

### Data Fetching & Revalidation

Server functions read from GitHub directly; there is no server-side response cache (the D1/KV cache was removed after it filled the production database, see [`docs/platform-plan.md`](docs/platform-plan.md#incidents)). Freshness comes from the client. For the full design, see [`docs/data-fetching.md`](docs/data-fetching.md). The overview:

- **Client cache** — React Query persists to IndexedDB (`apps/dashboard/src/lib/query-persister.ts`, `github-query-persistence.ts`), so previously seen data paints instantly and revalidates in the background.
- **Change feed** — The GitHub webhook handler maps each delivery to entity keys (`github-change-entities.ts`) and records them in the `github_change` D1 table. Clients poll `GET /api/changes` and refetch only the affected queries. Responses only include repos the viewer can read.
- **Bounded storage** — Change-feed rows live for 15 minutes. A cron trigger (every 5 minutes, `scheduled-maintenance.server.ts`) deletes expired rows and logs a warning when D1 nears its size limit.

Rules for any new server-side storage: ship a TTL or retention rule and a sweeper in the same PR, never await a storage write on the request path, and treat a storage failure as a cache miss, not an error.

### Webhook Handler

The webhook endpoint at `apps/dashboard/src/routes/api/webhooks/github.ts` verifies the HMAC-SHA256 signature, maps the event to change-feed entity keys, and records them in D1 from `waitUntil` so a storage failure never fails the delivery. Installation events also drop the cached installation token. Supported events include `pull_request`, `issues`, `issue_comment`, `check_run`, `check_suite`, `pull_request_review`, and more.

### Adding a New Route

Routes live in `apps/dashboard/src/routes/`. TanStack Router uses file-based routing — create a new file and the route is automatically registered.

Protected routes go under `_protected/` which enforces authentication.

### Adding a UI Component

Shared components go in `packages/ui/src/components/`. App-specific components go in `apps/dashboard/src/components/`.

### Database Migrations

Migration files live in `apps/dashboard/db/migrations/`. `pnpm dev` applies new ones to local D1 on start, and `void deploy` applies them to the deployed database. To run them by hand:

```bash
pnpm --filter dashboard migrate         # Local D1
pnpm --filter dashboard migrate:remote  # Remote D1
```

If you add a new table or column, create a new numbered SQL file in `apps/dashboard/db/migrations/` and add its entry to `meta/_journal.json`; Void refuses to deploy files the journal does not list. A file that drops or renames data needs `-- void:allow-destructive` as its first line.

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
