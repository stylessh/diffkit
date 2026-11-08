# End-to-end tests

`pnpm test:e2e` runs the whole dashboard against the local GitHub emulator
(see [local-demo-mode.md](./local-demo-mode.md)) in headless Chromium. No GitHub
account, credentials or network access are involved.

```sh
pnpm install
pnpm --filter @diffkit/e2e exec playwright install chromium   # once
pnpm test:e2e                                                 # everything
pnpm test:e2e --project=concurrent                            # one project
pnpm test:e2e inbox --headed                                  # one spec, visible
pnpm --filter @diffkit/e2e report                             # open the HTML report
pnpm --filter @diffkit/e2e test:e2e:ui                        # Playwright UI mode
```

## What a run does

1. Starts `apps/emulator/src/e2e.ts`: the demo workspace, in memory, seeded
   once. It exposes `POST /_diffkit/e2e/checkpoint` and `/_diffkit/e2e/reset`.
2. Wipes `apps/dashboard/.wrangler/demo-state`, applies D1 migrations and starts
   `vite dev` with `CLOUDFLARE_ENV=demo`.
3. `support/global-setup.ts` signs in as `nova` through the emulator's account
   picker, saves `apps/e2e/.auth/nova.json`, visits the routes the specs use so
   the dev server compiles them before the specs race, and checkpoints the
   emulator.

Both servers are started by Playwright's `webServer` and stopped when the run
ends. A run never reuses servers that are already listening: it fails fast if
the ports are taken, so stop `pnpm dev:demo` first. Ports come from
`apps/dashboard/.dev.vars.demo` (`BETTER_AUTH_URL`, `GITHUB_EMULATOR_URL`);
that file is the single source of truth.

Running the suite deletes the demo D1 state used by `pnpm dev:demo`
(`--reset` does the same). The emulator state for `dev:demo` is untouched: the
suite never persists `apps/emulator/.emulate/`.

## Projects

| Project | Specs | Runs |
| --- | --- | --- |
| `concurrent` | `tests/concurrent` | read-only journeys, in parallel, sharing the seeded workspace |
| `isolated` | `tests/isolated` | journeys that mutate GitHub state or are timing-sensitive, one at a time, after `concurrent`; the emulator is reset to the checkpoint before each test |

A new spec that writes through the emulator (review, issue, notification) goes
in `isolated` and imports `isolatedTest`; a read-only one goes in `concurrent`
and imports `test` from `support/test.ts`.

The emulator is the source of truth for assertions on writes:
`emulator.rest("nova", "GET", "/notifications")` calls its REST API as a seeded
user.

## Journeys

| Spec | Covers |
| --- | --- |
| `concurrent/overview` | home summary and navigation into a pull request |
| `concurrent/pull-requests` | queues, author filter persisted in the `diffkit-filters` cookie, pull request detail, the diff page with review threads |
| `concurrent/issues` | issue queue and issue detail |
| `concurrent/repository` | commits, branches and releases pages |
| `isolated/auth` | protected redirect, sign-in through the emulator, sign-out |
| `isolated/review-submission` | approving from the review page |
| `isolated/new-issue` | creating an issue |
| `isolated/inbox` | marking a notification as read |
| `isolated/instant-ui` | a revisited pull request paints from IndexedDB with no skeleton while every server function is held |
| `isolated/repo-settings` | repository settings: saving the description, the last-merge-method guard, labels, an Actions secret and variable, collaborators and invitations, a webhook and its redelivery |
| `isolated/change-feed` | a signed webhook refreshes an open list without a reload |

The emulator does not deliver app webhooks in this mode, so only the webhooks a
spec posts reach `/api/webhooks/github`.

## Debugging

- Failed tests keep a trace: `pnpm --filter @diffkit/e2e exec playwright show-trace test-results/<test>/trace.zip`.
- `--headed` and `PWDEBUG=1` work as usual; add `--workers=1` to read the output.
- The dev server's output is printed with a `[WebServer]` prefix.
- To poke the data a spec sees, run `pnpm dev:demo` instead (the same
  workspace) and use the browser.
- In CI the HTML report and traces are uploaded as the `playwright-report`
  artifact when the job fails.

## Writing specs

- Use roles and accessible names. Scope with `getByRole("complementary")`,
  `getByRole("navigation", { name })` or a heading when a name appears twice.
- Server-rendered buttons ignore clicks until React hydrates: wrap them in
  `whenInteractive(locator)` before clicking.
- Never sleep. Wait on a locator, `expect.poll`, a response, or the emulator.
- Dates render in the browser's time zone and locale; the config pins both to UTC and en-US.
- Do not assert relative times ("6d ago"); the seed is anchored at
  2026-11-02, not at today.

## Known limits

- The suite runs against `vite dev`: `GITHUB_EMULATOR_URL` is refused by
  production builds, so there is no built-bundle run.
- An invalid webhook signature is answered with 401 by the app but surfaces as a
  500 through Miniflare's dev proxy; specs assert "not accepted", not the code.
- Several controls are icon-only without an accessible name (label and assignee
  pickers, the inbox menu), so they are not covered yet.
