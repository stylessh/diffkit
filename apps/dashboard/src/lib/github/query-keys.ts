import type {
	CommandPaletteSearchInput,
	RepoTemplateKind,
	WorkflowRunListStatus,
} from "../github.functions";
import type {
	RepoBranchesListInput,
	RepoCommitsInput,
	RepoRefNamesInput,
	RepoRefSplatInput,
	RepoReleaseInput,
	RepoReleasesInput,
	RepoTagsListInput,
} from "../github.types";
import type { ReposHubInput } from "../repos-hub-filter";

type RepoState = "all" | "closed" | "open";
type PullSort = "created" | "long-running" | "popularity" | "updated";
type IssueSort = "comments" | "created" | "updated";
type PullSearchRole =
	| "all"
	| "assigned"
	| "author"
	| "involved"
	| "mentioned"
	| "review-requested";
type IssueSearchRole = "all" | "assigned" | "author" | "mentioned";

export type GitHubQueryScope = {
	userId: string;
};

export type RepoSettingsInput = { owner: string; repo: string };

export type PullsFromUserQueryInput = {
	username?: string;
	state?: RepoState;
	page?: number;
	perPage?: number;
	role?: PullSearchRole;
	owner?: string;
	repo?: string;
};

export type IssuesFromUserQueryInput = {
	username?: string;
	state?: RepoState;
	page?: number;
	perPage?: number;
	role?: IssueSearchRole;
	owner?: string;
	repo?: string;
};

export type PullsFromRepoQueryInput = {
	owner: string;
	repo: string;
	state?: RepoState;
	page?: number;
	perPage?: number;
	sort?: PullSort;
	direction?: "asc" | "desc";
};

export type PullFromRepoQueryInput = {
	owner: string;
	repo: string;
	pullNumber: number;
};

export type IssuesFromRepoQueryInput = {
	owner: string;
	repo: string;
	state?: RepoState;
	page?: number;
	perPage?: number;
	sort?: IssueSort;
	direction?: "asc" | "desc";
};

export type IssueFromRepoQueryInput = {
	owner: string;
	repo: string;
	issueNumber: number;
};

export type WorkflowRunQueryInput = {
	owner: string;
	repo: string;
	runId: number;
};

export type WorkflowRunsFromRepoQueryInput = {
	owner: string;
	repo: string;
	page?: number;
	perPage?: number;
	status?: WorkflowRunListStatus;
	event?: string;
	branch?: string;
	actor?: string;
	workflowId?: number;
};

export type WorkflowDefinitionQueryInput = {
	owner: string;
	repo: string;
	path: string;
	ref: string;
};

export type WorkflowJobLogsQueryInput = {
	owner: string;
	repo: string;
	jobId: number;
};

export type WorkflowRunLogsBundleQueryInput = {
	owner: string;
	repo: string;
	runId: number;
	attempt?: number;
};

/**
 * Version of every persisted GitHub query payload. The IndexedDB cache is
 * wiped on restore when this changes, so bump it whenever a server function's
 * return shape changes in a way old cached data would break (e.g. #191 added
 * head/base refs to pull summaries and had to version `pulls.repo` as `v2`).
 * Format: an integer, incremented by one.
 */
export const QUERY_SCHEMA_VERSION = 1;

/**
 * Query groups that are never written to the persisted client cache. Every
 * other `["github", userId, ...]` query persists. Entries are
 * `[group]` or `[group, name]`, matching `queryKey[2]` and `queryKey[3]`.
 */
export const githubQueryPersistOptOut = [
	// Large blobs: PR patches, file contents, commit and compare diffs, logs.
	["pulls", "files"],
	["repo", "fileContent"],
	["repo", "commit"],
	["repo", "compareDetail"],
	["actions", "workflowJobLogs"],
	["actions", "workflowRunLogsBundle"],
	// Private, unsent content: pending review comment bodies.
	["reviewDrafts"],
	// Transient, per-keystroke results.
	["search", "commandPalette"],
	// Payload URLs often embed tokens.
	["repoSettings", "webhooks"],
	["repoSettings", "webhookDeliveries"],
] as const satisfies ReadonlyArray<
	readonly [string] | readonly [string, string]
>;

export function isGitHubQueryKeyPersistable(queryKey: readonly unknown[]) {
	if (queryKey[0] !== "github" || typeof queryKey[1] !== "string") {
		return false;
	}
	const group = queryKey[2];
	const name = queryKey[3];
	return !githubQueryPersistOptOut.some((entry) =>
		entry.length === 1
			? entry[0] === group
			: entry[0] === group && entry[1] === name,
	);
}

export const githubQueryKeys = {
	all: ["github"] as const,
	viewer: (scope: GitHubQueryScope) =>
		["github", scope.userId, "viewer"] as const,
	repos: {
		list: (scope: GitHubQueryScope) =>
			["github", scope.userId, "repos", "list"] as const,
		hub: (scope: GitHubQueryScope, input: ReposHubInput) =>
			["github", scope.userId, "repos", "hub", input] as const,
	},
	search: {
		commandPalette: (
			scope: GitHubQueryScope,
			input: CommandPaletteSearchInput,
		) => ["github", scope.userId, "search", "commandPalette", input] as const,
	},
	pulls: {
		mine: (scope: GitHubQueryScope) =>
			["github", scope.userId, "pulls", "mine"] as const,
		user: (scope: GitHubQueryScope, input: PullsFromUserQueryInput) =>
			["github", scope.userId, "pulls", "user", input] as const,
		repo: (scope: GitHubQueryScope, input: PullsFromRepoQueryInput) =>
			["github", scope.userId, "pulls", "repo", input] as const,
		forRefs: (
			scope: GitHubQueryScope,
			input: { owner: string; repo: string; base: string; head: string },
		) => ["github", scope.userId, "pulls", "forRefs", input] as const,
		page: (scope: GitHubQueryScope, input: PullFromRepoQueryInput) =>
			["github", scope.userId, "pulls", "page", input] as const,
		detail: (scope: GitHubQueryScope, input: PullFromRepoQueryInput) =>
			["github", scope.userId, "pulls", "detail", input] as const,
		fileSummaries: (scope: GitHubQueryScope, input: PullFromRepoQueryInput) =>
			["github", scope.userId, "pulls", "fileSummaries", input] as const,
		comments: (scope: GitHubQueryScope, input: PullFromRepoQueryInput) =>
			["github", scope.userId, "pulls", "comments", input] as const,
		status: (scope: GitHubQueryScope, input: PullFromRepoQueryInput) =>
			["github", scope.userId, "pulls", "status", input] as const,
		files: (scope: GitHubQueryScope, input: PullFromRepoQueryInput) =>
			["github", scope.userId, "pulls", "files", input] as const,
		reviewComments: (scope: GitHubQueryScope, input: PullFromRepoQueryInput) =>
			["github", scope.userId, "pulls", "reviewComments", input] as const,
		reviewThreads: (scope: GitHubQueryScope, input: PullFromRepoQueryInput) =>
			["github", scope.userId, "pulls", "reviewThreads", input] as const,
	},
	collaborators: (
		scope: GitHubQueryScope,
		input: { owner: string; repo: string },
	) => ["github", scope.userId, "collaborators", input] as const,
	repoLabels: (
		scope: GitHubQueryScope,
		input: { owner: string; repo: string },
	) => ["github", scope.userId, "repoLabels", input] as const,
	repoMilestones: (
		scope: GitHubQueryScope,
		input: { owner: string; repo: string },
	) => ["github", scope.userId, "repoMilestones", input] as const,
	orgTeams: (
		scope: GitHubQueryScope,
		input: { org: string; owner: string; repo: string },
	) => ["github", scope.userId, "orgTeams", input] as const,
	commentPage: (
		scope: GitHubQueryScope,
		input: { owner: string; repo: string; issueNumber: number; page: number },
	) => ["github", scope.userId, "commentPage", input] as const,
	timelineEventPage: (
		scope: GitHubQueryScope,
		input: { owner: string; repo: string; issueNumber: number; page: number },
	) => ["github", scope.userId, "timelineEventPage", input] as const,
	profile: (scope: GitHubQueryScope, username: string) =>
		["github", scope.userId, "profile", username] as const,
	profileRepos: (scope: GitHubQueryScope, username: string) =>
		["github", scope.userId, "profileRepos", username] as const,
	contributions: (scope: GitHubQueryScope, username: string) =>
		["github", scope.userId, "contributions", username] as const,
	pinnedRepos: (scope: GitHubQueryScope, username: string) =>
		["github", scope.userId, "pinnedRepos", username] as const,
	activity: (scope: GitHubQueryScope, username: string) =>
		["github", scope.userId, "activity", username] as const,
	repo: {
		overview: (
			scope: GitHubQueryScope,
			input: { owner: string; repo: string },
		) => ["github", scope.userId, "repo", "overview", input] as const,
		branches: (
			scope: GitHubQueryScope,
			input: { owner: string; repo: string },
		) => ["github", scope.userId, "repo", "branches", input] as const,
		branchComparison: (
			scope: GitHubQueryScope,
			input: { owner: string; repo: string; base: string; head: string },
		) => ["github", scope.userId, "repo", "branchComparison", input] as const,
		compareDetail: (
			scope: GitHubQueryScope,
			input: { owner: string; repo: string; base: string; head: string },
		) => ["github", scope.userId, "repo", "compareDetail", input] as const,
		recentPushableBranch: (
			scope: GitHubQueryScope,
			input: { owner: string; repo: string },
		) =>
			["github", scope.userId, "repo", "recentPushableBranch", input] as const,
		template: (
			scope: GitHubQueryScope,
			input: { owner: string; repo: string; kind: RepoTemplateKind },
		) => ["github", scope.userId, "repo", "template", input] as const,
		tree: (
			scope: GitHubQueryScope,
			input: { owner: string; repo: string; ref: string; path: string },
		) => ["github", scope.userId, "repo", "tree", input] as const,
		fileContent: (
			scope: GitHubQueryScope,
			input: { owner: string; repo: string; ref: string; path: string },
		) => ["github", scope.userId, "repo", "fileContent", input] as const,
		fileLastCommit: (
			scope: GitHubQueryScope,
			input: { owner: string; repo: string; ref: string; path: string },
		) => ["github", scope.userId, "repo", "fileLastCommit", input] as const,
		commit: (
			scope: GitHubQueryScope,
			input: { owner: string; repo: string; sha: string },
		) => ["github", scope.userId, "repo", "commit", input] as const,
		refHeadCommit: (
			scope: GitHubQueryScope,
			input: { owner: string; repo: string; ref: string },
		) => ["github", scope.userId, "repo", "refHeadCommit", input] as const,
		treeEntryCommits: (
			scope: GitHubQueryScope,
			input: { owner: string; repo: string; ref: string; dirPath: string },
		) => ["github", scope.userId, "repo", "treeEntryCommits", input] as const,
		contributors: (
			scope: GitHubQueryScope,
			input: { owner: string; repo: string },
		) => ["github", scope.userId, "repo", "contributors", input] as const,
		participation: (
			scope: GitHubQueryScope,
			input: { owner: string; repo: string },
		) => ["github", scope.userId, "repo", "participation", input] as const,
		discussions: (
			scope: GitHubQueryScope,
			input: { owner: string; repo: string },
		) => ["github", scope.userId, "repo", "discussions", input] as const,
	},
	issues: {
		mine: (scope: GitHubQueryScope) =>
			["github", scope.userId, "issues", "mine"] as const,
		user: (scope: GitHubQueryScope, input: IssuesFromUserQueryInput) =>
			["github", scope.userId, "issues", "user", input] as const,
		repo: (scope: GitHubQueryScope, input: IssuesFromRepoQueryInput) =>
			["github", scope.userId, "issues", "repo", input] as const,
		page: (scope: GitHubQueryScope, input: IssueFromRepoQueryInput) =>
			["github", scope.userId, "issues", "page", input] as const,
		detail: (scope: GitHubQueryScope, input: IssueFromRepoQueryInput) =>
			["github", scope.userId, "issues", "detail", input] as const,
		comments: (scope: GitHubQueryScope, input: IssueFromRepoQueryInput) =>
			["github", scope.userId, "issues", "comments", input] as const,
	},
	notifications: {
		list: (
			scope: GitHubQueryScope,
			input: { all?: boolean; participating?: boolean },
		) => ["github", scope.userId, "notifications", "list", input] as const,
	},
	actions: {
		runsList: (
			scope: GitHubQueryScope,
			input: WorkflowRunsFromRepoQueryInput,
		) => ["github", scope.userId, "actions", "runsList", input] as const,
		workflowRun: (scope: GitHubQueryScope, input: WorkflowRunQueryInput) =>
			["github", scope.userId, "actions", "workflowRun", input] as const,
		workflowRunJobs: (scope: GitHubQueryScope, input: WorkflowRunQueryInput) =>
			["github", scope.userId, "actions", "workflowRunJobs", input] as const,
		workflowRunArtifacts: (
			scope: GitHubQueryScope,
			input: WorkflowRunQueryInput,
		) =>
			[
				"github",
				scope.userId,
				"actions",
				"workflowRunArtifacts",
				input,
			] as const,
		workflowDefinition: (
			scope: GitHubQueryScope,
			input: WorkflowDefinitionQueryInput,
		) =>
			["github", scope.userId, "actions", "workflowDefinition", input] as const,
		workflowJobLogs: (
			scope: GitHubQueryScope,
			input: WorkflowJobLogsQueryInput,
		) => ["github", scope.userId, "actions", "workflowJobLogs", input] as const,
		workflowRunLogsBundle: (
			scope: GitHubQueryScope,
			input: WorkflowRunLogsBundleQueryInput,
		) =>
			[
				"github",
				scope.userId,
				"actions",
				"workflowRunLogsBundle",
				input,
			] as const,
	},
	commits: {
		list: (scope: GitHubQueryScope, input: RepoCommitsInput) =>
			["github", scope.userId, "commits", "list", input] as const,
	},
	releases: {
		repo: (scope: GitHubQueryScope, input: { owner: string; repo: string }) =>
			["github", scope.userId, "releases", "repo", input] as const,
		list: (scope: GitHubQueryScope, input: RepoReleasesInput) =>
			[
				"github",
				scope.userId,
				"releases",
				"repo",
				{ owner: input.owner, repo: input.repo },
				"list",
				input,
			] as const,
		detail: (scope: GitHubQueryScope, input: RepoReleaseInput) =>
			[
				"github",
				scope.userId,
				"releases",
				"repo",
				{ owner: input.owner, repo: input.repo },
				"detail",
				input,
			] as const,
		viewerPermission: (
			scope: GitHubQueryScope,
			input: { owner: string; repo: string },
		) =>
			["github", scope.userId, "releases", "viewerPermission", input] as const,
	},
	refs: {
		names: (scope: GitHubQueryScope, input: RepoRefNamesInput) =>
			["github", scope.userId, "refs", "names", input] as const,
		branches: (
			scope: GitHubQueryScope,
			input: Omit<RepoBranchesListInput, "after">,
		) => ["github", scope.userId, "refs", "branches", input] as const,
		tags: (scope: GitHubQueryScope, input: Omit<RepoTagsListInput, "after">) =>
			["github", scope.userId, "refs", "tags", input] as const,
		comparison: (
			scope: GitHubQueryScope,
			input: { owner: string; repo: string; base: string; head: string },
		) => ["github", scope.userId, "refs", "comparison", input] as const,
		splat: (scope: GitHubQueryScope, input: RepoRefSplatInput) =>
			["github", scope.userId, "refs", "splat", input] as const,
	},
	reviewDrafts: {
		mine: (scope: GitHubQueryScope) =>
			["github", scope.userId, "reviewDrafts", "mine"] as const,
	},
	repoSettings: {
		general: (scope: GitHubQueryScope, input: RepoSettingsInput) =>
			["github", scope.userId, "repoSettings", "general", input] as const,
		rulesets: (scope: GitHubQueryScope, input: RepoSettingsInput) =>
			["github", scope.userId, "repoSettings", "rulesets", input] as const,
		protections: (scope: GitHubQueryScope, input: RepoSettingsInput) =>
			["github", scope.userId, "repoSettings", "protections", input] as const,
		access: (scope: GitHubQueryScope, input: RepoSettingsInput) =>
			["github", scope.userId, "repoSettings", "access", input] as const,
		webhooks: (scope: GitHubQueryScope, input: RepoSettingsInput) =>
			["github", scope.userId, "repoSettings", "webhooks", input] as const,
		webhookDeliveries: (
			scope: GitHubQueryScope,
			input: RepoSettingsInput & { hookId: number },
		) =>
			[
				"github",
				scope.userId,
				"repoSettings",
				"webhookDeliveries",
				input,
			] as const,
		actionsSecrets: (scope: GitHubQueryScope, input: RepoSettingsInput) =>
			[
				"github",
				scope.userId,
				"repoSettings",
				"actionsSecrets",
				input,
			] as const,
		actionsVariables: (scope: GitHubQueryScope, input: RepoSettingsInput) =>
			[
				"github",
				scope.userId,
				"repoSettings",
				"actionsVariables",
				input,
			] as const,
	},
};
