import { createServerFn } from "@tanstack/react-start";
import type {
	PullComment,
	PullDetail,
	PullFileSummariesPage,
	PullFileSummariesPageInput,
	PullFilesPage,
	PullFilesPageInput,
	PullPageData,
	PullStatus,
	PullSummary,
} from "../github.types";
import { executeGitHubGraphQL, fetchGitHubResource } from "./client";
import {
	getGitHubContextForRepository,
	getGitHubUserContextForRepository,
} from "./installations";
import { buildRepositoryRef, mapPullSummary } from "./mappers";
import { mutateRepository, NOT_AUTHENTICATED } from "./mutations";
import {
	type RerunChecksInput,
	type RerunChecksResult,
	rerunPullChecks,
} from "./pull-check-reruns";
import {
	type CreatePullRequestInput,
	type CreatePullRequestResult,
	createPullRequestWithFollowUps,
} from "./pull-create";
import { getPullFileSummariesResult, getPullFilesResult } from "./pull-files";
import {
	applyPullListStats,
	buildPullListStatsQuery,
	type PullListStatsResponse,
} from "./pull-list-stats";
import { getPullPageDataResult } from "./pull-page-data";
import { getPullCommentsResult, getPullDetailResult } from "./pull-reads";
import { getPullStatusResult } from "./pull-status";
import {
	clampPage,
	clampPerPage,
	type GitHubClient,
	type GitHubContext,
	type MutationFailure,
	type MutationResult,
	type PullFromRepoInput,
	type RepoState,
	toMutationError,
} from "./shared";
import { identityValidator } from "./validators";

export type { RerunChecksInput, RerunChecksResult } from "./pull-check-reruns";
export type {
	CreatePullRequestInput,
	CreatePullRequestResult,
} from "./pull-create";

type PullSort = "created" | "long-running" | "popularity" | "updated";

export type PullsFromRepoInput = {
	owner: string;
	repo: string;
	state?: RepoState;
	page?: number;
	perPage?: number;
	sort?: PullSort;
	direction?: "asc" | "desc";
	withStats?: boolean;
};

async function withPullListStats(
	context: GitHubContext,
	data: PullsFromRepoInput,
	pulls: PullSummary[],
): Promise<PullSummary[]> {
	const numbers = pulls.map((pull) => pull.number);
	try {
		const response = await executeGitHubGraphQL<PullListStatsResponse>(
			context,
			`github pull list stats ${data.owner}/${data.repo}`,
			buildPullListStatsQuery(numbers),
			{ owner: data.owner, repo: data.repo },
		);
		return applyPullListStats(pulls, response);
	} catch {
		return pulls;
	}
}

export const getPullsFromRepo = createServerFn({ method: "GET" })
	.validator(identityValidator<PullsFromRepoInput>)
	.handler(async ({ data }): Promise<PullSummary[]> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return [];
		}

		const listing = {
			owner: data.owner,
			repo: data.repo,
			state: data.state ?? "open",
			page: clampPage(data.page),
			perPage: clampPerPage(data.perPage),
			sort: data.sort ?? "updated",
			direction: data.direction ?? "desc",
		} as const;
		const pulls = await fetchGitHubResource<
			Awaited<ReturnType<GitHubClient["rest"]["pulls"]["list"]>>["data"],
			PullSummary[]
		>({
			context,
			resource: "pulls.repo.v2",
			params: listing,
			request: () =>
				context.octokit.rest.pulls.list({
					owner: listing.owner,
					repo: listing.repo,
					state: listing.state,
					page: listing.page,
					per_page: listing.perPage,
					sort: listing.sort,
					direction: listing.direction,
				}),
			mapData: (pulls) =>
				pulls.map((pull) =>
					mapPullSummary(pull, buildRepositoryRef(data.owner, data.repo)),
				),
		});
		if (!data.withStats || pulls.length === 0) return pulls;
		return withPullListStats(context, data, pulls);
	});

export const getPullFromRepo = createServerFn({ method: "GET" })
	.validator(identityValidator<PullFromRepoInput>)
	.handler(async ({ data }): Promise<PullDetail | null> => {
		const context = await getGitHubContextForRepository(data);
		return context ? getPullDetailResult(context, data) : null;
	});

export const getPullComments = createServerFn({ method: "GET" })
	.validator(identityValidator<PullFromRepoInput>)
	.handler(async ({ data }): Promise<PullComment[]> => {
		const context = await getGitHubContextForRepository(data);
		return context ? getPullCommentsResult(context, data) : [];
	});

export const getPullStatus = createServerFn({ method: "GET" })
	.validator(identityValidator<PullFromRepoInput>)
	.handler(async ({ data }): Promise<PullStatus | null> => {
		const context = await getGitHubContextForRepository(data);
		return context ? getPullStatusResult(context, data) : null;
	});

export const getPullPageData = createServerFn({ method: "GET" })
	.validator(identityValidator<PullFromRepoInput>)
	.handler(async ({ data }): Promise<PullPageData | null> => {
		const context = await getGitHubContextForRepository(data);
		return context ? getPullPageDataResult(context, data) : null;
	});

export const getPullFileSummaries = createServerFn({ method: "GET" })
	.validator(identityValidator<PullFileSummariesPageInput>)
	.handler(async ({ data }): Promise<PullFileSummariesPage> => {
		const context = await getGitHubContextForRepository(data);
		return context
			? getPullFileSummariesResult(context, data)
			: { items: [], nextCursor: null };
	});

export const getPullFiles = createServerFn({ method: "GET" })
	.validator(identityValidator<PullFilesPageInput>)
	.handler(async ({ data }): Promise<PullFilesPage> => {
		const context = await getGitHubContextForRepository(data);
		return context
			? getPullFilesResult(context, data)
			: { files: [], nextPage: null };
	});

type UpdatePullBodyInput = PullFromRepoInput & { body: string };

export const updatePullBody = createServerFn({ method: "POST" })
	.validator(identityValidator<UpdatePullBodyInput>)
	.handler(async ({ data }): Promise<boolean> => {
		const context = await getGitHubUserContextForRepository(data);
		if (!context) {
			return false;
		}

		try {
			await context.octokit.rest.pulls.update({
				owner: data.owner,
				repo: data.repo,
				pull_number: data.pullNumber,
				body: data.body,
			});
			return true;
		} catch {
			return false;
		}
	});

type UpdatePullStateInput = PullFromRepoInput & {
	state: "open" | "closed";
};

export const updatePullState = createServerFn({ method: "POST" })
	.validator(identityValidator<UpdatePullStateInput>)
	.handler(
		({ data }): Promise<MutationResult> =>
			mutateRepository(
				data,
				`${data.state === "closed" ? "close" : "reopen"} pull request`,
				(context) =>
					context.octokit.rest.pulls.update({
						owner: data.owner,
						repo: data.repo,
						pull_number: data.pullNumber,
						state: data.state,
					}),
			),
	);

export const updatePullBranch = createServerFn({ method: "POST" })
	.validator(identityValidator<PullFromRepoInput>)
	.handler(
		({ data }): Promise<MutationResult> =>
			mutateRepository(data, "update branch", (context) =>
				context.octokit.rest.pulls.updateBranch({
					owner: data.owner,
					repo: data.repo,
					pull_number: data.pullNumber,
				}),
			),
	);

export type MergePullInput = PullFromRepoInput & {
	mergeMethod: "merge" | "squash" | "rebase";
	bypassProtections?: boolean;
	commitTitle?: string;
	commitMessage?: string;
};

export const mergePullRequest = createServerFn({ method: "POST" })
	.validator(identityValidator<MergePullInput>)
	.handler(
		({ data }): Promise<MutationResult> =>
			mutateRepository(data, "merge pull request", (context) =>
				context.octokit.rest.pulls.merge({
					owner: data.owner,
					repo: data.repo,
					pull_number: data.pullNumber,
					merge_method: data.mergeMethod,
					...(data.commitTitle && { commit_title: data.commitTitle }),
					...(data.commitMessage && { commit_message: data.commitMessage }),
				}),
			),
	);

export type ReadyForReviewInput = PullFromRepoInput & {
	/** GraphQL node id of the pull request (e.g. `PR_kwD...`). */
	pullId: string;
};

export const markPullReadyForReview = createServerFn({ method: "POST" })
	.validator(identityValidator<ReadyForReviewInput>)
	.handler(
		({ data }): Promise<MutationResult> =>
			mutateRepository(
				data,
				"mark pull request as ready for review",
				(context) =>
					context.octokit.graphql(
						`mutation($pullRequestId: ID!) {
							markPullRequestReadyForReview(input: { pullRequestId: $pullRequestId }) {
								pullRequest { isDraft }
							}
						}`,
						{ pullRequestId: data.pullId },
					),
			),
	);

export const deleteBranch = createServerFn({ method: "POST" })
	.validator(
		identityValidator<{
			owner: string;
			repo: string;
			branch: string;
			pullNumber: number;
		}>,
	)
	.handler(
		({ data }): Promise<MutationResult> =>
			mutateRepository(data, "delete branch", (context) =>
				context.octokit.rest.git.deleteRef({
					owner: data.owner,
					repo: data.repo,
					ref: `heads/${data.branch}`,
				}),
			),
	);

export const rerunChecks = createServerFn({ method: "POST" })
	.validator(identityValidator<RerunChecksInput>)
	.handler(async ({ data }): Promise<RerunChecksResult> => {
		const context = await getGitHubUserContextForRepository(data);
		return context ? rerunPullChecks(context, data) : NOT_AUTHENTICATED;
	});

export type ApproveWorkflowRunsInput = PullFromRepoInput & {
	workflowRunIds: number[];
};

export type ApproveWorkflowRunsResult =
	| { ok: true; approved: number; failed: number }
	| MutationFailure;

export const approveWorkflowRuns = createServerFn({ method: "POST" })
	.validator(identityValidator<ApproveWorkflowRunsInput>)
	.handler(async ({ data }): Promise<ApproveWorkflowRunsResult> => {
		const context = await getGitHubUserContextForRepository(data);
		if (!context) {
			return NOT_AUTHENTICATED;
		}

		const outcomes = await Promise.allSettled(
			data.workflowRunIds.map((runId) =>
				context.octokit.rest.actions.approveWorkflowRun({
					owner: data.owner,
					repo: data.repo,
					run_id: runId,
				}),
			),
		);
		const rejected = outcomes.filter(
			(outcome): outcome is PromiseRejectedResult =>
				outcome.status === "rejected",
		);
		const approved = outcomes.length - rejected.length;
		if (approved === 0 && rejected.length > 0) {
			return toMutationError("approve workflow runs", rejected[0].reason);
		}
		return { ok: true, approved, failed: rejected.length };
	});

export const createPullRequest = createServerFn({ method: "POST" })
	.validator(identityValidator<CreatePullRequestInput>)
	.handler(async ({ data }): Promise<CreatePullRequestResult> => {
		const context = await getGitHubUserContextForRepository(data);
		return context
			? createPullRequestWithFollowUps(context, data)
			: NOT_AUTHENTICATED;
	});
