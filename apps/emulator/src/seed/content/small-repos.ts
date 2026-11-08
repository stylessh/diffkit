import type { RepoSpec } from "../types.ts";

const handbookReadme = `# Lumen Labs Handbook

How we work: onboarding, releases, on-call and the architecture behind our
realtime platform.

- [Onboarding](docs/onboarding.md)
- [Release process](docs/release-process.md)
- [Architecture](docs/architecture/overview.md)
- [Writing style](docs/style-guide.md)
`;

const onboarding = `# Onboarding

Welcome! Your first week:

1. Get access to GitHub, the status page and the incident channel.
2. Pair with your onboarding buddy on a small fix in \`beacon\`.
3. Read the [architecture overview](architecture/overview.md).
4. Ship something to production by Friday — small is fine.

## Accounts

| System        | Who grants it   |
| ------------- | --------------- |
| GitHub org    | Your manager    |
| Cloudflare    | @sam-okafor     |
| Status page   | @lena-fischer   |
`;

const releaseProcess = `# Release process

We release \`beacon\` from \`main\` with semver tags.

1. Open a release PR that bumps \`package.json\` and updates \`CHANGELOG.md\`.
2. Merge once CI is green and one maintainer approved.
3. Tag \`vX.Y.Z\` on the merge commit and publish a GitHub release.
4. The *Release* workflow publishes to npm with provenance.

Pre-releases use \`-beta.N\` and are marked as pre-release on GitHub.
`;

const architecture = `# Architecture overview

\`\`\`
browser ──▶ beacon client ──▶ edge relay (Workers) ──▶ fan-out (Durable Objects)
                                     │
                                     └──▶ event log (R2)
\`\`\`

- **beacon** — the client library. Reconnects with jittered backoff.
- **Edge relay** — terminates WebSockets/SSE close to users.
- **Fan-out** — one Durable Object per channel keeps subscriber lists.
`;

const realtime = `# Realtime delivery guarantees

Events are delivered **at least once** and **in order per channel**.

Clients deduplicate by \`event.id\`. Buffers hold the last 500 events per
channel for 10 minutes so reconnecting clients can catch up.
`;

const styleGuide = `# Writing style

- Prefer short sentences and active voice.
- Write for someone on their first week.
- Use sentence case for headings.
- Code, commands and file names go in \`backticks\`.
`;

const onCall = `# On-call

We run a weekly rotation, Monday 10:00 to Monday 10:00 (Europe/Berlin).

## Escalation

1. **Page** — PagerDuty pages the primary.
2. **15 minutes** without ack → secondary is paged.
3. **30 minutes** → the engineering manager on duty (@nova this quarter).

## During an incident

- Open a thread in the incident channel and post the status page link.
- Assign an incident commander; they don't debug, they coordinate.
- Write the post-mortem within 3 working days.
`;

const mkdocs = `site_name: Lumen Labs Handbook
theme:
  name: material
nav:
  - Home: README.md
  - Onboarding: docs/onboarding.md
  - Release process: docs/release-process.md
  - Architecture:
      - Overview: docs/architecture/overview.md
      - Realtime: docs/architecture/realtime.md
  - Style guide: docs/style-guide.md
`;

export const handbook: RepoSpec = {
	owner: "lumen-labs",
	name: "handbook",
	description:
		"How Lumen Labs works: onboarding, releases, on-call and architecture.",
	language: "Markdown",
	languages: { Markdown: 14_022 },
	topics: ["handbook", "documentation", "engineering-culture"],
	license: {
		key: "cc-by-4.0",
		name: "Creative Commons Attribution 4.0",
		spdx_id: "CC-BY-4.0",
	},
	stars: 57,
	forks: 4,
	watchers: 9,
	labels: [
		{ name: "docs", color: "0075ca" },
		{ name: "process", color: "c2e0c6" },
		{ name: "typo", color: "fef2c0" },
	],
	commits: [
		{
			message: "Start the handbook",
			author: "lena-fischer",
			at: { d: 68, h: 5 },
			files: { "README.md": handbookReadme, "mkdocs.yml": mkdocs },
		},
		{
			message: "Write onboarding guide",
			author: "lena-fischer",
			at: { d: 64, h: 3 },
			files: { "docs/onboarding.md": onboarding },
		},
		{
			message: "Document the release process",
			author: "nova",
			at: { d: 47, h: 6 },
			files: { "docs/release-process.md": releaseProcess },
		},
		{
			message: "Add architecture overview",
			author: "jun-park",
			at: { d: 31, h: 2 },
			files: {
				"docs/architecture/overview.md": architecture,
				"docs/architecture/realtime.md": realtime,
			},
		},
		{
			message: "Add writing style guide",
			author: "priya-rao",
			at: { d: 17, h: 8 },
			files: { "docs/style-guide.md": styleGuide },
		},
	],
	branches: [
		{
			name: "docs/on-call",
			commits: [
				{
					message: "Document on-call escalation",
					author: "lena-fischer",
					at: { d: 2, h: 9 },
					files: {
						"docs/on-call.md": onCall,
						"mkdocs.yml": mkdocs.replace(
							"  - Style guide: docs/style-guide.md\n",
							"  - On-call: docs/on-call.md\n  - Style guide: docs/style-guide.md\n",
						),
					},
				},
			],
		},
	],
	issues: [
		{
			key: "postmortems",
			title: "Add a post-mortem template",
			author: "lena-fischer",
			at: { d: 9, h: 4 },
			labels: ["process"],
			assignees: ["lena-fischer"],
			body: "We keep reinventing the structure. Timeline, impact, root cause, action items.",
		},
		{
			key: "typo",
			title: 'Typo in release process: "provenence"',
			author: "theo-martin",
			at: { d: 30, h: 7 },
			labels: ["typo"],
			state: "closed",
			stateReason: "completed",
			closedAt: { d: 29, h: 2 },
			body: 'Step 4 says "provenence".',
		},
	],
	pulls: [
		{
			head: "docs/on-call",
			title: "Document on-call escalation",
			author: "lena-fischer",
			at: { d: 2, h: 8 },
			labels: ["docs", "process"],
			reviewers: ["sam-okafor"],
			body: "Writes down what we've been doing informally.\n\n@nova you're listed as the escalation point this quarter — can you confirm the 30-minute threshold?",
			comments: [
				{
					author: "sam-okafor",
					at: { d: 1, h: 6 },
					body: "Can we mention the status page in step 1? People forget.",
				},
			],
		},
	],
};

const infraMain = `terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
  }
}

resource "cloudflare_workers_script" "relay" {
  account_id  = var.account_id
  script_name = "beacon-relay"
  content     = file("\${path.module}/dist/relay.js")
}
`;

const infraVars = `variable "account_id" {
  type        = string
  description = "Cloudflare account that owns the relay"
}
`;

export const infra: RepoSpec = {
	owner: "lumen-labs",
	name: "infra",
	description: "Terraform for the edge relay and supporting services.",
	private: true,
	language: "HCL",
	languages: { HCL: 3_840, Shell: 610 },
	topics: ["terraform", "cloudflare"],
	stars: 3,
	forks: 0,
	watchers: 4,
	labels: [{ name: "ops", color: "bfd4f2" }],
	commits: [
		{
			message: "Bootstrap Terraform for the relay",
			author: "sam-okafor",
			at: { d: 52, h: 4 },
			files: {
				"README.md":
					"# infra\n\nTerraform for Lumen Labs. Apply from CI only.\n",
				"main.tf": infraMain,
				"variables.tf": infraVars,
			},
		},
	],
	issues: [
		{
			key: "tls",
			title: "Rotate staging TLS certificates before they expire",
			author: "sam-okafor",
			at: { d: 6, h: 3 },
			labels: ["ops"],
			assignees: ["nova", "sam-okafor"],
			body: "Staging certs expire in 12 days. Let's move them to managed certificates while we're at it.",
		},
	],
};

export const dotfiles: RepoSpec = {
	owner: "nova",
	name: "dotfiles",
	description: "zsh, git and editor config.",
	language: "Shell",
	languages: { Shell: 2_410 },
	topics: ["dotfiles", "zsh"],
	license: { key: "mit", name: "MIT License", spdx_id: "MIT" },
	stars: 12,
	forks: 2,
	watchers: 1,
	commits: [
		{
			message: "Initial dotfiles",
			author: "nova",
			at: { d: 80, h: 2 },
			files: {
				"README.md": "# dotfiles\n\n```sh\n./install.sh\n```\n",
				".zshrc":
					'export EDITOR="nvim"\nalias g="git"\nalias gs="git status -sb"\n',
				".gitconfig": "[user]\n\tname = Nova Reyes\n[pull]\n\trebase = true\n",
				"install.sh":
					'#!/usr/bin/env bash\nset -euo pipefail\nln -sf "$PWD/.zshrc" ~/.zshrc\nln -sf "$PWD/.gitconfig" ~/.gitconfig\n',
			},
		},
		{
			message: "Add fzf keybindings",
			author: "nova",
			at: { d: 15, h: 3 },
			files: {
				".zshrc":
					'export EDITOR="nvim"\nalias g="git"\nalias gs="git status -sb"\n[ -f ~/.fzf.zsh ] && source ~/.fzf.zsh\n',
			},
		},
	],
	issues: [
		{
			key: "mac-install",
			title: "install.sh should not overwrite existing files",
			author: "nova",
			at: { d: 14, h: 1 },
			body: "Back up `~/.zshrc` to `~/.zshrc.bak` before linking.",
		},
	],
};
