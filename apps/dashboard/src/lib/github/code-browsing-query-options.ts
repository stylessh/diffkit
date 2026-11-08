import { queryOptions } from "@tanstack/react-query";
import { isFullCommitSha } from "../code-browsing/code-location";
import { treeIndexFor } from "../code-browsing/tree-index";
import type {
	RepoCodeInput,
	RepoCodePathInput,
	RepoCodeSearchInput,
} from "../code-browsing/types";
import { githubCachePolicy } from "../github-cache-policy";
import {
	getRepoBlame,
	getRepoBlob,
	getRepoGitTree,
	searchRepoCode,
} from "./code-browsing";
import { codeBrowsingQueryKeys } from "./code-browsing-keys";
import type { GitHubQueryScope } from "./query-keys";

function contentStaleTime(ref: string) {
	return isFullCommitSha(ref)
		? Number.POSITIVE_INFINITY
		: githubCachePolicy.repoMeta.staleTimeMs;
}

export function githubRepoGitTreeQueryOptions(
	scope: GitHubQueryScope,
	input: RepoCodeInput,
) {
	return queryOptions({
		queryKey: codeBrowsingQueryKeys.gitTree(scope, input),
		queryFn: () => getRepoGitTree({ data: input }),
		staleTime: contentStaleTime(input.ref),
		gcTime: githubCachePolicy.repoMeta.gcTimeMs,
	});
}

export function githubRepoTreeIndexQueryOptions(
	scope: GitHubQueryScope,
	input: RepoCodeInput,
) {
	return queryOptions({
		...githubRepoGitTreeQueryOptions(scope, input),
		select: treeIndexFor,
	});
}

export function githubRepoBlobQueryOptions(
	scope: GitHubQueryScope,
	input: RepoCodePathInput,
) {
	return queryOptions({
		queryKey: codeBrowsingQueryKeys.blob(scope, input),
		queryFn: () => getRepoBlob({ data: input }),
		staleTime: contentStaleTime(input.ref),
		gcTime: githubCachePolicy.detail.gcTimeMs,
	});
}

export function githubRepoBlameQueryOptions(
	scope: GitHubQueryScope,
	input: RepoCodePathInput,
) {
	return queryOptions({
		queryKey: codeBrowsingQueryKeys.blame(scope, input),
		queryFn: () => getRepoBlame({ data: input }),
		staleTime: contentStaleTime(input.ref),
		gcTime: githubCachePolicy.repoMeta.gcTimeMs,
	});
}

/** Code search allows 10 requests a minute, so results are never retried. */
export function githubRepoCodeSearchQueryOptions(
	scope: GitHubQueryScope,
	input: RepoCodeSearchInput,
) {
	return queryOptions({
		queryKey: codeBrowsingQueryKeys.search(scope, input),
		queryFn: () => searchRepoCode({ data: input }),
		staleTime: githubCachePolicy.repoMeta.staleTimeMs,
		gcTime: githubCachePolicy.list.gcTimeMs,
		retry: false,
		refetchOnWindowFocus: false,
		enabled: input.query.trim().length > 0,
	});
}
