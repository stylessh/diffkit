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
| Auth | Better Auth with GitHub OAuth |
| Styling | Tailwind CSS 4 + Radix UI |
| Icons | Lucide React |
| Build | Vite 7 + Turborepo |
| Runtime | Cloudflare Workers |
| Linting | Biome |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v20+)
- [pnpm](https://pnpm.io/) (v10+)
- A [GitHub OAuth App](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app)

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
   GITHUB_CLIENT_ID=your_github_client_id
   GITHUB_CLIENT_SECRET=your_github_client_secret
   BETTER_AUTH_SECRET=a_random_32_character_string
   BETTER_AUTH_URL=http://localhost:3000
   ```

   > To get GitHub OAuth credentials, create a new OAuth App in [GitHub Developer Settings](https://github.com/settings/developers) with the callback URL set to `http://localhost:3000/api/auth/callback/github`.

4. **Run database migrations**

   ```bash
   pnpm --filter dashboard migrate
   ```

5. **Start the dev server**

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

- [x] GitHub OAuth authentication
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
