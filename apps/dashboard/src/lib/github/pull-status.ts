import type { GitHubActor, PullStatus } from "../github.types";
import {
	getGitHubContext,
	getViewer,
	withGitHubOperationTimeout,
} from "./client";
import { getGitHubUserContextForRepository } from "./installations";
import { mapActor } from "./mappers";
import {
	getRepositoryPermissions,
	mergeRepositoryPermissions,
} from "./permissions";
import {
	type BranchTarget,
	getBranchProtectionBypassState,
	getRulesetBypassState,
	listBranchRules,
	requiredStatusContexts,
} from "./pull-bypass";
import {
	listCheckRunsForCommit,
	listCombinedStatusesForCommit,
	listWorkflowRunsForCommit,
	summarizePullChecks,
} from "./pull-checks";
import { getRawPull, type RepoPullDetail } from "./pull-reads";
import { dedupeGitHubRead } from "./request-dedup";
import {
	GITHUB_PAGINATED_OPERATION_TIMEOUT_MS,
	type GitHubContext,
	type PullFromRepoInput,
} from "./shared";

type PullReviewItem = Awaited<
	ReturnType<GitHubContext["octokit"]["rest"]["pulls"]["listReviews"]>
>["data"][number];

function latestReviewPerAuthor(reviews: PullReviewItem[]) {
	const latest = new Map<
		string,
		{ id: number; state: string; author: GitHubActor | null }
	>();
	for (const review of reviews) {
		if (!review.user?.login || review.state === "COMMENTED") {
			continue;
		}
		latest.set(review.user.login, {
			id: review.id,
			state: review.state,
			author: mapActor(review.user),
		});
	}
	return Array.from(latest.values());
}

async function getBaseDrift(
	context: GitHubContext,
	data: PullFromRepoInput,
	pull: RepoPullDetail,
): Promise<{ behindBy: number | null; conflictingFiles: string[] }> {
	const hasConflicts =
		pull.mergeable_state === "dirty" || pull.mergeable === false;
	try {
		const [comparison, pullFiles] = await Promise.all([
			context.octokit.rest.repos.compareCommits({
				owner: data.owner,
				repo: data.repo,
				base: pull.head.sha,
				head: pull.base.ref,
			}),
			hasConflicts
				? context.octokit.rest.pulls
						.listFiles({
							owner: data.owner,
							repo: data.repo,
							pull_number: data.pullNumber,
							per_page: 100,
						})
						.catch(() => null)
				: null,
		]);
		const baseChangedFiles = new Set(
			(comparison.data.files ?? []).map((file) => file.filename),
		);
		return {
			behindBy: comparison.data.ahead_by,
			conflictingFiles: (pullFiles?.data ?? [])
				.map((file) => file.filename)
				.filter((filename) => baseChangedFiles.has(filename)),
		};
	} catch {
		return { behindBy: null, conflictingFiles: [] };
	}
}

/**
 * Everything the merge box needs is independent once the two viewer contexts
 * are known, so it is read in one round instead of one call after another.
 */
async function computePullStatus(
	context: GitHubContext,
	data: PullFromRepoInput,
	pull: RepoPullDetail,
): Promise<PullStatus> {
	const [userContext, oauthContext] = await Promise.all([
		getGitHubUserContextForRepository(data),
		getGitHubContext(),
	]);
	const viewerContext = userContext ?? context;
	const otherOauthContext =
		oauthContext && oauthContext !== viewerContext ? oauthContext : null;

	const commit = { owner: data.owner, repo: data.repo, sha: pull.head.sha };
	const baseBranch: BranchTarget = {
		owner: data.owner,
		repo: data.repo,
		branch: pull.base.ref,
	};
	const viewerBranchRules = listBranchRules(viewerContext, baseBranch);
	const requiredContexts = viewerBranchRules
		.catch(() =>
			viewerContext === context ? [] : listBranchRules(context, baseBranch),
		)
		.then(requiredStatusContexts)
		.catch((): string[] => []);

	const [
		reviewsResponse,
		checkRuns,
		statuses,
		workflowRuns,
		required,
		viewerPermissions,
		oauthPermissions,
		baseDrift,
		viewer,
		rulesetBypass,
	] = await Promise.all([
		context.octokit.rest.pulls.listReviews({
			owner: data.owner,
			repo: data.repo,
			pull_number: data.pullNumber,
			per_page: 100,
		}),
		listCheckRunsForCommit(context, commit).catch(() => []),
		listCombinedStatusesForCommit(context, commit).catch(() => []),
		listWorkflowRunsForCommit(context, commit).catch(() => []),
		requiredContexts,
		getRepositoryPermissions(viewerContext, data.owner, data.repo),
		getRepositoryPermissions(otherOauthContext, data.owner, data.repo),
		getBaseDrift(context, data, pull),
		getViewer(viewerContext),
		getRulesetBypassState(
			[
				{ context: viewerContext, rules: () => viewerBranchRules },
				...(otherOauthContext
					? [
							{
								context: otherOauthContext,
								rules: () => listBranchRules(otherOauthContext, baseBranch),
							},
						]
					: []),
			],
			baseBranch,
		),
	]);

	const permissions = mergeRepositoryPermissions(
		viewerPermissions,
		oauthPermissions,
		pull.base.repo.permissions,
	);
	const canPush =
		!permissions || permissions.push === true || permissions.admin === true;
	const canBypassProtections =
		rulesetBypass ??
		(await getBranchProtectionBypassState({
			contexts: otherOauthContext
				? [viewerContext, otherOauthContext]
				: [viewerContext],
			target: baseBranch,
			permissions,
		})) ??
		permissions?.admin === true;

	return {
		reviews: latestReviewPerAuthor(reviewsResponse.data),
		...summarizePullChecks({
			checkRuns,
			statuses,
			workflowRuns,
			requiredContexts: required,
		}),
		mergeable: pull.mergeable,
		mergeableState:
			typeof pull.mergeable_state === "string" ? pull.mergeable_state : null,
		conflictingFiles: baseDrift.conflictingFiles,
		behindBy: baseDrift.behindBy,
		baseRefName: pull.base.ref,
		canUpdateBranch: pull.user?.login === viewer.login || canPush,
		canBypassProtections,
		canMerge: canPush,
	};
}

export async function getPullStatusResult(
	context: GitHubContext,
	data: PullFromRepoInput,
): Promise<PullStatus> {
	return dedupeGitHubRead<PullStatus>({
		userId: context.session.user.id,
		resource: "pulls.status.v3",
		params: data,
		fetcher: async () => {
			const pull = await getRawPull(context, data);
			return withGitHubOperationTimeout(
				`github pull status ${data.owner}/${data.repo}#${data.pullNumber}`,
				GITHUB_PAGINATED_OPERATION_TIMEOUT_MS,
				() => computePullStatus(context, data, pull),
			);
		},
	});
}
