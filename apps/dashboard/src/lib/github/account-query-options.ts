import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import {
	type CommandPaletteSearchInput,
	getCommitReference,
	getGitHubViewer,
	getItemReference,
	getNotifications,
	getProfileRepos,
	getReposHub,
	getUserActivity,
	getUserContributions,
	getUserPinnedRepos,
	getUserProfile,
	getUserRepos,
	searchCommandPaletteGitHub,
} from "../github.functions";
import { githubCacheTimes } from "../github-cache-policy";
import type { ReposHubInput } from "../repos-hub-filter";
import { type GitHubQueryScope, githubQueryKeys } from "./query-keys";

export function githubViewerQueryOptions(scope: GitHubQueryScope) {
	return queryOptions({
		queryKey: githubQueryKeys.viewer(scope),
		queryFn: () => getGitHubViewer(),
		...githubCacheTimes("viewer"),
	});
}

export function githubUserReposQueryOptions(scope: GitHubQueryScope) {
	return queryOptions({
		queryKey: githubQueryKeys.repos.list(scope),
		queryFn: () => getUserRepos(),
		...githubCacheTimes("reposList"),
	});
}

export function githubReposHubQueryOptions(
	scope: GitHubQueryScope,
	input: ReposHubInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.repos.hub(scope, input),
		queryFn: () => getReposHub({ data: input }),
		...githubCacheTimes("reposList"),
	});
}

export function githubProfileReposQueryOptions(
	scope: GitHubQueryScope,
	username: string,
) {
	return queryOptions({
		queryKey: githubQueryKeys.profileRepos(scope, username),
		queryFn: () => getProfileRepos({ data: { username } }),
		...githubCacheTimes("reposList"),
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

export function githubUserProfileQueryOptions(
	scope: GitHubQueryScope,
	username: string,
) {
	return queryOptions({
		queryKey: githubQueryKeys.profile(scope, username),
		queryFn: () => getUserProfile({ data: { username } }),
		...githubCacheTimes("viewer"),
	});
}

export function githubUserContributionsQueryOptions(
	scope: GitHubQueryScope,
	username: string,
) {
	return queryOptions({
		queryKey: githubQueryKeys.contributions(scope, username),
		queryFn: () => getUserContributions({ data: { username } }),
		...githubCacheTimes("contributions"),
	});
}

export function githubUserPinnedReposQueryOptions(
	scope: GitHubQueryScope,
	username: string,
) {
	return queryOptions({
		queryKey: githubQueryKeys.pinnedRepos(scope, username),
		queryFn: () => getUserPinnedRepos({ data: { username } }),
		...githubCacheTimes("reposList"),
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
		...githubCacheTimes("userActivity"),
	});
}

export function githubNotificationsQueryOptions(
	scope: GitHubQueryScope,
	input: { all?: boolean; participating?: boolean } = {},
) {
	return queryOptions({
		queryKey: githubQueryKeys.notifications.list(scope, input),
		queryFn: () => getNotifications({ data: input }),
		...githubCacheTimes("list"),
	});
}

export function githubItemReferenceQueryOptions(
	scope: GitHubQueryScope,
	input: { owner: string; repo: string; number: number },
) {
	return queryOptions({
		queryKey: githubQueryKeys.references.item(scope, input),
		queryFn: () => getItemReference({ data: input }),
		...githubCacheTimes("itemReference"),
	});
}

export function githubCommitReferenceQueryOptions(
	scope: GitHubQueryScope,
	input: { owner: string; repo: string; sha: string },
) {
	return queryOptions({
		queryKey: githubQueryKeys.references.commit(scope, input),
		queryFn: () => getCommitReference({ data: input }),
		...githubCacheTimes("commitReference"),
	});
}
