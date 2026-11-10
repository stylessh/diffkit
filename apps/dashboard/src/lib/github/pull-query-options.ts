import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import {
	getMyPulls,
	getOpenPullForRefs,
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
	getRepoCollaborators,
	getReviewThreadStatuses,
} from "../github.functions";
import { githubCacheTimes } from "../github-cache-policy";
import {
	adaptiveRefetchInterval,
	classifyPullStatus,
} from "../github-refetch-policy";
import { ensureDefinedQueryData } from "../query-data";
import {
	type GitHubQueryScope,
	githubQueryKeys,
	type PullFromRepoQueryInput,
	type PullsFromRepoQueryInput,
	type PullsFromUserQueryInput,
} from "./query-keys";

export function githubMyPullsQueryOptions(scope: GitHubQueryScope) {
	return queryOptions({
		queryKey: githubQueryKeys.pulls.mine(scope),
		queryFn: () => getMyPulls(),
		...githubCacheTimes("mine"),
	});
}

export function githubPullsFromUserQueryOptions(
	scope: GitHubQueryScope,
	input: PullsFromUserQueryInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.pulls.user(scope, input),
		queryFn: () => getPullsFromUser({ data: input }),
		...githubCacheTimes("list"),
	});
}

export function githubPullsFromRepoQueryOptions(
	scope: GitHubQueryScope,
	input: PullsFromRepoQueryInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.pulls.repo(scope, input),
		queryFn: () => getPullsFromRepo({ data: input }),
		...githubCacheTimes("list"),
	});
}

export function githubPullDetailQueryOptions(
	scope: GitHubQueryScope,
	input: PullFromRepoQueryInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.pulls.detail(scope, input),
		queryFn: () => getPullFromRepo({ data: input }),
		...githubCacheTimes("detail"),
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
		...githubCacheTimes("detail"),
	});
}

export function githubPullCommentsQueryOptions(
	scope: GitHubQueryScope,
	input: PullFromRepoQueryInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.pulls.comments(scope, input),
		queryFn: () => getPullComments({ data: input }),
		...githubCacheTimes("activity"),
	});
}

export function githubPullStatusQueryOptions(
	scope: GitHubQueryScope,
	input: PullFromRepoQueryInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.pulls.status(scope, input),
		queryFn: () => getPullStatus({ data: input }),
		...githubCacheTimes("status"),
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
		...githubCacheTimes("blob"),
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
		...githubCacheTimes("detail"),
	});
}

export function githubPullReviewCommentsQueryOptions(
	scope: GitHubQueryScope,
	input: PullFromRepoQueryInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.pulls.reviewComments(scope, input),
		queryFn: () => getPullReviewComments({ data: input }),
		...githubCacheTimes("activity"),
	});
}

export function githubReviewThreadStatusesQueryOptions(
	scope: GitHubQueryScope,
	input: PullFromRepoQueryInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.pulls.reviewThreads(scope, input),
		queryFn: () => getReviewThreadStatuses({ data: input }),
		...githubCacheTimes("activity"),
	});
}

export function githubRepoCollaboratorsQueryOptions(
	scope: GitHubQueryScope,
	input: { owner: string; repo: string },
) {
	return queryOptions({
		queryKey: githubQueryKeys.collaborators(scope, input),
		queryFn: () => getRepoCollaborators({ data: input }),
		...githubCacheTimes("viewer"),
	});
}

export function githubOpenPullForRefsQueryOptions(
	scope: GitHubQueryScope,
	input: { owner: string; repo: string; base: string; head: string },
) {
	return queryOptions({
		queryKey: githubQueryKeys.pulls.forRefs(scope, input),
		queryFn: () => getOpenPullForRefs({ data: input }),
		...githubCacheTimes("list"),
	});
}

export function githubOrgTeamsQueryOptions(
	scope: GitHubQueryScope,
	input: { org: string; owner: string; repo: string },
) {
	return queryOptions({
		queryKey: githubQueryKeys.orgTeams(scope, input),
		queryFn: () => getOrgTeams({ data: input }),
		...githubCacheTimes("viewer"),
	});
}
