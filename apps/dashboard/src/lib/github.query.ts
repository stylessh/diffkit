import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import {
	type CommandPaletteSearchInput,
	getCommentPage,
	getFileLastCommit,
	getGitHubViewer,
	getIssueComments,
	getIssueFromRepo,
	getIssuePageData,
	getIssuesFromRepo,
	getIssuesFromUser,
	getMyIssues,
	getMyPulls,
	getNotifications,
	getOrgTeams,
	getPullComments,
	getPullFileSummaries,
	getPullFiles,
	getPullFromRepo,
	getPullPageData,
	getPullReviewComments,
	getPullStatus,
	getPullsFromRepo,
	getPullsFromUser,
	getRepoBranches,
	getRepoCollaborators,
	getRepoContributors,
	getRepoDiscussions,
	getRepoFileContent,
	getRepoLabels,
	getRepoOverview,
	getRepoTree,
	getReviewThreadStatuses,
	getTimelineEventPage,
	getTreeEntryCommits,
	getUserActivity,
	getUserContributions,
	getUserPinnedRepos,
	getUserProfile,
	getUserRepos,
	searchCommandPaletteGitHub,
} from "./github.functions";
import { githubCachePolicy } from "./github-cache-policy";
import { ensureDefinedQueryData } from "./query-data";

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

const persistedMeta = {
	persist: true,
} as const;

const tabPersistedMeta = {
	persist: "tab",
} as const;

export const githubQueryKeys = {
	all: ["github"] as const,
	viewer: (scope: GitHubQueryScope) =>
		["github", scope.userId, "viewer"] as const,
	repos: {
		list: (scope: GitHubQueryScope) =>
			["github", scope.userId, "repos", "list"] as const,
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
		treeEntryCommits: (
			scope: GitHubQueryScope,
			input: { owner: string; repo: string; ref: string; dirPath: string },
		) => ["github", scope.userId, "repo", "treeEntryCommits", input] as const,
		contributors: (
			scope: GitHubQueryScope,
			input: { owner: string; repo: string },
		) => ["github", scope.userId, "repo", "contributors", input] as const,
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
};

export function githubViewerQueryOptions(scope: GitHubQueryScope) {
	return queryOptions({
		queryKey: githubQueryKeys.viewer(scope),
		queryFn: () => getGitHubViewer(),
		staleTime: githubCachePolicy.viewer.staleTimeMs,
		gcTime: githubCachePolicy.viewer.gcTimeMs,
		meta: persistedMeta,
	});
}

export function githubUserReposQueryOptions(scope: GitHubQueryScope) {
	return queryOptions({
		queryKey: githubQueryKeys.repos.list(scope),
		queryFn: () => getUserRepos(),
		staleTime: githubCachePolicy.reposList.staleTimeMs,
		gcTime: githubCachePolicy.reposList.gcTimeMs,
		meta: persistedMeta,
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
		meta: persistedMeta,
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
		meta: persistedMeta,
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
		meta: persistedMeta,
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
		meta: tabPersistedMeta,
	});
}

export function githubPullPageQueryOptions(
	scope: GitHubQueryScope,
	input: PullFromRepoQueryInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.pulls.page(scope, input),
		queryFn: () =>
			ensureDefinedQueryData(
				() => getPullPageData({ data: input }),
				"getPullPageData",
			),
		staleTime: githubCachePolicy.detail.staleTimeMs,
		gcTime: githubCachePolicy.detail.gcTimeMs,
		meta: tabPersistedMeta,
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
		meta: tabPersistedMeta,
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
		meta: tabPersistedMeta,
	});
}

export function githubPullFilesQueryOptions(
	scope: GitHubQueryScope,
	input: PullFromRepoQueryInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.pulls.files(scope, input),
		queryFn: () => getPullFiles({ data: input }),
		staleTime: githubCachePolicy.detail.staleTimeMs,
		gcTime: githubCachePolicy.detail.gcTimeMs,
		meta: tabPersistedMeta,
	});
}

export function githubPullFileSummariesQueryOptions(
	scope: GitHubQueryScope,
	input: PullFromRepoQueryInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.pulls.fileSummaries(scope, input),
		queryFn: () => getPullFileSummaries({ data: input }),
		staleTime: githubCachePolicy.detail.staleTimeMs,
		gcTime: githubCachePolicy.detail.gcTimeMs,
		meta: tabPersistedMeta,
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
		meta: tabPersistedMeta,
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
		meta: tabPersistedMeta,
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
		meta: persistedMeta,
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
		meta: persistedMeta,
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
		meta: persistedMeta,
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
		meta: tabPersistedMeta,
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
		meta: tabPersistedMeta,
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
		meta: tabPersistedMeta,
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
		meta: tabPersistedMeta,
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
		meta: tabPersistedMeta,
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
		staleTime: githubCachePolicy.repoMeta.staleTimeMs,
		gcTime: githubCachePolicy.repoMeta.gcTimeMs,
		meta: persistedMeta,
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
		meta: persistedMeta,
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
		meta: persistedMeta,
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
		meta: tabPersistedMeta,
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
		meta: persistedMeta,
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
		meta: tabPersistedMeta,
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
		meta: tabPersistedMeta,
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
		meta: persistedMeta,
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
		meta: persistedMeta,
	});
}
