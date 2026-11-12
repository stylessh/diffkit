import { queryOptions } from "@tanstack/react-query";
import { githubCacheTimes } from "../github-cache-policy";
import {
	getPullProductAreas,
	getRepoProductMapActivity,
	getRepoProductMapFile,
	type PullProductAreasInput,
	type RepoProductMapInput,
} from "./product-map";
import { type GitHubQueryScope, githubQueryKeys } from "./query-keys";

export function githubRepoProductMapFileQueryOptions(
	scope: GitHubQueryScope,
	input: RepoProductMapInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.repo.productMapFile(scope, input),
		queryFn: () => getRepoProductMapFile({ data: input }),
		...githubCacheTimes("repoMeta"),
	});
}

export function githubRepoProductMapActivityQueryOptions(
	scope: GitHubQueryScope,
	input: RepoProductMapInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.repo.productMapActivity(scope, input),
		queryFn: () => getRepoProductMapActivity({ data: input }),
		...githubCacheTimes("repoMeta"),
	});
}

export function githubPullProductAreasQueryOptions(
	scope: GitHubQueryScope,
	input: PullProductAreasInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.pulls.productAreas(scope, input),
		queryFn: () => getPullProductAreas({ data: input }),
		...githubCacheTimes("detail"),
	});
}
