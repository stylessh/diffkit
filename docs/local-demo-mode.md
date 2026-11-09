# Local demo mode

`pnpm dev:demo` runs the whole dashboard on your machine with **no GitHub
account, GitHub App, OAuth app, tunnel or network access**. A local GitHub
stand-in serves a seeded workspace, and you sign in with one click.

```sh
pnpm install
pnpm dev:demo            # add --reset to reseed and wipe demo D1/KV/R2 state
```

Open <http://localhost:3000>, click **Continue with GitHub**, pick **Nova Reyes
(`nova`)** in the emulator's account picker. You land on the dashboard.

## How it works

```
browser ──▶ dashboard (vite dev, CLOUDFLARE_ENV=demo, :3000)
               │  GITHUB_EMULATOR_URL=http://localhost:4001
               ▼
           apps/emulator (:4001)
               ├─ pre-dispatch bridges   PR-as-issue routes, /users/<org>, App authorize auto-approve
               ├─ DiffKit shims          /graphql, /notifications, installations, statuses, stars, …
               └─ @emulators/github      emulate's stateful GitHub REST API (users, repos, git data,
                                         issues, PRs, reviews, Actions, checks, releases, OAuth, App auth)
               │
               └─ signed webhooks ──▶ http://localhost:3000/api/webhooks/github
```

- **`apps/emulator`** runs [vercel-labs/emulate](https://github.com/vercel-labs/emulate)'s
  GitHub service (`@emulators/github@0.13.0`, Apache-2.0) in-process and
  registers DiffKit's shims on the same Hono app and store, so shims and REST
  share one state.
- **GraphQL shim** (`src/graphql`): a schema built from the exact fields
  DiffKit selects, resolved against emulate's store with `graphql-js`.
  Variables, aliases and fragments work; `rateLimit` is answered; missing
  repositories return GitHub-style `NOT_FOUND` errors. Same-named enum fields in
  exclusive fragments are allowed, as GitHub allows them.
- **REST shims** (`src/shims`) fill gaps in emulate: notifications (kept up to
  date from emulate's own webhook events), `/user/installations`, commit
  statuses and combined status, stars, participation stats, user events,
  contributors, real PR files and commits, zipped Actions logs, reviews with
  line ranges, review replies, deleting pending reviews, `GET/PATCH
  /issues/:n` for pull requests, `/users/<org>`, SVG avatars, and the PR diff
  media type (`Accept: application/vnd.github.diff`, refused with 406 past 300
  files like GitHub).
- **Settings shims** (`src/shims/settings-*.ts`): what the repository and
  organization settings pages call on top of emulate. Actions variables and
  secrets (with a real X25519 public key), collaborator roles and invitations,
  teams with per-repository roles, webhook config, pings and a delivery history
  with redelivery (recorded, never sent), rulesets, branch protection flags,
  repository settings that GitHub validates (`default_branch`,
  `allow_update_branch`, per-viewer `permissions`, repo delete cleanup), org
  profile, owner/member roles, org invitations and team counts. `lumen-labs/beacon`
  carries the seed for all of it.
- **Seed** (`src/seed`): `content/*.ts` declares people, an org, six repos
  (a TypeScript library, a pnpm monorepo, a docs repo, a private repo, a
  personal repo, and `lumen-labs/atlas`, generated for diff-viewer performance:
  PR #1 has 250 files and ~43k changed lines, PR #2 has 400 files and exercises
  the too-large fallback), commit histories, ~13 PRs in every state (draft, approved,
  changes requested, conflicting, merged, closed, a three-PR stack), ~19 issues,
  review threads (resolved, unresolved, pending drafts), reactions,
  cross-references, Actions runs with jobs and logs, check runs, statuses,
  tags, releases with assets, discussions, stars, pins and notifications.
  Content goes through emulate's REST API as the acting user; timestamps and
  things REST cannot create (runs, check runs, assets) are written to the store
  directly.
- **Deterministic**: timestamps are offsets from a fixed anchor
  (`2026-11-02T17:00Z`), commits go through the Git Data API with explicit
  dates, so SHAs, ids and screenshots are reproducible. Set
  `DIFFKIT_DEMO_ANCHOR=now` for fresh-looking dates.
- **Persistence**: emulator state is saved to `apps/emulator/.emulate/state.json`
  (gitignored) and restored on the next start. Editing anything under
  `apps/emulator/src` reseeds automatically; issued tokens are carried over so
  you stay signed in.

## The app switch

Everything is gated on one dev var, `GITHUB_EMULATOR_URL`
(`apps/dashboard/src/lib/github-emulator.server.ts`). When set:

- every Octokit client (OAuth user, app user, installation, and the App itself)
  gets `baseUrl` = the emulator;
- the GitHub App user-token exchange and the App authorize redirect use the
  emulator's `/login/oauth/*`;
- Better Auth signs in with its `genericOAuth` plugin (provider id `github`, same
  user mapping) because the built-in GitHub provider hard-codes github.com;
- sign-in chains straight into the GitHub App authorization, which the emulator
  auto-approves for the account you just picked.

It throws in production builds (`import.meta.env.PROD`) and for non-localhost
URLs. Unset, nothing changes.

`pnpm dev:demo` (`scripts/dev-demo.mjs`) checks that ports 3000 and 4001 are
free, applies D1 migrations to `apps/dashboard/.wrangler/demo-state`, starts the
emulator, waits for `/_diffkit/health`, runs the dashboard with
`CLOUDFLARE_ENV=demo` and makes the first request to `/login`. If any step or
process fails, everything it started is stopped. See
[local-dev.md](local-dev.md#when-something-is-off) for the error messages.
`CLOUDFLARE_ENV=demo` selects the `demo` environment in the committed
`wrangler.demo.jsonc` (local D1/KV/R2 only) and makes Wrangler load the
committed `.dev.vars.demo` **instead of** your `.dev.vars`, which is never read
or touched.

`.dev.vars.demo` holds throwaway credentials, including a demo-only GitHub App
private key; they only work against the local emulator. A test keeps them in
sync with `apps/emulator/src/seed/identity.ts`.

## What is not emulated

- GraphQL beyond what DiffKit queries today. New query fields fail
  `apps/emulator/src/__tests__/graphql-documents.test.ts` until the schema
  covers them.
- Conditional requests: no ETags or `304 Not Modified`.
- Search is a qualifier matcher over the store, not GitHub's ranking.
- Merge conflicts are declared in the seed, not computed; `update-branch` is
  minimal. Rulesets are read-only (two seeded, none enforced, no create/edit),
  the seeded branch protection on `beacon`'s `main` does not block merges, and
  invitations can be created and cancelled but not accepted.
- Actions do not execute: runs, jobs and logs are seeded; re-runs only return
  success.
- "Open on GitHub" and other github.com links keep pointing at github.com, where
  the demo repositories do not exist.
- Reactions on REST payloads, discussions and pins come from the shim store.

## Working on it

```sh
pnpm --filter @diffkit/emulator dev     # emulator alone (seeds or restores)
pnpm --filter @diffkit/emulator test    # runs every DiffKit GraphQL document + shim tests
```

Seeding takes well under a second. Seeded tokens (`demo_seed_<login>`) let you
poke the API directly:

```sh
curl -H "Authorization: token demo_seed_nova" http://localhost:4001/user
```

The [end-to-end suite](./e2e.md) runs against this same workspace.
