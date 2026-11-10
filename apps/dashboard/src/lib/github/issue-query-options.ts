import { queryOptions } from "@tanstack/react-query";
import {
	getCommentPage,
	getIssueComments,
	getIssueFromRepo,
	getIssuePageData,
	getIssuesFromRepo,
	getIssuesFromUser,
	getMyIssues,
	getRepoLabels,
	getRepoMilestones,
	getTimelineEventPage,
} from "../github.functions";
import { githubCacheTimes } from "../github-cache-policy";
import {
	type GitHubQueryScope,
	githubQueryKeys,
	type IssueFromRepoQueryInput,
	type IssuesFromRepoQueryInput,
	type IssuesFromUserQueryInput,
} from "./query-keys";

export function githubRepoLabelsQueryOptions(
	scope: GitHubQueryScope,
	input: { owner: string; repo: string },
) {
	return queryOptions({
		queryKey: githubQueryKeys.repoLabels(scope, input),
		queryFn: () => getRepoLabels({ data: input }),
		...githubCacheTimes("viewer"),
	});
}

export function githubRepoMilestonesQueryOptions(
	scope: GitHubQueryScope,
	input: { owner: string; repo: string },
) {
	return queryOptions({
		queryKey: githubQueryKeys.repoMilestones(scope, input),
		queryFn: () => getRepoMilestones({ data: input }),
		...githubCacheTimes("viewer"),
	});
}

export function githubMyIssuesQueryOptions(scope: GitHubQueryScope) {
	return queryOptions({
		queryKey: githubQueryKeys.issues.mine(scope),
		queryFn: () => getMyIssues(),
		...githubCacheTimes("mine"),
	});
}

export function githubIssuesFromUserQueryOptions(
	scope: GitHubQueryScope,
	input: IssuesFromUserQueryInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.issues.user(scope, input),
		queryFn: () => getIssuesFromUser({ data: input }),
		...githubCacheTimes("list"),
	});
}

export function githubIssuesFromRepoQueryOptions(
	scope: GitHubQueryScope,
	input: IssuesFromRepoQueryInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.issues.repo(scope, input),
		queryFn: () => getIssuesFromRepo({ data: input }),
		...githubCacheTimes("list"),
	});
}

export function githubIssueDetailQueryOptions(
	scope: GitHubQueryScope,
	input: IssueFromRepoQueryInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.issues.detail(scope, input),
		queryFn: () => getIssueFromRepo({ data: input }),
		...githubCacheTimes("detail"),
	});
}

export function githubIssuePageQueryOptions(
	scope: GitHubQueryScope,
	input: IssueFromRepoQueryInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.issues.page(scope, input),
		queryFn: () => getIssuePageData({ data: input }),
		...githubCacheTimes("detail"),
	});
}

export function githubIssueCommentsQueryOptions(
	scope: GitHubQueryScope,
	input: IssueFromRepoQueryInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.issues.comments(scope, input),
		queryFn: () => getIssueComments({ data: input }),
		...githubCacheTimes("activity"),
	});
}

export function githubCommentPageQueryOptions(
	scope: GitHubQueryScope,
	input: { owner: string; repo: string; issueNumber: number; page: number },
) {
	return queryOptions({
		queryKey: githubQueryKeys.commentPage(scope, input),
		queryFn: () => getCommentPage({ data: input }),
		...githubCacheTimes("activity"),
	});
}

export function githubTimelineEventPageQueryOptions(
	scope: GitHubQueryScope,
	input: { owner: string; repo: string; issueNumber: number; page: number },
) {
	return queryOptions({
		queryKey: githubQueryKeys.timelineEventPage(scope, input),
		queryFn: () => getTimelineEventPage({ data: input }),
		...githubCacheTimes("activity"),
	});
}
