# DiffKit

A fast, design-first GitHub dashboard for developers who want to stay on top of their pull requests, issues, and code reviews — without the noise.

> [!WARNING]
> **Alpha** — DiffKit is in early release. Expect bugs, errors, and rough edges. Feedback and issue reports are welcome on [GitHub Issues](https://github.com/stylessh/diffkit/issues).

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
| Auth | Better Auth with GitHub OAuth App + GitHub App |
| Styling | Tailwind CSS 4 + Radix UI |
| Icons | Lucide React |
| Build | Vite 7 + Turborepo |
| Runtime | Cloudflare Workers |
| Linting | Biome |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v20+
- [pnpm](https://pnpm.io/) v10+

### 1. Clone and install

```bash
git clone https://github.com/stylessh/diffkit.git
cd diffkit
pnpm install
```

### 2. Create a GitHub OAuth App

The OAuth App handles user login and broad-scope reads (`repo`, `read:org`, `user:email`). It's also the fallback for repositories where the GitHub App is not installed.

1. Go to [GitHub OAuth App settings](https://github.com/settings/developers) and click **New OAuth App**
2. Fill in the form:
   - **Application name**: DiffKit (local)
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`
3. Click **Register application**
4. Copy the **Client ID**
5. Click **Generate a new client secret** and copy it

You'll need both values for your `.dev.vars` file in step 5.

### 3. Create a GitHub App

The GitHub App provides installation tokens for repo-scoped access, webhook delivery, and user-to-server tokens for installation discovery.

1. Go to [GitHub App settings](https://github.com/settings/apps) and click **New GitHub App**
2. Fill in the form:
   - **GitHub App name**: DiffKit Dev (must be globally unique)
   - **Homepage URL**: `http://localhost:3000`
   - **Callback URL**: `http://localhost:3000/api/github/app/callback`
   - **Setup URL**: `http://localhost:3000/setup`
   - Check **Redirect on update**
   - Leave **Request user authorization (OAuth) during installation** **unchecked**
   - **Webhook URL**: leave blank for now (see [Local webhook testing](#local-webhook-testing) below)

3. Under **Permissions**, grant the following:

   | Category | Permission | Level |
   |----------|-----------|-------|
   | Repository | Metadata | Read-only |
   | Repository | Pull requests | Read & write |
   | Repository | Issues | Read & write |
   | Repository | Checks | Read-only |
   | Repository | Actions | Read-only |
   | Repository | Contents | Read & write |
   | Organization | Members | Read-only |
   | Account | Email addresses | Read-only |

4. Under **Subscribe to events**, enable:
   - Check run
   - Check suite
   - Issue comment
   - Issues
   - Pull request
   - Pull request review
   - Pull request review comment
   - Pull request review thread

5. Click **Create GitHub App**

6. On the app settings page, note down:
   - **App ID** (numeric, shown at the top)
   - **Client ID** (starts with `Iv1.`)
   - The **slug** from the app URL (`https://github.com/apps/<slug>`)

7. Generate credentials:
   - Click **Generate a new client secret** and copy it
   - Under **Private keys**, click **Generate a private key** — a `.pem` file will download

8. Convert the private key to a single-line format for `.dev.vars`:
   ```bash
   awk 'NF {printf "%s\\n", $0}' /path/to/downloaded-key.pem
   ```
   GitHub downloads PKCS#1 keys (`BEGIN RSA PRIVATE KEY`). DiffKit auto-converts to PKCS#8 at runtime.

### 4. Install the GitHub App

1. Go to your GitHub App's settings page → **Install App**
2. Choose the user or organization you want DiffKit to access
3. Select **All repositories** or pick specific ones
4. Click **Install**

### 5. Configure environment variables

Copy the example file and fill in the values from steps 2–4:

```bash
cp apps/dashboard/.dev.vars.example apps/dashboard/.dev.vars
```

Open `apps/dashboard/.dev.vars` and fill in:

```
# From the OAuth App (step 2)
GITHUB_OAUTH_CLIENT_ID=your_oauth_client_id
GITHUB_OAUTH_CLIENT_SECRET=your_oauth_client_secret

# From the GitHub App (step 3)
GITHUB_APP_CLIENT_ID=Iv1.your_app_client_id
GITHUB_APP_CLIENT_SECRET=your_app_client_secret
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n"
GITHUB_APP_SLUG=your-app-slug

# Webhook secret (set the same value in your GitHub App settings)
GITHUB_WEBHOOK_SECRET=your_webhook_secret

# Generate with: openssl rand -base64 32
BETTER_AUTH_SECRET=your_random_secret_at_least_32_chars
BETTER_AUTH_URL=http://localhost:3000
```

> DiffKit also accepts the legacy `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` names as a fallback for the OAuth App credentials.

### 6. Run database migrations

```bash
pnpm --filter dashboard migrate
```

### 7. Start the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Local webhook testing

To receive GitHub webhooks locally, you need a public tunnel:

1. Start a tunnel (e.g. with [ngrok](https://ngrok.com/)):
   ```bash
   ngrok http 3000
   ```
2. Copy the public URL (e.g. `https://abc123.ngrok-free.app`)
3. Add it to `apps/dashboard/.dev.vars`:
   ```
   DEV_TUNNEL_URL=https://abc123.ngrok-free.app
   ```
4. In your GitHub App settings, set **Webhook URL** to:
   ```
   https://abc123.ngrok-free.app/api/webhooks/github
   ```
5. Generate a **Webhook secret** and set the same value in both GitHub and your `.dev.vars`
6. Restart the dev server

The dev server uses `DEV_TUNNEL_URL` to allow the tunnel host and configure HMR correctly.

## Scripts

| Command | Description |
|---------|------------|
| `pnpm dev` | Start all dev servers |
| `pnpm build` | Build all packages and apps |
| `pnpm lint` | Lint the codebase |
| `pnpm check` | Run Biome checks |
| `pnpm check-types` | Type-check all packages |
| `pnpm format` | Format code with Biome |

### Dashboard-specific scripts

| Command | Description |
|---------|------------|
| `pnpm --filter dashboard migrate` | Run D1 migrations (local) |
| `pnpm --filter dashboard migrate:remote` | Run D1 migrations (remote) |
| `pnpm --filter dashboard test` | Run tests |
| `pnpm --filter dashboard deploy` | Build and deploy to Cloudflare Workers |

## GitHub App Permissions Reference

Expanding permissions after users have installed the app will require those installations to approve the new permission set.

<details>
<summary>Full permissions table with roadmap context</summary>

| Roadmap area | Permission | Level | Notes |
|---|---|---|---|
| Auth | User `Email addresses` | Read-only | Resolves the user's email for Better Auth |
| Core dashboard | Repository `Metadata` | Read-only | Baseline for repository-aware reads |
| Pull requests | Repository `Pull requests` | Read & write | PR mutations, reviews, and management |
| Issues | Repository `Issues` | Read & write | Label mutations and issue workflows |
| CI status | Repository `Checks` | Read-only | PR status checks display |
| GitHub Actions | Repository `Actions` | Read-only | Workflow run history and logs (upgrade to Read & write for rerun/cancel) |
| Collaborators | Organization `Members` | Read-only | Reviewer pickers with team support |
| Repo content | Repository `Contents` | Read & write | File browser, branch operations |
| Workflow files | Repository `Workflows` | Read & write | Editing workflow definitions (future) |
| Search | — | N/A | Inherits from other permissions |
| Notifications | — | N/A | GitHub notifications API doesn't support App tokens; needs different strategy |

</details>

<details>
<summary>Full webhook events table</summary>

| Event | Enable now | Why |
|---|---|---|
| Check run | Yes | PR status and check cache freshness |
| Check suite | Yes | Suite-level CI state for PR refreshes |
| Issue comment | Yes | Issue and PR comment views |
| Issues | Yes | Issue metadata changes |
| Pull request | Yes | Core PR invalidation |
| Pull request review | Yes | Review state and PR detail |
| Pull request review comment | Yes | Diff discussion and review comments |
| Pull request review thread | Yes | Review thread state changes |
| Workflow run | Later | For Actions dashboard (workflow-run updates) |
| Workflow job | Later | For Actions dashboard (job-level logs) |
| Push | Later | Branch-aware activity features |
| Repository | Later | Repo settings and metadata changes |
| Create | Later | Branch/tag creation flows |
| Delete | Later | Branch/tag deletion flows |

Events marked "Later" are harmless to enable now — the app will ignore them until handlers are added.

</details>

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
- [x] Merge pull requests (merge, squash, rebase)
- [x] Close / reopen pull requests
- [ ] Edit PR title, body, and metadata
- [x] Add / remove reviewers
- [x] Add / remove labels
- [ ] Link issues to pull requests

### Issues

- [x] List issues by role (assigned, authored, mentioned)
- [x] Issue detail view with metadata, body, and comments
- [x] Create new issues
- [ ] Close / reopen issues
- [x] Comment on issues
- [ ] Edit issue title, body, and metadata
- [x] Assign / unassign users
- [x] Add / remove labels
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

- [x] Repository list and search
- [x] Repository file browser
- [ ] Branch and tag management
- [x] README preview

### Search

- [x] Global search across PRs, issues, and repos
- [ ] Saved searches and filters
- [ ] Advanced query syntax

### General

- [x] GitHub App authentication
- [x] Dark mode with system preference
- [x] Response caching with ETags
- [x] Keyboard shortcuts
- [x] Command palette
- [x] User settings and preferences
- [x] Mobile-responsive layout

## Contributing

We welcome contributions! Please read the [Contributing Guide](CONTRIBUTING.md) before submitting a pull request.

## License

[MIT](LICENSE)
