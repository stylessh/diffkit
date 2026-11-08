# Local development

Two ways to run the dashboard locally. Both serve <http://localhost:3000> from
`vite dev` with the Cloudflare Vite plugin (Miniflare/workerd), so the Worker
runs the same way it does in production.

| | `pnpm dev:demo` | `pnpm dev` |
|---|---|---|
| GitHub | local emulator (`apps/emulator`, :4001) with a seeded workspace | real github.com |
| Credentials | none, committed throwaway `.dev.vars.demo` | your OAuth App + GitHub App in `.dev.vars` |
| Wrangler config | committed `wrangler.demo.jsonc` | your `wrangler.dev.jsonc` |
| D1/KV/R2 | local, `apps/dashboard/.wrangler/demo-state` | local (`.wrangler/state`), R2 remote if configured |
| Network | not needed | needed |

Requirements: Node 22.6+ and pnpm 10 (`corepack enable`). Run `pnpm install`
once after cloning.

## Demo mode (no GitHub)

```sh
pnpm install
pnpm dev:demo            # --reset wipes demo D1/KV/R2 state and reseeds the emulator
```

It applies D1 migrations, starts the emulator and waits for its seed, starts
the dashboard and makes the first request so the Worker is warm when you open
it. Sign in with **Continue with GitHub** and pick **nova**. What is emulated
and how: [local-demo-mode.md](local-demo-mode.md).

## Real GitHub

1. Create a GitHub OAuth App and a GitHub App, and install the App
   ([README, steps 2–4](../README.md#2-create-a-github-oauth-app)).
2. Credentials:
   ```sh
   cp apps/dashboard/.dev.vars.example apps/dashboard/.dev.vars
   ```
   Fill in the values ([README, step 5](../README.md#5-configure-environment-variables)).
3. Wrangler config:
   ```sh
   cp apps/dashboard/wrangler.jsonc.example apps/dashboard/wrangler.dev.jsonc
   ```
   Replace every `YOUR_…` placeholder. D1 and KV run locally in Miniflare
   whatever ids you use. The `COMMENT_MEDIA` R2 bucket is `"remote": true`, so
   comment image uploads go to a real bucket: run `pnpm --filter
   @diffkit/dashboard exec wrangler login` once, or delete `"remote": true` to
   keep uploads in local state.
4. Start it:
   ```sh
   pnpm dev
   ```
   It links `.dev.vars` and `wrangler.dev.jsonc` from the main checkout when
   you are in a git worktree, applies local D1 migrations, then starts the
   dashboard.

Webhooks need a public tunnel. See
[Local webhook testing](../README.md#local-webhook-testing).

## When something is off

Both commands check for these before starting anything, and stop with a message
that says what to do:

- **Port 3000 or 4001 busy.** The message names the process and its directory.
  Stop it (often another `pnpm dev` or `pnpm dev:demo`, possibly from another
  worktree) and re-run. The ports are fixed because the OAuth callback URLs
  point at them.
- **Missing `.dev.vars` / `wrangler.dev.jsonc`, or `YOUR_…` placeholders left
  in it** (only `pnpm dev`).
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

Deploys go through `.github/workflows/dashboard-deploy-production.yml`, not
from your machine.
