import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import {
	type CommandPaletteSearchInput,
	getBranchComparison,
	getCommentPage,
	getCompareDetail,
	getFileLastCommit,
	getGitHubViewer,
	getIssueComments,
	getIssueFromRepo,
	getIssuePageData,
	getIssuesFromRepo,
	getIssuesFromUser,
	getMyIssues,
	getMyPulls,
	getMyReviewDrafts,
	getNotifications,
	getOrgTeams,
	getProfileRepos,
	getPullComments,
	getPullFileSummaries,
	getPullFiles,
	getPullFromRepo,
	getPullPageData,
	getPullReviewComments,
	getPullStatus,
	getPullsFromRepo,
	getPullsFromUser,
	getRecentPushableBranch,
	getRefHeadCommit,
	getRepoBranches,
	getRepoBranchesList,
	getRepoCollaborators,
	getRepoCommit,
	getRepoCommits,
	getRepoContributors,
	getRepoDiscussions,
	getRepoFileContent,
	getRepoLabels,
	getRepoOverview,
	getRepoParticipationStats,
	getRepoRefNames,
	getRepoRelease,
	getRepoReleases,
	getReposHub,
	getRepoTagsList,
	getRepoTemplate,
	getRepoTree,
	getRepoViewerPermission,
	getReviewThreadStatuses,
	getTimelineEventPage,
	getTreeEntryCommits,
	getUserActivity,
	getUserContributions,
	getUserPinnedRepos,
	getUserProfile,
	getUserRepos,
	getWorkflowDefinition,
	getWorkflowJobLogs,
	getWorkflowRun,
	getWorkflowRunLogsBundle,
	getWorkflowRunsForRepo,
	listWorkflowRunArtifacts,
	listWorkflowRunJobs,
	type RepoTemplateKind,
	resolveRepoRefSplat,
	searchCommandPaletteGitHub,
	type WorkflowRunListStatus,
	workflowZipJobName,
} from "./github.functions";
import type {
	RepoBranchesListInput,
	RepoCommitsInput,
	RepoRefNamesInput,
	RepoRefSplatInput,
	RepoReleaseInput,
	RepoReleasesInput,
	RepoTagsListInput,
} from "./github.types";
import { githubCachePolicy } from "./github-cache-policy";
import {
	type GitHubChangeEntity,
	type GitHubChangeEntityKind,
	normalizeRepoFullName,
	parseEntityKey,
} from "./github-change-entities";
import {
	adaptiveRefetchInterval,
	classifyPullStatus,
	classifyWorkflowJobs,
	classifyWorkflowRun,
} from "./github-refetch-policy";
import { ensureDefinedQueryData } from "./query-data";
import type { ReposHubInput } from "./repos-hub-filter";

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
		/** Prefix for every release query of a repo — invalidate after mutations. */
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
};

export function githubViewerQueryOptions(scope: GitHubQueryScope) {
	return queryOptions({
		queryKey: githubQueryKeys.viewer(scope),
		queryFn: () => getGitHubViewer(),
		staleTime: githubCachePolicy.viewer.staleTimeMs,
		gcTime: githubCachePolicy.viewer.gcTimeMs,
	});
}

export function githubUserReposQueryOptions(scope: GitHubQueryScope) {
	return queryOptions({
		queryKey: githubQueryKeys.repos.list(scope),
		queryFn: () => getUserRepos(),
		staleTime: githubCachePolicy.reposList.staleTimeMs,
		gcTime: githubCachePolicy.reposList.gcTimeMs,
	});
}

export function githubReposHubQueryOptions(
	scope: GitHubQueryScope,
	input: ReposHubInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.repos.hub(scope, input),
		queryFn: () => getReposHub({ data: input }),
		staleTime: githubCachePolicy.reposList.staleTimeMs,
		gcTime: githubCachePolicy.reposList.gcTimeMs,
	});
}

export function githubProfileReposQueryOptions(
	scope: GitHubQueryScope,
	username: string,
) {
	return queryOptions({
		queryKey: githubQueryKeys.profileRepos(scope, username),
		queryFn: () => getProfileRepos({ data: { username } }),
		staleTime: githubCachePolicy.reposList.staleTimeMs,
		gcTime: githubCachePolicy.reposList.gcTimeMs,
	});
}

export function githubCommandPaletteSearchQueryOptions(
	scope: GitHubQueryScope,
	input: CommandPaletteSearchInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.search.commandPalette(scope, input),
		queryFn: () => searchCommandPaletteGitHub({ data: input }),
		staleTime: 30 * 1000,
		gcTime: 5 * 60 * 1000,
	});
}

export function githubMyPullsQueryOptions(scope: GitHubQueryScope) {
	return queryOptions({
		queryKey: githubQueryKeys.pulls.mine(scope),
		queryFn: () => getMyPulls(),
		staleTime: githubCachePolicy.mine.staleTimeMs,
		gcTime: githubCachePolicy.mine.gcTimeMs,
	});
}

export function githubPullsFromUserQueryOptions(
	scope: GitHubQueryScope,
	input: PullsFromUserQueryInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.pulls.user(scope, input),
		queryFn: () => getPullsFromUser({ data: input }),
		staleTime: githubCachePolicy.list.staleTimeMs,
		gcTime: githubCachePolicy.list.gcTimeMs,
	});
}

export function githubPullsFromRepoQueryOptions(
	scope: GitHubQueryScope,
	input: PullsFromRepoQueryInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.pulls.repo(scope, input),
		queryFn: () => getPullsFromRepo({ data: input }),
		staleTime: githubCachePolicy.list.staleTimeMs,
		gcTime: githubCachePolicy.list.gcTimeMs,
	});
}

export function githubPullDetailQueryOptions(
	scope: GitHubQueryScope,
	input: PullFromRepoQueryInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.pulls.detail(scope, input),
		queryFn: () => getPullFromRepo({ data: input }),
		staleTime: githubCachePolicy.detail.staleTimeMs,
		gcTime: githubCachePolicy.detail.gcTimeMs,
	});
}

export function githubPullPageQueryOptions(
	scope: GitHubQueryScope,
	input: PullFromRepoQueryInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.pulls.page(scope, input),
		queryFn: async () => {
			const data = await ensureDefinedQueryData(
				() => getPullPageData({ data: input }),
				"getPullPageData",
			);
			if (!data) {
				throw new Error(
					`Pull request ${input.owner}/${input.repo}#${input.pullNumber} is not accessible. The token may have expired or you may have lost access.`,
				);
			}
			return data;
		},
		staleTime: githubCachePolicy.detail.staleTimeMs,
		gcTime: githubCachePolicy.detail.gcTimeMs,
	});
}

export function githubPullCommentsQueryOptions(
	scope: GitHubQueryScope,
	input: PullFromRepoQueryInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.pulls.comments(scope, input),
		queryFn: () => getPullComments({ data: input }),
		staleTime: githubCachePolicy.activity.staleTimeMs,
		gcTime: githubCachePolicy.activity.gcTimeMs,
	});
}

export function githubPullStatusQueryOptions(
	scope: GitHubQueryScope,
	input: PullFromRepoQueryInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.pulls.status(scope, input),
		queryFn: () => getPullStatus({ data: input }),
		staleTime: githubCachePolicy.status.staleTimeMs,
		gcTime: githubCachePolicy.status.gcTimeMs,
		refetchInterval: adaptiveRefetchInterval(classifyPullStatus),
		refetchIntervalInBackground: false,
	});
}

export const PULL_FILES_PAGE_SIZE = 25;

export function githubPullFilesInfiniteQueryOptions(
	scope: GitHubQueryScope,
	input: PullFromRepoQueryInput,
) {
	return infiniteQueryOptions({
		queryKey: githubQueryKeys.pulls.files(scope, input),
		queryFn: ({ pageParam }) =>
			getPullFiles({
				data: { ...input, page: pageParam, perPage: PULL_FILES_PAGE_SIZE },
			}),
		initialPageParam: 1,
		getNextPageParam: (lastPage) => lastPage.nextPage ?? undefined,
		staleTime: githubCachePolicy.detail.staleTimeMs,
		gcTime: githubCachePolicy.detail.gcTimeMs,
	});
}

export function githubPullFileSummariesQueryOptions(
	scope: GitHubQueryScope,
	input: PullFromRepoQueryInput,
) {
	return infiniteQueryOptions({
		queryKey: githubQueryKeys.pulls.fileSummaries(scope, input),
		queryFn: ({ pageParam }) =>
			getPullFileSummaries({ data: { ...input, cursor: pageParam } }),
		initialPageParam: null as string | null,
		getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
		staleTime: githubCachePolicy.detail.staleTimeMs,
		gcTime: githubCachePolicy.detail.gcTimeMs,
	});
}

export function githubPullReviewCommentsQueryOptions(
	scope: GitHubQueryScope,
	input: PullFromRepoQueryInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.pulls.reviewComments(scope, input),
		queryFn: () => getPullReviewComments({ data: input }),
		staleTime: githubCachePolicy.activity.staleTimeMs,
		gcTime: githubCachePolicy.activity.gcTimeMs,
	});
}

export function githubReviewThreadStatusesQueryOptions(
	scope: GitHubQueryScope,
	input: PullFromRepoQueryInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.pulls.reviewThreads(scope, input),
		queryFn: () => getReviewThreadStatuses({ data: input }),
		staleTime: githubCachePolicy.activity.staleTimeMs,
		gcTime: githubCachePolicy.activity.gcTimeMs,
	});
}

export function githubRepoCollaboratorsQueryOptions(
	scope: GitHubQueryScope,
	input: { owner: string; repo: string },
) {
	return queryOptions({
		queryKey: githubQueryKeys.collaborators(scope, input),
		queryFn: () => getRepoCollaborators({ data: input }),
		staleTime: githubCachePolicy.viewer.staleTimeMs,
		gcTime: githubCachePolicy.viewer.gcTimeMs,
	});
}

export function githubRepoLabelsQueryOptions(
	scope: GitHubQueryScope,
	input: { owner: string; repo: string },
) {
	return queryOptions({
		queryKey: githubQueryKeys.repoLabels(scope, input),
		queryFn: () => getRepoLabels({ data: input }),
		staleTime: githubCachePolicy.viewer.staleTimeMs,
		gcTime: githubCachePolicy.viewer.gcTimeMs,
	});
}

export function githubOrgTeamsQueryOptions(
	scope: GitHubQueryScope,
	input: { org: string; owner: string; repo: string },
) {
	return queryOptions({
		queryKey: githubQueryKeys.orgTeams(scope, input),
		queryFn: () => getOrgTeams({ data: input }),
		staleTime: githubCachePolicy.viewer.staleTimeMs,
		gcTime: githubCachePolicy.viewer.gcTimeMs,
	});
}

export function githubMyIssuesQueryOptions(scope: GitHubQueryScope) {
	return queryOptions({
		queryKey: githubQueryKeys.issues.mine(scope),
		queryFn: () => getMyIssues(),
		staleTime: githubCachePolicy.mine.staleTimeMs,
		gcTime: githubCachePolicy.mine.gcTimeMs,
	});
}

export function githubIssuesFromUserQueryOptions(
	scope: GitHubQueryScope,
	input: IssuesFromUserQueryInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.issues.user(scope, input),
		queryFn: () => getIssuesFromUser({ data: input }),
		staleTime: githubCachePolicy.list.staleTimeMs,
		gcTime: githubCachePolicy.list.gcTimeMs,
	});
}

export function githubIssuesFromRepoQueryOptions(
	scope: GitHubQueryScope,
	input: IssuesFromRepoQueryInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.issues.repo(scope, input),
		queryFn: () => getIssuesFromRepo({ data: input }),
		staleTime: githubCachePolicy.list.staleTimeMs,
		gcTime: githubCachePolicy.list.gcTimeMs,
	});
}

export function githubIssueDetailQueryOptions(
	scope: GitHubQueryScope,
	input: IssueFromRepoQueryInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.issues.detail(scope, input),
		queryFn: () => getIssueFromRepo({ data: input }),
		staleTime: githubCachePolicy.detail.staleTimeMs,
		gcTime: githubCachePolicy.detail.gcTimeMs,
	});
}

export function githubIssuePageQueryOptions(
	scope: GitHubQueryScope,
	input: IssueFromRepoQueryInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.issues.page(scope, input),
		queryFn: () => getIssuePageData({ data: input }),
		staleTime: githubCachePolicy.detail.staleTimeMs,
		gcTime: githubCachePolicy.detail.gcTimeMs,
	});
}

export function githubIssueCommentsQueryOptions(
	scope: GitHubQueryScope,
	input: IssueFromRepoQueryInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.issues.comments(scope, input),
		queryFn: () => getIssueComments({ data: input }),
		staleTime: githubCachePolicy.activity.staleTimeMs,
		gcTime: githubCachePolicy.activity.gcTimeMs,
	});
}

export function githubCommentPageQueryOptions(
	scope: GitHubQueryScope,
	input: { owner: string; repo: string; issueNumber: number; page: number },
) {
	return queryOptions({
		queryKey: githubQueryKeys.commentPage(scope, input),
		queryFn: () => getCommentPage({ data: input }),
		staleTime: githubCachePolicy.activity.staleTimeMs,
		gcTime: githubCachePolicy.activity.gcTimeMs,
	});
}

export function githubTimelineEventPageQueryOptions(
	scope: GitHubQueryScope,
	input: { owner: string; repo: string; issueNumber: number; page: number },
) {
	return queryOptions({
		queryKey: githubQueryKeys.timelineEventPage(scope, input),
		queryFn: () => getTimelineEventPage({ data: input }),
		staleTime: githubCachePolicy.activity.staleTimeMs,
		gcTime: githubCachePolicy.activity.gcTimeMs,
	});
}

export function githubUserProfileQueryOptions(
	scope: GitHubQueryScope,
	username: string,
) {
	return queryOptions({
		queryKey: githubQueryKeys.profile(scope, username),
		queryFn: () => getUserProfile({ data: { username } }),
		staleTime: githubCachePolicy.viewer.staleTimeMs,
		gcTime: githubCachePolicy.viewer.gcTimeMs,
	});
}

export function githubUserContributionsQueryOptions(
	scope: GitHubQueryScope,
	username: string,
) {
	return queryOptions({
		queryKey: githubQueryKeys.contributions(scope, username),
		queryFn: () => getUserContributions({ data: { username } }),
		staleTime: githubCachePolicy.contributions.staleTimeMs,
		gcTime: githubCachePolicy.contributions.gcTimeMs,
	});
}

export function githubUserPinnedReposQueryOptions(
	scope: GitHubQueryScope,
	username: string,
) {
	return queryOptions({
		queryKey: githubQueryKeys.pinnedRepos(scope, username),
		queryFn: () => getUserPinnedRepos({ data: { username } }),
		staleTime: githubCachePolicy.reposList.staleTimeMs,
		gcTime: githubCachePolicy.reposList.gcTimeMs,
	});
}

export function githubUserActivityQueryOptions(
	scope: GitHubQueryScope,
	username: string,
	isOwnProfile: boolean,
) {
	return infiniteQueryOptions({
		queryKey: githubQueryKeys.activity(scope, username),
		queryFn: ({ pageParam }) =>
			getUserActivity({ data: { username, isOwnProfile, page: pageParam } }),
		initialPageParam: 1,
		getNextPageParam: (lastPage, _allPages, lastPageParam) =>
			lastPage.length === 30 ? lastPageParam + 1 : undefined,
		staleTime: githubCachePolicy.userActivity.staleTimeMs,
		gcTime: githubCachePolicy.userActivity.gcTimeMs,
	});
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

// Repo metadata — aggressively cached, revalidated via webhooks
export function githubRepoOverviewQueryOptions(
	scope: GitHubQueryScope,
	input: { owner: string; repo: string },
) {
	return queryOptions({
		queryKey: githubQueryKeys.repo.overview(scope, input),
		queryFn: () => getRepoOverview({ data: input }),
		// Server keeps the repoMeta freshness window (webhooks bust it); the
		// client polls on the list tier, so its staleTime must not exceed that.
		staleTime: githubCachePolicy.list.staleTimeMs,
		gcTime: githubCachePolicy.repoMeta.gcTimeMs,
	});
}

export function githubRepoBranchesQueryOptions(
	scope: GitHubQueryScope,
	input: { owner: string; repo: string },
) {
	return queryOptions({
		queryKey: githubQueryKeys.repo.branches(scope, input),
		queryFn: () => getRepoBranches({ data: input }),
		staleTime: githubCachePolicy.repoMeta.staleTimeMs,
		gcTime: githubCachePolicy.repoMeta.gcTimeMs,
	});
}

export function githubBranchComparisonQueryOptions(
	scope: GitHubQueryScope,
	input: { owner: string; repo: string; base: string; head: string },
) {
	return queryOptions({
		queryKey: githubQueryKeys.repo.branchComparison(scope, input),
		queryFn: () => getBranchComparison({ data: input }),
		staleTime: githubCachePolicy.detail.staleTimeMs,
		gcTime: githubCachePolicy.detail.gcTimeMs,
	});
}

export function githubCompareDetailQueryOptions(
	scope: GitHubQueryScope,
	input: { owner: string; repo: string; base: string; head: string },
) {
	return queryOptions({
		queryKey: githubQueryKeys.repo.compareDetail(scope, input),
		queryFn: () => getCompareDetail({ data: input }),
		staleTime: githubCachePolicy.detail.staleTimeMs,
		gcTime: githubCachePolicy.detail.gcTimeMs,
	});
}

export function githubRecentPushableBranchQueryOptions(
	scope: GitHubQueryScope,
	input: { owner: string; repo: string },
) {
	return queryOptions({
		queryKey: githubQueryKeys.repo.recentPushableBranch(scope, input),
		queryFn: () => getRecentPushableBranch({ data: input }),
		staleTime: githubCachePolicy.detail.staleTimeMs,
		gcTime: githubCachePolicy.detail.gcTimeMs,
	});
}

export function githubRepoTemplateQueryOptions(
	scope: GitHubQueryScope,
	input: { owner: string; repo: string; kind: RepoTemplateKind },
) {
	return queryOptions({
		queryKey: githubQueryKeys.repo.template(scope, input),
		queryFn: () => getRepoTemplate({ data: input }),
		staleTime: githubCachePolicy.repoMeta.staleTimeMs,
		gcTime: githubCachePolicy.repoMeta.gcTimeMs,
	});
}

export function githubRepoParticipationQueryOptions(
	scope: GitHubQueryScope,
	input: { owner: string; repo: string },
) {
	return queryOptions({
		queryKey: githubQueryKeys.repo.participation(scope, input),
		queryFn: () => getRepoParticipationStats({ data: input }),
		staleTime: githubCachePolicy.repoParticipation.staleTimeMs,
		gcTime: githubCachePolicy.repoParticipation.gcTimeMs,
	});
}

export function githubRepoContributorsQueryOptions(
	scope: GitHubQueryScope,
	input: { owner: string; repo: string },
) {
	return queryOptions({
		queryKey: githubQueryKeys.repo.contributors(scope, input),
		queryFn: () => getRepoContributors({ data: input }),
		staleTime: githubCachePolicy.repoMeta.staleTimeMs,
		gcTime: githubCachePolicy.repoMeta.gcTimeMs,
	});
}

// Code content — shorter cache, will be webhook-revalidated on push
export function githubRepoTreeQueryOptions(
	scope: GitHubQueryScope,
	input: { owner: string; repo: string; ref: string; path: string },
) {
	return queryOptions({
		queryKey: githubQueryKeys.repo.tree(scope, input),
		queryFn: () => getRepoTree({ data: input }),
		staleTime: githubCachePolicy.detail.staleTimeMs,
		gcTime: githubCachePolicy.detail.gcTimeMs,
	});
}

export function githubRepoFileContentQueryOptions(
	scope: GitHubQueryScope,
	input: { owner: string; repo: string; ref: string; path: string },
) {
	return queryOptions({
		queryKey: githubQueryKeys.repo.fileContent(scope, input),
		queryFn: () => getRepoFileContent({ data: input }),
		staleTime: githubCachePolicy.repoMeta.staleTimeMs,
		gcTime: githubCachePolicy.repoMeta.gcTimeMs,
	});
}

export function githubFileLastCommitQueryOptions(
	scope: GitHubQueryScope,
	input: { owner: string; repo: string; ref: string; path: string },
) {
	return queryOptions({
		queryKey: githubQueryKeys.repo.fileLastCommit(scope, input),
		queryFn: () => getFileLastCommit({ data: input }),
		staleTime: githubCachePolicy.detail.staleTimeMs,
		gcTime: githubCachePolicy.detail.gcTimeMs,
	});
}

export function githubRepoCommitQueryOptions(
	scope: GitHubQueryScope,
	input: { owner: string; repo: string; sha: string },
) {
	return queryOptions({
		queryKey: githubQueryKeys.repo.commit(scope, input),
		queryFn: () => getRepoCommit({ data: input }),
		staleTime: githubCachePolicy.detail.staleTimeMs,
		gcTime: githubCachePolicy.detail.gcTimeMs,
	});
}

export function githubRefHeadCommitQueryOptions(
	scope: GitHubQueryScope,
	input: { owner: string; repo: string; ref: string },
) {
	return queryOptions({
		queryKey: githubQueryKeys.repo.refHeadCommit(scope, input),
		queryFn: () => getRefHeadCommit({ data: input }),
		staleTime: githubCachePolicy.detail.staleTimeMs,
		gcTime: githubCachePolicy.detail.gcTimeMs,
	});
}

export function githubTreeEntryCommitsQueryOptions(
	scope: GitHubQueryScope,
	input: {
		owner: string;
		repo: string;
		ref: string;
		dirPath: string;
		entries: string[];
	},
) {
	return queryOptions({
		queryKey: githubQueryKeys.repo.treeEntryCommits(scope, {
			owner: input.owner,
			repo: input.repo,
			ref: input.ref,
			dirPath: input.dirPath,
		}),
		queryFn: () => getTreeEntryCommits({ data: input }),
		staleTime: githubCachePolicy.detail.staleTimeMs,
		gcTime: githubCachePolicy.detail.gcTimeMs,
		enabled: input.entries.length > 0,
	});
}

export function githubRepoDiscussionsQueryOptions(
	scope: GitHubQueryScope,
	input: { owner: string; repo: string },
) {
	return queryOptions({
		queryKey: githubQueryKeys.repo.discussions(scope, input),
		queryFn: () => getRepoDiscussions({ data: input }),
		staleTime: githubCachePolicy.list.staleTimeMs,
		gcTime: githubCachePolicy.list.gcTimeMs,
	});
}

export function githubNotificationsQueryOptions(
	scope: GitHubQueryScope,
	input: { all?: boolean; participating?: boolean } = {},
) {
	return queryOptions({
		queryKey: githubQueryKeys.notifications.list(scope, input),
		queryFn: () => getNotifications({ data: input }),
		staleTime: githubCachePolicy.list.staleTimeMs,
		gcTime: githubCachePolicy.list.gcTimeMs,
	});
}

export function githubWorkflowRunsFromRepoQueryOptions(
	scope: GitHubQueryScope,
	input: WorkflowRunsFromRepoQueryInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.actions.runsList(scope, input),
		queryFn: () => getWorkflowRunsForRepo({ data: input }),
		staleTime: githubCachePolicy.workflowRun.staleTimeMs,
		gcTime: githubCachePolicy.workflowRun.gcTimeMs,
	});
}

export function githubWorkflowRunQueryOptions(
	scope: GitHubQueryScope,
	input: WorkflowRunQueryInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.actions.workflowRun(scope, input),
		queryFn: () => getWorkflowRun({ data: input }),
		staleTime: githubCachePolicy.workflowRun.staleTimeMs,
		gcTime: githubCachePolicy.workflowRun.gcTimeMs,
		refetchInterval: adaptiveRefetchInterval(classifyWorkflowRun),
		refetchIntervalInBackground: false,
	});
}

export function githubWorkflowRunJobsQueryOptions(
	scope: GitHubQueryScope,
	input: WorkflowRunQueryInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.actions.workflowRunJobs(scope, input),
		queryFn: () => listWorkflowRunJobs({ data: input }),
		staleTime: githubCachePolicy.workflowRun.staleTimeMs,
		gcTime: githubCachePolicy.workflowRun.gcTimeMs,
		refetchInterval: adaptiveRefetchInterval(classifyWorkflowJobs),
		refetchIntervalInBackground: false,
	});
}

export function githubWorkflowRunArtifactsQueryOptions(
	scope: GitHubQueryScope,
	input: WorkflowRunQueryInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.actions.workflowRunArtifacts(scope, input),
		queryFn: () => listWorkflowRunArtifacts({ data: input }),
		staleTime: githubCachePolicy.workflowRun.staleTimeMs,
		gcTime: githubCachePolicy.workflowRun.gcTimeMs,
	});
}

export function githubWorkflowDefinitionQueryOptions(
	scope: GitHubQueryScope,
	input: WorkflowDefinitionQueryInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.actions.workflowDefinition(scope, input),
		queryFn: () => getWorkflowDefinition({ data: input }),
		staleTime: githubCachePolicy.detail.staleTimeMs,
		gcTime: githubCachePolicy.detail.gcTimeMs,
	});
}

export function githubWorkflowJobLogsQueryOptions(
	scope: GitHubQueryScope,
	input: WorkflowJobLogsQueryInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.actions.workflowJobLogs(scope, input),
		queryFn: () => getWorkflowJobLogs({ data: input }),
		staleTime: 2 * 1000,
		gcTime: 60 * 1000,
	});
}

/**
 * Bundle of per-step logs derived from the run-level zip.
 *
 * Only meaningful for completed runs — the `/actions/runs/{runId}/logs`
 * endpoint returns 404 / 410 (mapped to `notAvailable: true`) until the run
 * finishes. Once completed, the data is immutable, so we cache aggressively.
 */
export function githubWorkflowRunLogsBundleQueryOptions(
	scope: GitHubQueryScope,
	input: WorkflowRunLogsBundleQueryInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.actions.workflowRunLogsBundle(scope, input),
		queryFn: () => getWorkflowRunLogsBundle({ data: input }),
		staleTime: 60 * 60 * 1000,
		gcTime: 4 * 60 * 60 * 1000,
	});
}

/** Re-exported so client code can compute the sanitized job-name lookup key
 *  the same way the server stores entries in the bundle. */
export { workflowZipJobName };

// ---------------------------------------------------------------------------
// Repository commits, releases, branches and tags
// ---------------------------------------------------------------------------

export const REPO_COMMITS_PER_PAGE = 35;
export const REPO_RELEASES_PER_PAGE = 10;

export function githubRepoCommitsQueryOptions(
	scope: GitHubQueryScope,
	input: RepoCommitsInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.commits.list(scope, input),
		queryFn: () => getRepoCommits({ data: input }),
		staleTime: githubCachePolicy.list.staleTimeMs,
		gcTime: githubCachePolicy.list.gcTimeMs,
		refetchOnWindowFocus: true,
	});
}

export function githubRepoReleasesQueryOptions(
	scope: GitHubQueryScope,
	input: RepoReleasesInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.releases.list(scope, input),
		queryFn: () => getRepoReleases({ data: input }),
		staleTime: githubCachePolicy.list.staleTimeMs,
		gcTime: githubCachePolicy.list.gcTimeMs,
		refetchOnWindowFocus: true,
	});
}

export function githubRepoReleaseQueryOptions(
	scope: GitHubQueryScope,
	input: RepoReleaseInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.releases.detail(scope, input),
		queryFn: () => getRepoRelease({ data: input }),
		staleTime: githubCachePolicy.detail.staleTimeMs,
		gcTime: githubCachePolicy.detail.gcTimeMs,
		refetchOnWindowFocus: true,
	});
}

export function githubRepoViewerPermissionQueryOptions(
	scope: GitHubQueryScope,
	input: { owner: string; repo: string },
) {
	return queryOptions({
		queryKey: githubQueryKeys.releases.viewerPermission(scope, input),
		queryFn: () => getRepoViewerPermission({ data: input }),
		staleTime: githubCachePolicy.repoMeta.staleTimeMs,
		gcTime: githubCachePolicy.repoMeta.gcTimeMs,
	});
}

/** First 100 branch or tag names — feeds ref pickers. */
export function githubRepoRefNamesQueryOptions(
	scope: GitHubQueryScope,
	input: RepoRefNamesInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.refs.names(scope, input),
		queryFn: () => getRepoRefNames({ data: input }),
		staleTime: githubCachePolicy.repoMeta.staleTimeMs,
		gcTime: githubCachePolicy.repoMeta.gcTimeMs,
	});
}

export function githubRepoBranchesListInfiniteQueryOptions(
	scope: GitHubQueryScope,
	input: Omit<RepoBranchesListInput, "after">,
) {
	return infiniteQueryOptions({
		queryKey: githubQueryKeys.refs.branches(scope, input),
		queryFn: ({ pageParam }) =>
			getRepoBranchesList({ data: { ...input, after: pageParam } }),
		initialPageParam: null as string | null,
		getNextPageParam: (lastPage) =>
			lastPage.hasNextPage ? lastPage.endCursor : undefined,
		staleTime: githubCachePolicy.list.staleTimeMs,
		gcTime: githubCachePolicy.list.gcTimeMs,
		refetchOnWindowFocus: true,
	});
}

export function githubRepoTagsListInfiniteQueryOptions(
	scope: GitHubQueryScope,
	input: Omit<RepoTagsListInput, "after">,
) {
	return infiniteQueryOptions({
		queryKey: githubQueryKeys.refs.tags(scope, input),
		queryFn: ({ pageParam }) =>
			getRepoTagsList({ data: { ...input, after: pageParam } }),
		initialPageParam: null as string | null,
		getNextPageParam: (lastPage) =>
			lastPage.hasNextPage ? lastPage.endCursor : undefined,
		staleTime: githubCachePolicy.list.staleTimeMs,
		gcTime: githubCachePolicy.list.gcTimeMs,
		refetchOnWindowFocus: true,
	});
}

/**
 * Ahead/behind for one branch on the branches page. Each visible row owns one
 * of these, so the page issues at most one compare call per rendered row; the
 * longer stale time keeps window-focus refetches from re-running all of them.
 */
export function githubRepoRefComparisonQueryOptions(
	scope: GitHubQueryScope,
	input: { owner: string; repo: string; base: string; head: string },
) {
	return queryOptions({
		queryKey: githubQueryKeys.refs.comparison(scope, input),
		queryFn: () => getBranchComparison({ data: input }),
		staleTime: githubCachePolicy.reposList.staleTimeMs,
		gcTime: githubCachePolicy.list.gcTimeMs,
	});
}

/** Splits a slashed `/commits/$` splat into ref + path (one cached GraphQL call). */
export function githubRepoRefSplatQueryOptions(
	scope: GitHubQueryScope,
	input: RepoRefSplatInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.refs.splat(scope, input),
		queryFn: () => resolveRepoRefSplat({ data: input }),
		staleTime: githubCachePolicy.repoMeta.staleTimeMs,
		gcTime: githubCachePolicy.repoMeta.gcTimeMs,
	});
}

/**
 * Viewer's pending (unsubmitted) reviews. Deliberately not persisted: draft
 * comment bodies are private, unsent content and the list is cheap to rebuild.
 */
export function githubReviewDraftsQueryOptions(scope: GitHubQueryScope) {
	return queryOptions({
		queryKey: githubQueryKeys.reviewDrafts.mine(scope),
		queryFn: () => getMyReviewDrafts(),
		staleTime: githubCachePolicy.mine.staleTimeMs,
		gcTime: githubCachePolicy.mine.gcTimeMs,
	});
}

// ---------------------------------------------------------------------------
// Entity → query registry (change feed and mutations)
// ---------------------------------------------------------------------------

/**
 * Which change-feed entity kinds affect each `githubQueryKeys` group. Every
 * group must be listed (enforced by github.query.test.ts); `"exempt"` groups
 * never refetch from the feed and rely on staleTime + focus refetch.
 */
export const githubQueryEntityCoverage: Record<
	string,
	readonly GitHubChangeEntityKind[] | "exempt"
> = {
	viewer: "exempt",
	"repos.list": ["repo"],
	"repos.hub": ["repo"],
	"search.commandPalette": "exempt",
	"pulls.mine": ["pull"],
	"pulls.user": ["pull"],
	"pulls.repo": ["pull"],
	"pulls.page": ["pull"],
	"pulls.detail": ["pull"],
	"pulls.fileSummaries": ["pull"],
	"pulls.comments": ["pull"],
	"pulls.status": ["pull", "checks"],
	"pulls.files": ["pull"],
	"pulls.reviewComments": ["pull"],
	"pulls.reviewThreads": ["pull"],
	collaborators: ["collaborators"],
	repoLabels: ["labels"],
	orgTeams: "exempt",
	commentPage: ["pull", "issue"],
	timelineEventPage: ["pull", "issue"],
	profile: "exempt",
	profileRepos: "exempt",
	contributions: "exempt",
	pinnedRepos: "exempt",
	activity: "exempt",
	"repo.overview": ["repo", "pull", "issue", "release"],
	"repo.branches": ["repo"],
	"repo.branchComparison": ["repo"],
	"repo.compareDetail": ["repo"],
	"repo.recentPushableBranch": ["repo"],
	"repo.template": ["repo"],
	"repo.tree": ["repo"],
	"repo.fileContent": ["repo"],
	"repo.fileLastCommit": ["repo"],
	"repo.commit": ["checks"],
	"repo.refHeadCommit": ["repo"],
	"repo.treeEntryCommits": ["repo"],
	"repo.contributors": ["repo"],
	"repo.participation": ["repo"],
	"repo.discussions": ["discussions"],
	"issues.mine": ["issue"],
	"issues.user": ["issue"],
	"issues.repo": ["issue"],
	"issues.page": ["issue"],
	"issues.detail": ["issue"],
	"issues.comments": ["issue"],
	"notifications.list": ["notifications"],
	"actions.runsList": ["run"],
	"actions.workflowRun": ["run"],
	"actions.workflowRunJobs": ["run"],
	"actions.workflowRunArtifacts": ["run"],
	"actions.workflowDefinition": "exempt",
	"actions.workflowJobLogs": ["run"],
	"actions.workflowRunLogsBundle": ["run"],
	"commits.list": ["repo"],
	"releases.repo": ["release"],
	"releases.list": ["release"],
	"releases.detail": ["release"],
	"releases.viewerPermission": "exempt",
	"refs.names": ["repo"],
	"refs.branches": ["repo"],
	"refs.tags": ["repo", "release"],
	"refs.comparison": ["repo"],
	"refs.splat": ["repo"],
	"reviewDrafts.mine": ["pull"],
};

/**
 * User-wide aggregates whose payload lists items across many repos. A pull or
 * issue change only refetches them when the changed item is already in the
 * cached payload; new items arrive on focus / staleTime instead of turning
 * every PR event in an org into a GitHub search request.
 */
const AGGREGATE_PATHS = new Set([
	"pulls.mine",
	"pulls.user",
	"issues.mine",
	"issues.user",
	"reviewDrafts.mine",
	"repos.list",
	"repos.hub",
]);

/** `githubQueryKeys` path of a query key, e.g. `pulls.page` or `viewer`. */
export function githubQueryPath(queryKey: readonly unknown[]): string | null {
	if (queryKey[0] !== "github") return null;
	const group = queryKey[2];
	if (typeof group !== "string") return null;
	const name = queryKey[3];
	if (group === "releases" && name === "repo") {
		const leaf = queryKey[5];
		return typeof leaf === "string" ? `releases.${leaf}` : "releases.repo";
	}
	if (
		typeof name === "string" &&
		`${group}.${name}` in githubQueryEntityCoverage
	) {
		return `${group}.${name}`;
	}
	return group;
}

function githubQueryInput(
	queryKey: readonly unknown[],
): Record<string, unknown> | null {
	for (let index = queryKey.length - 1; index >= 3; index--) {
		const part = queryKey[index];
		if (part && typeof part === "object" && !Array.isArray(part)) {
			return part as Record<string, unknown>;
		}
	}
	return null;
}

/** Lowercased `owner/repo` a query is scoped to, or `null` for user-wide ones. */
export function githubQueryRepo(queryKey: readonly unknown[]): string | null {
	const input = githubQueryInput(queryKey);
	if (
		input &&
		typeof input.owner === "string" &&
		typeof input.repo === "string"
	) {
		return normalizeRepoFullName(input.owner, input.repo);
	}
	return null;
}

function* itemsOf(data: unknown): Generator<Record<string, unknown>> {
	const lists = Array.isArray(data)
		? [data]
		: data && typeof data === "object"
			? Object.values(data).filter(Array.isArray)
			: [];
	for (const list of lists) {
		for (const item of list as unknown[]) {
			if (item && typeof item === "object") {
				yield item as Record<string, unknown>;
			}
		}
	}
	// Infinite queries
	if (data && typeof data === "object" && "pages" in data) {
		const pages = (data as { pages?: unknown }).pages;
		if (Array.isArray(pages)) {
			for (const page of pages) yield* itemsOf(page);
		}
	}
}

function itemRepo(item: Record<string, unknown>): string | null {
	const repository = item.repository as
		| { owner?: unknown; name?: unknown }
		| undefined;
	if (
		repository &&
		typeof repository.owner === "string" &&
		typeof repository.name === "string"
	) {
		return normalizeRepoFullName(repository.owner, repository.name);
	}
	if (typeof item.fullName === "string") return item.fullName.toLowerCase();
	return null;
}

function aggregateContains(data: unknown, entity: GitHubChangeEntity) {
	if (entity.kind === "notifications") return false;
	for (const item of itemsOf(data)) {
		if (itemRepo(item) !== entity.repo) continue;
		if (entity.kind === "pull" || entity.kind === "issue") {
			if (item.number === entity.number) return true;
		} else {
			return true;
		}
	}
	return false;
}

/**
 * Whether a cached query is affected by a change-feed entity. `data` is the
 * query's cached payload, used for user-wide aggregates.
 */
export function githubQueryMatchesEntity(
	queryKey: readonly unknown[],
	entity: GitHubChangeEntity,
	data?: unknown,
): boolean {
	const path = githubQueryPath(queryKey);
	if (!path) return false;
	const kinds = githubQueryEntityCoverage[path];
	if (!kinds || kinds === "exempt" || !kinds.includes(entity.kind)) {
		return false;
	}
	if (entity.kind === "notifications") return true;

	const repo = githubQueryRepo(queryKey);
	if (AGGREGATE_PATHS.has(path) && (repo === null || repo === entity.repo)) {
		return aggregateContains(data, entity);
	}
	if (repo !== entity.repo) return false;

	const input = githubQueryInput(queryKey) ?? {};
	switch (entity.kind) {
		case "pull":
			return input.pullNumber !== undefined
				? input.pullNumber === entity.number
				: input.issueNumber !== undefined
					? input.issueNumber === entity.number
					: true;
		case "issue":
			return input.issueNumber !== undefined
				? input.issueNumber === entity.number
				: true;
		case "run":
			return input.runId !== undefined ? input.runId === entity.runId : true;
		case "checks":
			return typeof input.sha === "string"
				? input.sha.toLowerCase().startsWith(entity.sha) ||
						entity.sha.startsWith(input.sha.toLowerCase())
				: true;
		default:
			return true;
	}
}

/**
 * Query filters for every query of `scope` that an entity key affects. Used
 * by the change feed and by mutations:
 * `queryClient.invalidateQueries(queryFiltersForEntity(key, scope))` marks
 * them all stale and refetches the active ones.
 */
export function queryFiltersForEntity(
	entity: GitHubChangeEntity | string,
	scope: GitHubQueryScope,
) {
	const parsed = typeof entity === "string" ? parseEntityKey(entity) : entity;
	return {
		queryKey: ["github", scope.userId] as const,
		predicate: (query: {
			queryKey: readonly unknown[];
			state: { data?: unknown };
		}) =>
			parsed !== null &&
			githubQueryMatchesEntity(query.queryKey, parsed, query.state.data),
	};
}
