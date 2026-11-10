import { queryOptions } from "@tanstack/react-query";
import {
	getBranchComparison,
	getCompareDetail,
	getFileLastCommit,
	getRecentPushableBranch,
	getRefHeadCommit,
	getRepoBranches,
	getRepoCommit,
	getRepoContributors,
	getRepoDiscussions,
	getRepoOverview,
	getRepoParticipationStats,
	getRepoTemplate,
	getRepoTree,
	getTreeEntryCommits,
	type RepoTemplateKind,
} from "../github.functions";
import { githubCacheTimes } from "../github-cache-policy";
import { type GitHubQueryScope, githubQueryKeys } from "./query-keys";

export function githubRepoOverviewQueryOptions(
	scope: GitHubQueryScope,
	input: { owner: string; repo: string },
) {
	return queryOptions({
		queryKey: githubQueryKeys.repo.overview(scope, input),
		queryFn: () => getRepoOverview({ data: input }),
		...githubCacheTimes("list"),
	});
}

export function githubRepoBranchesQueryOptions(
	scope: GitHubQueryScope,
	input: { owner: string; repo: string },
) {
	return queryOptions({
		queryKey: githubQueryKeys.repo.branches(scope, input),
		queryFn: () => getRepoBranches({ data: input }),
		...githubCacheTimes("repoMeta"),
	});
}

export function githubBranchComparisonQueryOptions(
	scope: GitHubQueryScope,
	input: { owner: string; repo: string; base: string; head: string },
) {
	return queryOptions({
		queryKey: githubQueryKeys.repo.branchComparison(scope, input),
		queryFn: () => getBranchComparison({ data: input }),
		...githubCacheTimes("detail"),
	});
}

export function githubCompareDetailQueryOptions(
	scope: GitHubQueryScope,
	input: { owner: string; repo: string; base: string; head: string },
) {
	return queryOptions({
		queryKey: githubQueryKeys.repo.compareDetail(scope, input),
		queryFn: () => getCompareDetail({ data: input }),
		...githubCacheTimes("blob"),
	});
}

export function githubRecentPushableBranchQueryOptions(
	scope: GitHubQueryScope,
	input: { owner: string; repo: string },
) {
	return queryOptions({
		queryKey: githubQueryKeys.repo.recentPushableBranch(scope, input),
		queryFn: () => getRecentPushableBranch({ data: input }),
		...githubCacheTimes("detail"),
	});
}

export function githubRepoTemplateQueryOptions(
	scope: GitHubQueryScope,
	input: { owner: string; repo: string; kind: RepoTemplateKind },
) {
	return queryOptions({
		queryKey: githubQueryKeys.repo.template(scope, input),
		queryFn: () => getRepoTemplate({ data: input }),
		...githubCacheTimes("repoMeta"),
	});
}

export function githubRepoParticipationQueryOptions(
	scope: GitHubQueryScope,
	input: { owner: string; repo: string },
) {
	return queryOptions({
		queryKey: githubQueryKeys.repo.participation(scope, input),
		queryFn: () => getRepoParticipationStats({ data: input }),
		...githubCacheTimes("repoParticipation"),
	});
}

export function githubRepoContributorsQueryOptions(
	scope: GitHubQueryScope,
	input: { owner: string; repo: string },
) {
	return queryOptions({
		queryKey: githubQueryKeys.repo.contributors(scope, input),
		queryFn: () => getRepoContributors({ data: input }),
		...githubCacheTimes("repoMeta"),
	});
}

export function githubRepoTreeQueryOptions(
	scope: GitHubQueryScope,
	input: { owner: string; repo: string; ref: string; path: string },
) {
	return queryOptions({
		queryKey: githubQueryKeys.repo.tree(scope, input),
		queryFn: () => getRepoTree({ data: input }),
		...githubCacheTimes("detail"),
	});
}

export function githubFileLastCommitQueryOptions(
	scope: GitHubQueryScope,
	input: { owner: string; repo: string; ref: string; path: string },
) {
	return queryOptions({
		queryKey: githubQueryKeys.repo.fileLastCommit(scope, input),
		queryFn: () => getFileLastCommit({ data: input }),
		...githubCacheTimes("detail"),
	});
}

export function githubRepoCommitQueryOptions(
	scope: GitHubQueryScope,
	input: { owner: string; repo: string; sha: string },
) {
	return queryOptions({
		queryKey: githubQueryKeys.repo.commit(scope, input),
		queryFn: () => getRepoCommit({ data: input }),
		...githubCacheTimes("blob"),
	});
}

export function githubRefHeadCommitQueryOptions(
	scope: GitHubQueryScope,
	input: { owner: string; repo: string; ref: string },
) {
	return queryOptions({
		queryKey: githubQueryKeys.repo.refHeadCommit(scope, input),
		queryFn: () => getRefHeadCommit({ data: input }),
		...githubCacheTimes("detail"),
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
		...githubCacheTimes("detail"),
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
		...githubCacheTimes("list"),
	});
}
