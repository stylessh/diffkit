import type { GitHubLabel } from "#/lib/github.types";
import type { RepoAccess } from "#/lib/settings/access";
import type {
	RepoActionsSecret,
	RepoActionsVariable,
} from "#/lib/settings/actions-config";
import type { RepoGeneralSettings } from "#/lib/settings/repo-general";
import type { BranchProtection, RepoRuleset } from "#/lib/settings/rules";
import type { RepoWebhook, WebhookDelivery } from "#/lib/settings/webhooks";

export const SAMPLE_REPO_GENERAL_SETTINGS: RepoGeneralSettings = {
	owner: "acme-labs",
	name: "dashboard",
	fullName: "acme-labs/dashboard",
	htmlUrl: "",
	visibility: "private",
	isArchived: false,
	isFork: false,
	isOrgOwned: true,
	description: "The web dashboard for reviewing pull requests",
	homepage: "https://acme.dev",
	defaultBranch: "main",
	hasIssues: true,
	hasWiki: false,
	hasDiscussions: false,
	allowSquashMerge: true,
	allowMergeCommit: false,
	allowRebaseMerge: true,
	allowAutoMerge: true,
	allowUpdateBranch: true,
	deleteBranchOnMerge: true,
};

export const SAMPLE_REPO_ACCESS: RepoAccess = {
	collaborators: [
		{
			status: "active",
			login: "octocat",
			avatarUrl: "",
			role: "admin",
			roleLabel: "Admin",
		},
		{
			status: "active",
			login: "hubot",
			avatarUrl: "",
			role: "write",
			roleLabel: "Write",
		},
		{
			status: "active",
			login: "monalisa",
			avatarUrl: "",
			role: "triage",
			roleLabel: "Triage",
		},
	],
	teams: [
		{
			id: 1,
			slug: "platform",
			name: "Platform",
			description: null,
			role: "maintain",
			isSecret: false,
			htmlUrl: null,
		},
	],
	teamsAvailable: true,
	addableTeams: [],
};

const sampleWebhook = (
	id: number,
	url: string,
	events: string[],
): RepoWebhook => ({
	id,
	url,
	contentType: "json",
	hasSecret: true,
	insecureSsl: false,
	events,
	active: true,
	updatedAt: null,
	health: { kind: "ok", code: 200 },
});

export const SAMPLE_WEBHOOKS: RepoWebhook[] = [
	sampleWebhook(1, "https://ci.acme.dev/hooks/github", ["push"]),
	sampleWebhook(2, "https://chat.acme.dev/integrations/github", [
		"pull_request",
		"issues",
	]),
];

export const SAMPLE_WEBHOOK_DELIVERIES: WebhookDelivery[] = [
	{
		id: 1,
		event: "push",
		action: null,
		status: "OK",
		statusCode: 200,
		deliveredAt: "2026-01-01T12:00:00Z",
		durationSeconds: 0.4,
		redelivery: false,
	},
	{
		id: 2,
		event: "pull_request",
		action: "opened",
		status: "OK",
		statusCode: 200,
		deliveredAt: "2026-01-01T11:00:00Z",
		durationSeconds: 0.3,
		redelivery: false,
	},
];

export const SAMPLE_LABELS: GitHubLabel[] = [
	{ name: "bug", color: "d73a4a", description: "Something isn't working" },
	{
		name: "enhancement",
		color: "a2eeef",
		description: "New feature or request",
	},
	{
		name: "documentation",
		color: "0075ca",
		description: "Improvements or additions to documentation",
	},
	{
		name: "good first issue",
		color: "7057ff",
		description: "Good for newcomers",
	},
	{ name: "dependencies", color: "0366d6", description: null },
];

export const SAMPLE_REPO_RULESETS: RepoRuleset[] = [
	{
		id: 1,
		name: "Protect main",
		target: "branch",
		enforcement: "active",
		inherited: false,
		includes: ["~DEFAULT_BRANCH"],
		excludes: [],
		rules: ["Require a pull request", "Require status checks"],
		bypassActorCount: 0,
		updatedAt: null,
		htmlUrl: null,
	},
];

export const SAMPLE_BRANCH_PROTECTIONS: BranchProtection[] = [
	{ branch: "main", rules: ["Require reviews", "Require linear history"] },
];

export const SAMPLE_ACTIONS_SECRETS: RepoActionsSecret[] = [
	{ name: "DEPLOY_TOKEN", createdAt: null, updatedAt: "2026-10-01T12:00:00Z" },
	{ name: "NPM_TOKEN", createdAt: null, updatedAt: "2026-09-12T12:00:00Z" },
];

export const SAMPLE_ACTIONS_VARIABLES: RepoActionsVariable[] = [
	{
		name: "NODE_VERSION",
		value: "22",
		createdAt: null,
		updatedAt: "2026-10-01T12:00:00Z",
	},
];
