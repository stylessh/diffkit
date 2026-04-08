import { queryOptions } from "@tanstack/react-query";
import {
	getGitHubViewer,
	getIssueFromRepo,
	getIssuesFromRepo,
	getIssuesFromUser,
	getMyIssues,
	getMyPulls,
	getPullFromRepo,
	getPullsFromRepo,
	getPullsFromUser,
	getUserRepos,
} from "./github.functions";
import { githubCachePolicy } from "./github-cache-policy";

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

export const githubQueryKeys = {
	all: ["github"] as const,
	viewer: (scope: GitHubQueryScope) =>
		["github", scope.userId, "viewer"] as const,
	repos: {
		list: (scope: GitHubQueryScope) =>
			["github", scope.userId, "repos", "list"] as const,
	},
	pulls: {
		mine: (scope: GitHubQueryScope) =>
			["github", scope.userId, "pulls", "mine"] as const,
		user: (scope: GitHubQueryScope, input: PullsFromUserQueryInput) =>
			["github", scope.userId, "pulls", "user", input] as const,
		repo: (scope: GitHubQueryScope, input: PullsFromRepoQueryInput) =>
			["github", scope.userId, "pulls", "repo", input] as const,
		detail: (scope: GitHubQueryScope, input: PullFromRepoQueryInput) =>
			["github", scope.userId, "pulls", "detail", input] as const,
	},
	issues: {
		mine: (scope: GitHubQueryScope) =>
			["github", scope.userId, "issues", "mine"] as const,
		user: (scope: GitHubQueryScope, input: IssuesFromUserQueryInput) =>
			["github", scope.userId, "issues", "user", input] as const,
		repo: (scope: GitHubQueryScope, input: IssuesFromRepoQueryInput) =>
			["github", scope.userId, "issues", "repo", input] as const,
		detail: (scope: GitHubQueryScope, input: IssueFromRepoQueryInput) =>
			["github", scope.userId, "issues", "detail", input] as const,
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

export function githubMyPullsQueryOptions(scope: GitHubQueryScope) {
	return queryOptions({
		queryKey: githubQueryKeys.pulls.mine(scope),
		queryFn: () => getMyPulls(),
		staleTime: githubCachePolicy.list.staleTimeMs,
		gcTime: githubCachePolicy.list.gcTimeMs,
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
		meta: persistedMeta,
	});
}

export function githubMyIssuesQueryOptions(scope: GitHubQueryScope) {
	return queryOptions({
		queryKey: githubQueryKeys.issues.mine(scope),
		queryFn: () => getMyIssues(),
		staleTime: githubCachePolicy.list.staleTimeMs,
		gcTime: githubCachePolicy.list.gcTimeMs,
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
		meta: persistedMeta,
	});
}
