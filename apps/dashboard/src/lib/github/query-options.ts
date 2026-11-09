import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import {
	type CommandPaletteSearchInput,
	getBranchComparison,
	getCommentPage,
	getCommitReference,
	getCompareDetail,
	getFileLastCommit,
	getGitHubViewer,
	getIssueComments,
	getIssueFromRepo,
	getIssuePageData,
	getIssuesFromRepo,
	getIssuesFromUser,
	getItemReference,
	getMyIssues,
	getMyPulls,
	getNotifications,
	getOpenPullForRefs,
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
	getRepoLabels,
	getRepoMilestones,
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
import { githubCachePolicy } from "../github-cache-policy";
import {
	adaptiveRefetchInterval,
	classifyPullStatus,
	classifyWorkflowJobs,
	classifyWorkflowRun,
} from "../github-refetch-policy";
import { ensureDefinedQueryData } from "../query-data";
import type { ReposHubInput } from "../repos-hub-filter";
import {
	type GitHubQueryScope,
	githubQueryKeys,
	type IssueFromRepoQueryInput,
	type IssuesFromRepoQueryInput,
	type IssuesFromUserQueryInput,
	type PullFromRepoQueryInput,
	type PullsFromRepoQueryInput,
	type PullsFromUserQueryInput,
	type WorkflowDefinitionQueryInput,
	type WorkflowJobLogsQueryInput,
	type WorkflowRunLogsBundleQueryInput,
	type WorkflowRunQueryInput,
	type WorkflowRunsFromRepoQueryInput,
} from "./query-keys";

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

export function githubOpenPullForRefsQueryOptions(
	scope: GitHubQueryScope,
	input: { owner: string; repo: string; base: string; head: string },
) {
	return queryOptions({
		queryKey: githubQueryKeys.pulls.forRefs(scope, input),
		queryFn: () => getOpenPullForRefs({ data: input }),
		staleTime: githubCachePolicy.list.staleTimeMs,
		gcTime: githubCachePolicy.list.gcTimeMs,
	});
}

export function githubRepoMilestonesQueryOptions(
	scope: GitHubQueryScope,
	input: { owner: string; repo: string },
) {
	return queryOptions({
		queryKey: githubQueryKeys.repoMilestones(scope, input),
		queryFn: () => getRepoMilestones({ data: input }),
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

export function githubRepoOverviewQueryOptions(
	scope: GitHubQueryScope,
	input: { owner: string; repo: string },
) {
	return queryOptions({
		queryKey: githubQueryKeys.repo.overview(scope, input),
		queryFn: () => getRepoOverview({ data: input }),
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

/** Splits a slashed `/commits/$` splat into ref + path (one GraphQL call). */
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

export function githubItemReferenceQueryOptions(
	scope: GitHubQueryScope,
	input: { owner: string; repo: string; number: number },
) {
	return queryOptions({
		queryKey: githubQueryKeys.references.item(scope, input),
		queryFn: () => getItemReference({ data: input }),
		staleTime: githubCachePolicy.itemReference.staleTimeMs,
		gcTime: githubCachePolicy.itemReference.gcTimeMs,
	});
}

export function githubCommitReferenceQueryOptions(
	scope: GitHubQueryScope,
	input: { owner: string; repo: string; sha: string },
) {
	return queryOptions({
		queryKey: githubQueryKeys.references.commit(scope, input),
		queryFn: () => getCommitReference({ data: input }),
		staleTime: githubCachePolicy.commitReference.staleTimeMs,
		gcTime: githubCachePolicy.commitReference.gcTimeMs,
	});
}
