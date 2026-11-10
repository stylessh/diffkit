import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import {
	getBranchComparison,
	getRepoBranchesList,
	getRepoCommits,
	getRepoRefNames,
	getRepoRelease,
	getRepoReleases,
	getRepoTagsList,
	getRepoViewerPermission,
	resolveRepoRefSplat,
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
import { githubCacheTimes } from "../github-cache-policy";
import { type GitHubQueryScope, githubQueryKeys } from "./query-keys";

export const REPO_COMMITS_PER_PAGE = 35;
export const REPO_RELEASES_PER_PAGE = 10;

export function githubRepoCommitsQueryOptions(
	scope: GitHubQueryScope,
	input: RepoCommitsInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.commits.list(scope, input),
		queryFn: () => getRepoCommits({ data: input }),
		...githubCacheTimes("list"),
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
		...githubCacheTimes("list"),
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
		...githubCacheTimes("detail"),
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
		...githubCacheTimes("repoMeta"),
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
		...githubCacheTimes("repoMeta"),
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
		...githubCacheTimes("list"),
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
		...githubCacheTimes("list"),
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
		...githubCacheTimes("reposList"),
	});
}

/** Splits a slashed `/commits/$` splat into ref + path (one GraphQL call). */
export function githubRepoRefSplatQueryOptions(
	scope: GitHubQueryScope,
	input: RepoRefSplatInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.refs.splat(scope, input),
		queryFn: () => resolveRepoRefSplat({ data: input }),
		...githubCacheTimes("repoMeta"),
	});
}
