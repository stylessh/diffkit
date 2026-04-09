# DiffKit

A fast, design-first GitHub dashboard for developers who want to stay on top of their pull requests, issues, and code reviews — without the noise.

## Features

- **Pull Requests** — View, filter, and manage your open PRs across repos
- **Issues** — Track assigned issues with labels, milestones, and status
- **Code Reviews** — See pending review requests in one place
- **PR Diff Viewer** — Review pull request changes with inline comments
- **Dark Mode** — Full dark mode support out of the box
- **Fast** — Deployed on Cloudflare Workers at the edge

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | TanStack Start (React 19) |
| Routing | TanStack Router (file-based) |
| Data | TanStack Query + Octokit |
| Database | Cloudflare D1 (SQLite) via Drizzle ORM |
| Auth | Better Auth with GitHub App |
| Styling | Tailwind CSS 4 + Radix UI |
| Icons | Lucide React |
| Build | Vite 7 + Turborepo |
| Runtime | Cloudflare Workers |
| Linting | Biome |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v20+)
- [pnpm](https://pnpm.io/) (v10+)
- A [GitHub App](https://github.com/settings/apps)

### Setup

1. **Clone the repo**

   ```bash
   git clone https://github.com/stylessh/diffkit.git
   cd diffkit
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Configure environment variables**

   Create a `.dev.vars` file in `apps/dashboard/`:

   ```
   GITHUB_APP_CLIENT_ID=your_github_app_client_id
   GITHUB_APP_CLIENT_SECRET=your_github_app_client_secret
   GITHUB_WEBHOOK_SECRET=your_github_webhook_secret
   BETTER_AUTH_SECRET=a_random_32_character_string
   BETTER_AUTH_URL=http://localhost:3000
   ```

   > DiffKit also accepts the legacy `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` names during migration, but new setups should use the `GITHUB_APP_*` names above.

4. **Create and install the GitHub App**

   In [GitHub App settings](https://github.com/settings/apps):

   - Set the callback URL to `http://localhost:3000/api/auth/callback/github`
   - Grant the account permission `Email addresses: Read-only`
   - Install the app on the repositories or organizations you want DiffKit to access

   Recommended GitHub App permissions derived from the current roadmap:

   | Roadmap area | Roadmap items | GitHub App permission | Level | Notes |
   | --- | --- | --- | --- | --- |
   | Auth | Sign in and identify the user | User `Email addresses` | Read-only | Required for Better Auth to resolve the user's email address. |
   | Core dashboard | Overview, repo list, repo search, private repo access | Repository `Metadata` | Read-only | Required baseline permission for repository-aware reads. |
   | Pull requests | View/edit PRs, update branch, request reviewers, review diffs, merge, close/reopen, link issues | Repository `Pull requests` | Read & write | Required now for existing PR mutations and future PR management. |
   | Issues | View/create/edit/close issues, labels, milestones, comments | Repository `Issues` | Read & write | Required now for current label mutations and future issue workflows. |
   | CI and review status | PR checks, CI-aware review flows, CI notification filtering | Repository `Checks` | Read-only | Required now for pull request status surfaces. |
   | GitHub Actions | Workflow run history, job logs, artifacts, rerun/cancel/retry flows, Actions-focused UI | Repository `Actions` | Read & write | `Read` is enough for viewing workflow runs and logs. Use `Read & write` if the product should also rerun, cancel, delete, or otherwise manage workflow runs. |
   | Collaborators and teams | Reviewer pickers, org team reviewer flows | Organization `Members` | Read-only | Required for org installs if reviewer assignment should include teams. |
   | Repository content | File browser, README preview, branch/tag management, create PR from branches | Repository `Contents` | Read & write | Inference from the roadmap. Likely needed once repository browsing and branch operations ship. |
   | Workflow files and policy | Editing `.github/workflows/*`, enabling/disabling workflows, workflow policy/config management | Repository `Workflows` | Read & write | Separate from `Actions`. Needed when the app modifies workflow definitions or workflow configuration, not just when it reads logs or manages runs. |
   | Search | Global search across PRs, issues, and repos | No extra permission beyond the resources being searched | N/A | Search inherits access from `Metadata`, `Pull requests`, `Issues`, and likely `Contents`. |
   | Notifications | Notification inbox, mark read/unread, filter by type | No matching GitHub App permission | N/A | GitHub's notifications REST endpoints do not support GitHub App user or installation tokens, so this roadmap area needs a different implementation strategy. |

   If we add new permissions after users have already installed the app, GitHub will require those installations to approve the expanded permission set.

   Recommended webhook events in GitHub App setup:

   | GitHub UI label | Enable now | Why |
   | --- | --- | --- |
   | `Check run` | Yes | Keeps PR status and check-derived cache fresh. |
   | `Check suite` | Yes | Captures suite-level CI state changes for PR refreshes. |
   | `Issue comment` | Yes | Refreshes issue and PR comment-related views. |
   | `Issues` | Yes | Refreshes issue and PR metadata when titles, bodies, labels, or state change. |
   | `Pull request` | Yes | Core PR invalidation event. |
   | `Pull request review` | Yes | Refreshes review state and PR detail data. |
   | `Pull request review comment` | Yes | Refreshes diff discussion and review comment data. |
   | `Pull request review thread` | Yes | Refreshes review thread state changes. |
   | `Workflow run` | Later | Recommended once the Actions dashboard ships. Useful for workflow-run level updates, logs, reruns, and run state transitions. |
   | `Workflow job` | Later | Recommended once the Actions dashboard ships. Useful for job-level logs, timing, and per-job status updates. |
   | `Push` | Later | Not used by the current invalidation code, but likely useful once branch-aware repo/activity features expand. |
   | `Repository` | Later | Useful for repo settings and metadata changes if repository management surfaces expand. |
   | `Create` | Later | Useful for branch/tag creation flows if repo management features ship. |
   | `Delete` | Later | Useful for branch/tag deletion flows if repo management features ship. |

   `Workflow run` and `Workflow job` require at least repository `Actions: Read-only`.

   The current webhook invalidation route is wired for the first 8 events above. If you enable the `Later` events now, they are harmless, but the app will ignore them until we add handlers.

   Set the webhook URL to `/api/webhooks/github` on your deployed app. For local webhook testing, use a tunnel that forwards to `http://localhost:3000/api/webhooks/github`.

   For local Vite development, set `DEV_TUNNEL_URL` in `apps/dashboard/.dev.vars` to the full public tunnel URL, for example `https://your-subdomain.ngrok-free.app`. The dev server will use it to allow the tunnel host and configure HMR correctly.

5. **Run database migrations**

   ```bash
   pnpm --filter dashboard migrate
   ```

6. **Start the dev server**

   ```bash
   pnpm dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.


## Scripts

| Command | Description |
|---------|------------|
| `pnpm dev` | Start all dev servers |
| `pnpm build` | Build all packages and apps |
| `pnpm lint` | Lint the codebase |
| `pnpm check` | Run Biome checks |
| `pnpm check-types` | Type-check all packages |
| `pnpm format` | Format code with Biome |

## Roadmap

### Dashboard

- [x] Overview with PR, issue, and review counts
- [ ] Activity feed (recent events across repos)
- [ ] Customizable dashboard widgets

### Pull Requests

- [x] List PRs by role (authored, assigned, review requested, mentioned, involved)
- [x] PR detail view with metadata, body, and comments
- [x] PR diff viewer with syntax highlighting
- [x] Inline review comments on specific lines
- [x] Submit reviews (approve, request changes, comment)
- [x] Update branch with base
- [ ] Create new pull requests
- [ ] Merge pull requests (merge, squash, rebase)
- [ ] Close / reopen pull requests
- [ ] Edit PR title, body, and metadata
- [ ] Add / remove reviewers
- [ ] Add / remove labels
- [ ] Link issues to pull requests

### Issues

- [x] List issues by role (assigned, authored, mentioned)
- [x] Issue detail view with metadata, body, and comments
- [ ] Create new issues
- [ ] Close / reopen issues
- [ ] Comment on issues
- [ ] Edit issue title, body, and metadata
- [ ] Assign / unassign users
- [ ] Add / remove labels
- [ ] Set milestones

### Code Reviews

- [x] Pending review requests view
- [x] File tree navigator with status badges
- [x] Side-by-side diff view
- [x] Multi-line comment selection
- [ ] Resolve / unresolve review threads
- [ ] Suggest changes (code suggestions in comments)
- [ ] Review comment reactions

### Notifications

- [ ] Notification inbox
- [ ] Mark as read / unread
- [ ] Filter by type (PR, issue, review, CI)
- [ ] Desktop notifications

### Repositories

- [ ] Repository list and search
- [ ] Repository file browser
- [ ] Branch and tag management
- [ ] README preview

### Search

- [ ] Global search across PRs, issues, and repos
- [ ] Saved searches and filters
- [ ] Advanced query syntax

### General

- [x] GitHub App authentication
- [x] Dark mode with system preference
- [x] Response caching with ETags
- [ ] Keyboard shortcuts
- [ ] Command palette
- [ ] User settings and preferences
- [ ] Mobile-responsive layout

## Contributing

We welcome contributions! Please read the [Contributing Guide](CONTRIBUTING.md) before submitting a pull request.

## License

[MIT](LICENSE)
