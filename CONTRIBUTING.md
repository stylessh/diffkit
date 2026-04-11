# Contributing to DiffKit

Thanks for your interest in contributing to DiffKit! This guide will help you get started.

## Development Setup

Follow the [Getting Started](README.md#getting-started) section in the README to set up your local environment.

## Workflow

1. **Fork the repo** and create your branch from `main`
2. **Make your changes** — keep commits focused and atomic
3. **Run checks** before pushing:
   ```bash
   pnpm check-types   # Type checking
   pnpm lint           # Linting
   pnpm format         # Formatting
   ```
4. **Open a pull request** against `main`

## Code Style

This project uses [Biome](https://biomejs.dev/) for linting and formatting. Run `pnpm format` to auto-format your code. Pre-commit hooks via Husky and lint-staged will also catch issues before they're committed.

A few conventions to keep in mind:

- Prefer editing existing files over creating new ones
- Keep components in the appropriate package (`apps/dashboard` for app-specific, `packages/ui` for shared)

## Project Architecture

DiffKit is a **pnpm monorepo** managed with **Turborepo**:

- **`apps/dashboard`** — The main web app built with TanStack Start, deployed to Cloudflare Workers
- **`packages/ui`** — Shared UI components (Radix UI primitives + Tailwind CSS)
- **`packages/icons`** — Icon wrapper package
- **`packages/typescript-config`** — Shared TypeScript configurations

### Key Technologies

- **TanStack Router** — File-based routing in `apps/dashboard/src/routes/`
- **TanStack Query** — Server state management and caching
- **Drizzle ORM** — Database schema and migrations in `apps/dashboard/src/db/` and `apps/dashboard/drizzle/`
- **Better Auth** — Authentication with a GitHub OAuth App, plus GitHub App user and installation tokens for installed repos
- **Cloudflare D1** — SQLite database at the edge

### GitHub Integration

DiffKit uses a hybrid GitHub auth model:

- The **GitHub OAuth App** signs users in and powers broad user-context reads, including public or external repositories where the GitHub App is not installed.
- The **GitHub App user token** powers installation discovery, including `GET /user/installations`.
- The **GitHub App installation token** is preferred for repo-scoped reads and writes when the app is installed for that owner.

Local development requires both app configs. The OAuth App callback is `/api/auth/callback/github`. The GitHub App user authorization callback is `/api/github/app/callback`, and the GitHub App setup URL is `/?show-org-setup=true` with **Redirect on update** enabled.

Required local variables are documented in `apps/dashboard/.dev.vars.example`. Do not commit real `.dev.vars` values or private keys. If a private key is exposed, revoke it in GitHub App settings and generate a replacement.

### Adding a New Route

Routes live in `apps/dashboard/src/routes/`. TanStack Router uses file-based routing — create a new file and the route is automatically registered.

Protected routes go under `_protected/` which enforces authentication.

### Adding a UI Component

Shared components go in `packages/ui/src/components/`. App-specific components go in `apps/dashboard/src/components/`.

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
