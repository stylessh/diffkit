# Local development

Two ways to run the dashboard locally. Both serve <http://localhost:3000> from
`vite dev` with [Void](https://void.cloud)'s Vite plugin (Miniflare/workerd), so
the Worker runs the same way it does in production. `apps/dashboard/void.config.ts`
declares its bindings for both; there is no Cloudflare config to copy.

| | `pnpm dev:demo` | `pnpm dev` |
|---|---|---|
| GitHub | local emulator (`apps/emulator`, :4001) with a seeded workspace | real github.com |
| Credentials | none, committed throwaway `apps/emulator/dashboard.env` | your OAuth App + GitHub App in `apps/dashboard/.env` |
| D1/KV/R2 | local, `apps/dashboard/.wrangler/demo-state` | local, `apps/dashboard/.wrangler/state` |
| Network | not needed | needed |

Requirements: Node 24.22+ (`.node-version` pins it) and pnpm 10 (`corepack
enable`). Run `pnpm install` once after cloning.

## Demo mode (no GitHub)

```sh
pnpm install
pnpm dev:demo            # --reset wipes demo D1/KV/R2 state and reseeds the emulator
```

It starts the emulator and waits for its seed, starts the dashboard (which
applies D1 migrations on start) and makes the first request so the Worker is
warm when you open it. Sign in with **Continue with GitHub** and pick **nova**. What is emulated
and how: [local-demo-mode.md](local-demo-mode.md).

## Real GitHub

1. Create the GitHub apps and `.env`:
   ```sh
   pnpm setup:github        # --tunnel https://<your tunnel> also turns webhooks on
   ```
   It opens a local page with three steps. The GitHub App is registered from a
   manifest with the hosted app's permissions and events, so that step is one
   click on GitHub. GitHub has no such flow for OAuth Apps: the page links to
   the form, and you paste the client ID and secret back. It then writes
   `apps/dashboard/.env` in the main checkout and refuses to replace an
   existing one.

   To do it by hand instead, follow
   [README, steps 2–5](../README.md#2-create-a-github-oauth-app).
   `apps/dashboard/env.ts` lists every value and which ones are required; `pnpm
   --filter @diffkit/dashboard exec void env check` validates your file. An
   older checkout's `.dev.vars` works as is once renamed to `.env`.
2. Start it:
   ```sh
   pnpm dev
   ```
   It links `.env` from the main checkout when you are in a git worktree, then
   starts the dashboard, which applies new D1 migrations to local state.
3. Install the GitHub App from the link the setup page ends on. GitHub sends
   you back to <http://localhost:3000/setup>, so the dashboard has to be
   running first.

Webhooks need a public tunnel that is up before GitHub delivers. See
[Local webhook testing](../README.md#local-webhook-testing).

## When something is off

Both commands check for these before starting anything, and stop with a message
that says what to do:

- **Port 3000 or 4001 busy.** The message names the process and its directory.
  Stop it (often another `pnpm dev` or `pnpm dev:demo`, possibly from another
  worktree) and re-run. The ports are fixed because the OAuth callback URLs
  point at them.
- **Missing `.env`, or a leftover `.dev.vars`** (only `pnpm dev`). Void reads
  `.env` only and refuses to start while another env file sits next to it.
- **Dependencies not installed or Node too old.**

Re-running is safe: migrations only apply what is new, and the emulator restores
its saved state, or reseeds when the seed changed. For a clean demo, use `pnpm
dev:demo --reset`.

If the first request fails with a 500, the dashboard output above it has the
cause. A workerd `Ineffective mark-compacts near heap limit` crash means a
dependency got pre-bundled into one huge SSR module. The `hugeiconsDeepImports`
plugin in `apps/dashboard/vite.config.ts` prevents that for `@hugeicons/react`,
and the **Dev Smoke** CI job fails when it happens again.

## Production build locally

```sh
pnpm --filter @diffkit/dashboard build
pnpm --filter @diffkit/dashboard preview
```

Production deploys go through `.github/workflows/dashboard-deploy-production.yml`.
To deploy your own instance, see [self-hosting.md](self-hosting.md).
