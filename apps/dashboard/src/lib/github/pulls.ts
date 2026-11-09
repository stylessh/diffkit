import { createServerFn } from "@tanstack/react-start";
import { RequestError } from "octokit";
import type {
	GitHubActor,
	PullCheckRun,
	PullComment,
	PullCommit,
	PullDetail,
	PullFile,
	PullFileSummariesPage,
	PullFileSummariesPageInput,
	PullFileSummary,
	PullFilesPage,
	PullFilesPageInput,
	PullPageData,
	PullStatus,
	PullSummary,
	PullWorkflowApproval,
	RepositoryRef,
	RequestedTeam,
} from "../github.types";
import {
	executeGitHubGraphQL,
	fetchGitHubResource,
	GitHubOperationTimeoutError,
	getGitHubContext,
	getRemainingSearchTimeoutMs,
	getViewer,
	listPaginatedGitHubItems,
	withGitHubOperationTimeout,
} from "./client";
import {
	getGitHubContextForRepository,
	getGitHubUserContextForRepository,
} from "./installations";
import {
	buildCommentReactionSummary,
	buildRepositoryRef,
	mapActor,
	mapGraphQLActor,
	mapGraphQLComments,
	mapGraphQLLabels,
	mapGraphQLRepositoryRef,
	mapPullSummary,
	restEditedAt,
} from "./mappers";
import {
	getRepositoryPermissions,
	mergeRepositoryPermissions,
} from "./permissions";
import {
	applyPullListStats,
	buildPullListStatsQuery,
	type PullListStatsResponse,
} from "./pull-list-stats";
import { dedupeGitHubRead } from "./request-dedup";
import {
	clampPage,
	clampPerPage,
	GITHUB_MIN_OPERATION_TIMEOUT_MS,
	GITHUB_OPERATION_TIMEOUT_MS,
	GITHUB_PAGINATED_OPERATION_TIMEOUT_MS,
	type GitHubClient,
	type GitHubContext,
	type GitHubGraphQLActor,
	type GitHubGraphQLCommentConnection,
	type GitHubGraphQLLabel,
	type GitHubGraphQLRateLimit,
	type GitHubGraphQLRepositoryRef,
	is403ResourceError,
	type MutationFailure,
	type MutationResult,
	type PullFromRepoInput,
	type RepoState,
	type RepositoryPermissions,
	toMutationError,
} from "./shared";
import {
	COMMENTS_PER_PAGE,
	deriveHeadRefDeleted,
	getCommentsPageResult,
	getLoadedCommentPages,
	getTimelineEventsResult,
} from "./timeline";
import { identityValidator } from "./validators";

type GitHubGraphQLReviewRequestNode = {
	requestedReviewer:
		| ({
				__typename: "User";
				login: string;
				avatarUrl: string;
				url: string;
		  } & Record<string, unknown>)
		| {
				__typename: "Team";
				name: string;
				slug: string;
				url: string;
		  }
		| null;
};
type GitHubGraphQLPullPageResponse = {
	repository: {
		pullRequest: {
			id: string;
			databaseId: number | null;
			number: number;
			title: string;
			state: string;
			isDraft: boolean;
			createdAt: string;
			updatedAt: string;
			closedAt: string | null;
			mergedAt: string | null;
			url: string;
			body: string;
			reactions: {
				nodes: Array<{
					content: string;
					user: { login: string } | null;
				} | null> | null;
			} | null;
			additions: number;
			deletions: number;
			changedFiles: number;
			comments: { totalCount: number };
			author: GitHubGraphQLActor;
			labels: {
				nodes: Array<GitHubGraphQLLabel | null> | null;
			} | null;
			headRefName: string;
			headRefOid: string;
			headRepositoryOwner: { login: string } | null;
			baseRefName: string;
			merged: boolean;
			mergeCommit: { oid: string } | null;
			mergedBy: GitHubGraphQLActor;
			mergeable: string;
			mergeStateStatus: string;
			repository: GitHubGraphQLRepositoryRef;
			reviewThreads: { totalCount: number };
			reviewRequests: {
				nodes: Array<GitHubGraphQLReviewRequestNode | null> | null;
			} | null;
			commits: {
				totalCount: number;
				nodes: Array<{
					commit: {
						oid: string;
						message: string;
						committedDate: string;
						author: {
							user?: {
								login: string;
								avatarUrl: string;
								url: string;
							} | null;
						} | null;
					};
				} | null> | null;
			};
			firstComments: GitHubGraphQLCommentConnection;
			lastComments: GitHubGraphQLCommentConnection;
		} | null;
	};
	rateLimit: GitHubGraphQLRateLimit;
};

type RepoPullDetail = Awaited<
	ReturnType<GitHubClient["rest"]["pulls"]["get"]>
>["data"];
type RepoPullFile = Awaited<
	ReturnType<GitHubClient["rest"]["pulls"]["listFiles"]>
>["data"][number];
type GitHubBranchRule = {
	ruleset_id?: number;
};
type GitHubRepositoryRuleset = {
	current_user_can_bypass?:
		| "always"
		| "pull_requests_only"
		| "never"
		| "exempt";
};
type GitHubBranchProtection = {
	enforce_admins?: {
		enabled?: boolean;
	};
	required_pull_request_reviews?: {
		bypass_pull_request_allowances?: {
			users?: Array<{ login?: string }>;
			teams?: Array<{ slug?: string }>;
			apps?: Array<{ slug?: string }>;
		};
	};
};
type GitHubUserTeam = {
	slug?: string;
	organization?: {
		login?: string;
	};
};
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

type CheckRunPayload = {
	id: number;
	name: string;
	status: string;
	conclusion: string | null;
};

export function deduplicateCheckRuns<T extends CheckRunPayload>(
	checkRuns: T[],
): T[] {
	const latestByName = new Map<string, T>();
	for (const check of checkRuns) {
		const existing = latestByName.get(check.name);
		if (!existing || check.id > existing.id) {
			latestByName.set(check.name, check);
		}
	}
	return Array.from(latestByName.values());
}

/** Must agree with the UI's `getCheckRunStatus`. */
export function isFailedCheckRun(run: CheckRunPayload): boolean {
	return (
		run.status === "completed" &&
		run.conclusion !== "success" &&
		run.conclusion !== "neutral" &&
		run.conclusion !== "skipped" &&
		run.conclusion !== "stale" &&
		run.conclusion !== null
	);
}

/** The branch-rules endpoint covers both rulesets and classic branch protection. */
async function getRequiredStatusContexts(
	context: GitHubContext,
	params: { owner: string; repo: string; branch: string },
): Promise<string[]> {
	return dedupeGitHubRead<string[]>({
		userId: context.session.user.id,
		resource: "repos.requiredStatusContexts",
		params,
		fetcher: async () => {
			const contexts = new Set<string>();
			try {
				const { data: rules } = await context.octokit.rest.repos.getBranchRules(
					{
						owner: params.owner,
						repo: params.repo,
						branch: params.branch,
					},
				);
				for (const rule of rules) {
					if (rule.type !== "required_status_checks") continue;
					const parameters = (rule as { parameters?: unknown }).parameters;
					if (!parameters || typeof parameters !== "object") continue;
					const required = (
						parameters as {
							required_status_checks?: Array<{ context?: unknown }>;
						}
					).required_status_checks;
					if (!Array.isArray(required)) continue;
					for (const entry of required) {
						if (entry && typeof entry.context === "string") {
							contexts.add(entry.context);
						}
					}
				}
			} catch {
				// Missing permission or unavailable — treat as no required contexts.
			}
			return Array.from(contexts);
		},
	});
}

function mapPullDetail(
	pull: RepoPullDetail,
	repository: RepositoryRef,
): PullDetail {
	return {
		...mapPullSummary(pull, repository),
		graphqlId:
			"node_id" in pull && typeof pull.node_id === "string"
				? pull.node_id
				: undefined,
		body: pull.body ?? "",
		additions: pull.additions,
		deletions: pull.deletions,
		changedFiles: pull.changed_files,
		commits: pull.commits,
		reviewComments: pull.review_comments,
		headRefName: pull.head.ref,
		headSha: pull.head.sha,
		headRepoOwner: pull.head.repo?.owner?.login ?? null,
		baseRefName: pull.base.ref,
		isMerged: pull.merged,
		mergeCommitSha: pull.merge_commit_sha ?? null,
		mergedBy: pull.merged_by ? mapActor(pull.merged_by) : null,
		mergeable: pull.mergeable,
		mergeableState:
			typeof pull.mergeable_state === "string" ? pull.mergeable_state : null,
		requestedReviewers: (pull.requested_reviewers ?? [])
			.map((reviewer) => mapActor(reviewer))
			.filter((reviewer): reviewer is GitHubActor => Boolean(reviewer)),
		requestedTeams: (pull.requested_teams ?? []).map((team) => ({
			slug: team.slug,
			name: team.name,
			url: team.html_url,
		})),
	};
}

function mapGraphQLPullDetail(
	pull: NonNullable<GitHubGraphQLPullPageResponse["repository"]["pullRequest"]>,
	viewerLogin: string | undefined,
): PullDetail {
	const requestedReviewers: GitHubActor[] = [];
	const requestedTeams: RequestedTeam[] = [];

	for (const node of pull.reviewRequests?.nodes ?? []) {
		const reviewer = node?.requestedReviewer;
		if (!reviewer) {
			continue;
		}

		if (reviewer.__typename === "Team") {
			requestedTeams.push({
				slug: reviewer.slug,
				name: reviewer.name,
				url: reviewer.url,
			});
			continue;
		}

		const actor = mapGraphQLActor(reviewer);
		if (actor) {
			requestedReviewers.push(actor);
		}
	}

	return {
		id: pull.databaseId ?? 0,
		graphqlId: pull.id,
		number: pull.number,
		title: pull.title,
		state: pull.state.toLowerCase(),
		isDraft: pull.isDraft,
		createdAt: pull.createdAt,
		updatedAt: pull.updatedAt,
		closedAt: pull.closedAt,
		mergedAt: pull.mergedAt,
		comments: pull.comments.totalCount,
		url: pull.url,
		author: mapGraphQLActor(pull.author),
		labels: mapGraphQLLabels(pull.labels),
		repository: mapGraphQLRepositoryRef(pull.repository),
		reactions: buildCommentReactionSummary(
			pull.reactions?.nodes ?? undefined,
			viewerLogin,
		),
		body: pull.body,
		additions: pull.additions,
		deletions: pull.deletions,
		changedFiles: pull.changedFiles,
		commits: pull.commits.totalCount,
		reviewComments: pull.reviewThreads.totalCount,
		headRefName: pull.headRefName,
		headSha: pull.headRefOid,
		headRepoOwner: pull.headRepositoryOwner?.login ?? null,
		baseRefName: pull.baseRefName,
		isMerged: pull.merged,
		mergeCommitSha: pull.mergeCommit?.oid ?? null,
		mergedBy: mapGraphQLActor(pull.mergedBy),
		mergeable:
			pull.mergeable === "MERGEABLE"
				? true
				: pull.mergeable === "CONFLICTING"
					? false
					: null,
		mergeableState: pull.mergeStateStatus?.toLowerCase() ?? null,
		requestedReviewers,
		requestedTeams,
	};
}

function mapGraphQLPullCommits(
	pull: NonNullable<GitHubGraphQLPullPageResponse["repository"]["pullRequest"]>,
): PullCommit[] {
	return (pull.commits.nodes ?? []).flatMap((node) => {
		if (!node) {
			return [];
		}

		return [
			{
				sha: node.commit.oid,
				message: node.commit.message,
				createdAt: node.commit.committedDate,
				author: mapGraphQLActor(
					node.commit.author?.user
						? {
								...node.commit.author.user,
								__typename: "User",
							}
						: null,
				),
			},
		];
	});
}

function isBypassableRulesetMode(
	mode: GitHubRepositoryRuleset["current_user_can_bypass"] | undefined,
) {
	return (
		mode === "always" || mode === "pull_requests_only" || mode === "exempt"
	);
}

async function getRulesetPullRequestBypassState({
	branch,
	context,
	owner,
	repo,
}: {
	branch: string;
	context: GitHubContext;
	owner: string;
	repo: string;
}) {
	try {
		const rulesResponse = await context.octokit.request(
			"GET /repos/{owner}/{repo}/rules/branches/{branch}",
			{
				owner,
				repo,
				branch,
				per_page: 100,
			},
		);
		const rules = rulesResponse.data as GitHubBranchRule[];
		const rulesetIds = Array.from(
			new Set(
				rules
					.map((rule) => rule.ruleset_id)
					.filter((id): id is number => typeof id === "number"),
			),
		);

		if (rulesetIds.length === 0) {
			return null;
		}

		const rulesets = await Promise.all(
			rulesetIds.map(async (rulesetId) => {
				const response = await context.octokit.request(
					"GET /repos/{owner}/{repo}/rulesets/{ruleset_id}",
					{
						owner,
						repo,
						ruleset_id: rulesetId,
						includes_parents: true,
					},
				);
				return response.data as GitHubRepositoryRuleset;
			}),
		);

		if (
			rulesets.some((ruleset) => ruleset.current_user_can_bypass === "never")
		) {
			return false;
		}

		if (
			rulesets.every((ruleset) =>
				isBypassableRulesetMode(ruleset.current_user_can_bypass),
			)
		) {
			return true;
		}

		return null;
	} catch {
		return null;
	}
}

function loginMatches(left: string | undefined, right: string) {
	return left?.toLowerCase() === right.toLowerCase();
}

async function getAuthenticatedUserTeamSlugsForOrg(
	context: GitHubContext,
	org: string,
) {
	const teamSlugs = new Set<string>();
	let page = 1;

	while (true) {
		const response = await context.octokit.request("GET /user/teams", {
			page,
			per_page: 100,
		});
		const teams = response.data as GitHubUserTeam[];
		for (const team of teams) {
			if (loginMatches(team.organization?.login, org) && team.slug) {
				teamSlugs.add(team.slug.toLowerCase());
			}
		}

		if (teams.length < 100) {
			break;
		}

		page += 1;
	}

	return teamSlugs;
}

async function legacyBranchProtectionAllowsPullRequestBypass({
	branch,
	context,
	owner,
	permissions,
	repo,
	viewerLogin,
}: {
	branch: string;
	context: GitHubContext;
	owner: string;
	permissions: RepositoryPermissions | undefined;
	repo: string;
	viewerLogin: string;
}) {
	try {
		const response = await context.octokit.request(
			"GET /repos/{owner}/{repo}/branches/{branch}/protection",
			{
				owner,
				repo,
				branch,
			},
		);
		const protection = response.data as GitHubBranchProtection;
		const allowances =
			protection.required_pull_request_reviews?.bypass_pull_request_allowances;
		const allowedUsers = allowances?.users ?? [];
		if (allowedUsers.some((user) => loginMatches(user.login, viewerLogin))) {
			return true;
		}

		const allowedTeamSlugs = (allowances?.teams ?? []).flatMap((team) =>
			team.slug ? [team.slug.toLowerCase()] : [],
		);
		if (allowedTeamSlugs.length > 0) {
			const userTeamSlugs = await getAuthenticatedUserTeamSlugsForOrg(
				context,
				owner,
			);
			if (allowedTeamSlugs.some((slug) => userTeamSlugs.has(slug))) {
				return true;
			}
		}

		return (
			permissions?.admin === true && protection.enforce_admins?.enabled !== true
		);
	} catch {
		return null;
	}
}

async function getPullRequestBypassState({
	branch,
	context,
	fallbackContext,
	owner,
	permissions,
	repo,
}: {
	branch: string;
	context: GitHubContext;
	fallbackContext: GitHubContext | null;
	owner: string;
	permissions: RepositoryPermissions | undefined;
	repo: string;
}) {
	const contexts = [context, fallbackContext].filter(
		(candidate, index, candidates): candidate is GitHubContext =>
			Boolean(candidate) && candidates.indexOf(candidate) === index,
	);

	for (const candidate of contexts) {
		const candidateRulesetState = await getRulesetPullRequestBypassState({
			branch,
			context: candidate,
			owner,
			repo,
		});
		if (candidateRulesetState === false) {
			return false;
		}
		if (candidateRulesetState === true) {
			return true;
		}
	}

	for (const candidate of contexts) {
		try {
			const viewer = await getViewer(candidate);
			const candidateLegacyState =
				await legacyBranchProtectionAllowsPullRequestBypass({
					branch,
					context: candidate,
					owner,
					permissions,
					repo,
					viewerLogin: viewer.login,
				});
			if (candidateLegacyState === false) {
				return false;
			}
			if (candidateLegacyState === true) {
				return true;
			}
		} catch {}
	}

	return permissions?.admin === true;
}

async function getCachedPullResponse({
	context,
	data,
	resource,
}: {
	context: GitHubContext;
	data: PullFromRepoInput;
	resource: string;
}) {
	return fetchGitHubResource<RepoPullDetail, RepoPullDetail>({
		context,
		resource,
		params: data,
		request: () =>
			context.octokit.rest.pulls.get({
				owner: data.owner,
				repo: data.repo,
				pull_number: data.pullNumber,
			}),
		mapData: (pull) => pull,
	});
}

async function getPullDetailResult(
	context: GitHubContext,
	data: PullFromRepoInput,
): Promise<PullDetail> {
	const pull = await getCachedPullResponse({
		context,
		data,
		resource: "pulls.detail.raw",
	});

	return mapPullDetail(pull, buildRepositoryRef(data.owner, data.repo));
}

async function getPullCommentsResult(
	context: GitHubContext,
	data: PullFromRepoInput,
): Promise<PullComment[]> {
	type IssueComment = Awaited<
		ReturnType<GitHubClient["rest"]["issues"]["listComments"]>
	>["data"][number];

	return fetchGitHubResource<IssueComment[], PullComment[]>({
		context,
		resource: "pulls.comments",
		params: data,
		request: () =>
			context.octokit.rest.issues.listComments({
				owner: data.owner,
				repo: data.repo,
				issue_number: data.pullNumber,
				per_page: 10,
			}),
		mapData: (comments) =>
			comments.map((comment) => {
				const nodeId =
					"node_id" in comment &&
					typeof (comment as { node_id?: unknown }).node_id === "string"
						? (comment as { node_id: string }).node_id
						: undefined;
				return {
					id: comment.id,
					...(nodeId ? { graphqlId: nodeId } : {}),
					body: comment.body ?? "",
					createdAt: comment.created_at,
					editedAt: restEditedAt(comment),
					author: comment.user
						? {
								login: comment.user.login,
								avatarUrl: comment.user.avatar_url,
								url: comment.user.html_url,
								type: comment.user.type ?? "User",
							}
						: null,
				};
			}),
	});
}

async function getPullCommitsResult(
	context: GitHubContext,
	data: PullFromRepoInput,
): Promise<PullCommit[]> {
	type PullCommitResponse = Awaited<
		ReturnType<GitHubClient["rest"]["pulls"]["listCommits"]>
	>["data"][number];

	return fetchGitHubResource<PullCommitResponse[], PullCommit[]>({
		context,
		resource: "pulls.commits",
		params: data,
		request: () =>
			context.octokit.rest.pulls.listCommits({
				owner: data.owner,
				repo: data.repo,
				pull_number: data.pullNumber,
				per_page: 100,
			}),
		mapData: (commits) =>
			commits.map((c) => ({
				sha: c.sha,
				message: c.commit.message,
				createdAt: c.commit.author?.date ?? c.commit.committer?.date ?? "",
				author: c.author
					? {
							login: c.author.login,
							avatarUrl: c.author.avatar_url,
							url: c.author.html_url,
							type: c.author.type ?? "User",
						}
					: null,
			})),
	});
}

async function computePullStatus(
	context: GitHubContext,
	data: PullFromRepoInput,
	pull: RepoPullDetail,
): Promise<PullStatus> {
	type CheckRunItem = Awaited<
		ReturnType<GitHubClient["rest"]["checks"]["listForRef"]>
	>["data"]["check_runs"][number];
	type CombinedStatusItem = Awaited<
		ReturnType<GitHubClient["rest"]["repos"]["getCombinedStatusForRef"]>
	>["data"]["statuses"][number];
	type WorkflowRunItem = Awaited<
		ReturnType<GitHubClient["rest"]["actions"]["listWorkflowRunsForRepo"]>
	>["data"]["workflow_runs"][number];

	const [
		reviewsResponse,
		allCheckRuns,
		allCombinedStatuses,
		allWorkflowRuns,
		requiredContexts,
		userContext,
		oauthContext,
	] = await Promise.all([
		context.octokit.rest.pulls.listReviews({
			owner: data.owner,
			repo: data.repo,
			pull_number: data.pullNumber,
			per_page: 100,
		}),
		listPaginatedGitHubItems<CheckRunItem>({
			label: `pull status check runs ${data.owner}/${data.repo}#${data.pullNumber}`,
			request: (page) =>
				context.octokit.rest.checks.listForRef({
					owner: data.owner,
					repo: data.repo,
					ref: pull.head.sha,
					page,
					per_page: 100,
				}),
			getItems: (payload) =>
				((payload as { check_runs?: CheckRunItem[] }).check_runs ??
					[]) as CheckRunItem[],
		}).catch((): CheckRunItem[] => []),
		listPaginatedGitHubItems<CombinedStatusItem>({
			label: `pull status combined statuses ${data.owner}/${data.repo}#${data.pullNumber}`,
			request: (page) =>
				context.octokit.rest.repos.getCombinedStatusForRef({
					owner: data.owner,
					repo: data.repo,
					ref: pull.head.sha,
					page,
					per_page: 100,
				}),
			getItems: (payload) =>
				((payload as { statuses?: CombinedStatusItem[] }).statuses ??
					[]) as CombinedStatusItem[],
		}).catch((): CombinedStatusItem[] => []),
		listPaginatedGitHubItems<WorkflowRunItem>({
			label: `pull status workflow runs ${data.owner}/${data.repo}#${data.pullNumber}`,
			request: (page) =>
				context.octokit.rest.actions.listWorkflowRunsForRepo({
					owner: data.owner,
					repo: data.repo,
					head_sha: pull.head.sha,
					page,
					per_page: 100,
				}),
			getItems: (payload) =>
				((payload as { workflow_runs?: WorkflowRunItem[] }).workflow_runs ??
					[]) as WorkflowRunItem[],
		}).catch((): WorkflowRunItem[] => []),
		getRequiredStatusContexts(context, {
			owner: data.owner,
			repo: data.repo,
			branch: pull.base.ref,
		}).catch(() => []),
		getGitHubUserContextForRepository(data),
		getGitHubContext(),
	]);
	const permissions = mergeRepositoryPermissions(
		await getRepositoryPermissions(
			userContext ?? context,
			data.owner,
			data.repo,
		),
		await getRepositoryPermissions(oauthContext, data.owner, data.repo),
		pull.base.repo.permissions,
	);

	const latestReviews = new Map<
		string,
		{ id: number; state: string; author: GitHubActor | null }
	>();
	for (const review of reviewsResponse.data) {
		if (!review.user?.login || review.state === "COMMENTED") {
			continue;
		}

		latestReviews.set(review.user.login, {
			id: review.id,
			state: review.state,
			author: mapActor(review.user),
		});
	}

	const checkRuns = deduplicateCheckRuns(allCheckRuns);
	const requiredContextSet = new Set(requiredContexts);

	const workflowRunIdByCheckSuiteId = new Map<number, number>();
	for (const run of allWorkflowRuns) {
		if (run.check_suite_id != null) {
			workflowRunIdByCheckSuiteId.set(run.check_suite_id, run.id);
		}
	}

	const mappedCheckRuns: PullCheckRun[] = checkRuns.map((check) => {
		const suiteId = check.check_suite?.id ?? null;
		return {
			id: check.id,
			name: check.name,
			status: check.status,
			conclusion: check.conclusion,
			appAvatarUrl: check.app?.owner?.avatar_url ?? null,
			outputTitle: check.output?.title ?? null,
			startedAt: check.started_at ?? null,
			htmlUrl: check.html_url ?? null,
			required: requiredContextSet.has(check.name),
			workflowRunId:
				suiteId != null
					? (workflowRunIdByCheckSuiteId.get(suiteId) ?? null)
					: null,
		};
	});

	// Commit statuses (e.g. CodeRabbit, CircleCI) — separate from Check Runs.
	// GitHub's combined-status endpoint returns the latest status per context
	// within each page; dedup across pages here in case the same context bleeds
	// across page boundaries.
	const combinedStatusesByContext = new Map<string, CombinedStatusItem>();
	for (const status of allCombinedStatuses) {
		const existing = combinedStatusesByContext.get(status.context);
		if (!existing || status.id > existing.id) {
			combinedStatusesByContext.set(status.context, status);
		}
	}
	const combinedStatuses = Array.from(combinedStatusesByContext.values());
	const checkRunNames = new Set(mappedCheckRuns.map((run) => run.name));
	const mappedStatuses: PullCheckRun[] = combinedStatuses
		.filter((status) => !checkRunNames.has(status.context))
		.map((status) => {
			const state = status.state;
			const isPending = state === "pending";
			return {
				id: status.id,
				name: status.context,
				status: isPending ? "in_progress" : "completed",
				conclusion: isPending
					? null
					: state === "success"
						? "success"
						: "failure",
				appAvatarUrl: status.avatar_url ?? null,
				outputTitle: status.description ?? null,
				startedAt: status.created_at ?? null,
				htmlUrl: status.target_url ?? null,
				required: requiredContextSet.has(status.context),
				workflowRunId: null,
			};
		});

	// Required contexts that haven't been reported yet → synthesize "expected" rows.
	const reportedNames = new Set([
		...mappedCheckRuns.map((run) => run.name),
		...mappedStatuses.map((run) => run.name),
	]);
	const expectedChecks: PullCheckRun[] = requiredContexts
		.filter((context) => !reportedNames.has(context))
		.map((contextName, index) => ({
			id: -1 - index,
			name: contextName,
			status: "expected",
			conclusion: null,
			appAvatarUrl: null,
			outputTitle: null,
			startedAt: null,
			htmlUrl: null,
			required: true,
			workflowRunId: null,
		}));

	const combinedChecks: PullCheckRun[] = [
		...mappedCheckRuns,
		...mappedStatuses,
		...expectedChecks,
	];

	let passed = 0;
	let failed = 0;
	let pending = 0;
	let skipped = 0;
	let expected = 0;
	for (const check of combinedChecks) {
		if (check.status === "expected") {
			expected += 1;
		} else if (check.status !== "completed") {
			pending += 1;
		} else if (
			check.conclusion === "success" ||
			check.conclusion === "neutral"
		) {
			passed += 1;
		} else if (check.conclusion === "skipped" || check.conclusion === "stale") {
			skipped += 1;
		} else if (check.conclusion !== null) {
			failed += 1;
		}
	}

	// Workflow runs awaiting approval — three shapes GitHub uses:
	//   - status=waiting              → deployment environment awaits approval
	//   - status=action_required      → run is blocked pre-start (e.g. during re-run)
	//   - status=completed, conclusion=action_required → first-time contributor gate
	const pendingWorkflowApprovals: PullWorkflowApproval[] = allWorkflowRuns
		.filter(
			(run) =>
				run.status === "waiting" ||
				run.status === "action_required" ||
				(run.status === "completed" && run.conclusion === "action_required"),
		)
		.map((run) => ({
			workflowRunId: run.id,
			name: run.name ?? `Workflow #${run.id}`,
			event: run.event,
		}));

	let behindBy: number | null = null;
	let conflictingFiles: string[] = [];
	const hasConflicts =
		pull.mergeable_state === "dirty" || pull.mergeable === false;
	try {
		const [comparison, prFiles] = await Promise.all([
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
		behindBy = comparison.data.ahead_by;

		if (hasConflicts && prFiles && comparison.data.files) {
			const baseChangedFiles = new Set(
				comparison.data.files.map((f) => f.filename),
			);
			conflictingFiles = prFiles.data
				.map((f) => f.filename)
				.filter((f) => baseChangedFiles.has(f));
		}
	} catch {
		behindBy = null;
	}

	const viewer = await getViewer(userContext ?? context);
	const isViewerAuthor = pull.user?.login === viewer.login;
	const canUpdateBranch =
		isViewerAuthor ||
		!permissions ||
		permissions.push === true ||
		permissions.admin === true;
	const canMerge =
		!permissions || permissions.push === true || permissions.admin === true;
	const canBypassProtections = await getPullRequestBypassState({
		branch: pull.base.ref,
		context: userContext ?? context,
		fallbackContext: oauthContext,
		owner: data.owner,
		permissions,
		repo: data.repo,
	});

	return {
		reviews: Array.from(latestReviews.values()),
		checks: {
			total: combinedChecks.length,
			passed,
			failed,
			pending,
			skipped,
			expected,
		},
		checkRuns: combinedChecks,
		pendingWorkflowApprovals,
		mergeable: pull.mergeable,
		mergeableState:
			typeof pull.mergeable_state === "string" ? pull.mergeable_state : null,
		conflictingFiles,
		behindBy,
		baseRefName: pull.base.ref,
		canUpdateBranch,
		canBypassProtections,
		canMerge,
	};
}

async function getPullStatusResult(
	context: GitHubContext,
	data: PullFromRepoInput,
	pull?: RepoPullDetail,
): Promise<PullStatus> {
	return dedupeGitHubRead<PullStatus>({
		userId: context.session.user.id,
		resource: "pulls.status.v3",
		params: data,
		fetcher: async () => {
			const pullForStatus =
				pull ??
				(await getCachedPullResponse({
					context,
					data,
					resource: "pulls.status.raw",
				}));

			return await withGitHubOperationTimeout(
				`github pull status ${data.owner}/${data.repo}#${data.pullNumber}`,
				GITHUB_PAGINATED_OPERATION_TIMEOUT_MS,
				() => computePullStatus(context, data, pullForStatus),
			);
		},
	});
}

async function getPullPageDataViaGraphQL(
	context: GitHubContext,
	data: PullFromRepoInput,
): Promise<PullPageData> {
	return dedupeGitHubRead<PullPageData>({
		userId: context.session.user.id,
		resource: "pulls.pageData.graphql.v2",
		params: data,
		fetcher: async () => {
			const viewerPromise = getGitHubUserContextForRepository({
				owner: data.owner,
				repo: data.repo,
			}).then((userCtx) => (userCtx ? getViewer(userCtx) : null));

			const [response, timelineResult, viewer] = await Promise.all([
				executeGitHubGraphQL<GitHubGraphQLPullPageResponse>(
					context,
					`github pull page ${data.owner}/${data.repo}#${data.pullNumber}`,
					`query($owner: String!, $repo: String!, $number: Int!) {
						repository(owner: $owner, name: $repo) {
							pullRequest(number: $number) {
								id
								databaseId
								number
								title
								state
								isDraft
								createdAt
								updatedAt
								closedAt
								mergedAt
								url
								body
								reactions(first: 100) {
									nodes { content user { login } }
								}
								additions
								deletions
								changedFiles
								comments { totalCount }
								author { __typename login avatarUrl url }
								labels(first: 20) {
									nodes { name color description }
								}
								headRefName
								headRefOid
								headRepositoryOwner { login }
								baseRefName
								merged
								mergeCommit { oid }
								mergedBy { __typename login avatarUrl url }
								mergeable
								mergeStateStatus
								repository {
									name
									nameWithOwner
									url
									isPrivate
									owner { login }
								}
								reviewThreads(first: 1) { totalCount }
								reviewRequests(first: 100) {
									nodes {
										requestedReviewer {
											__typename
											... on User {
												login
												avatarUrl
												url
											}
											... on Team {
												name
												slug
												url
											}
										}
									}
								}
								commits(first: 100) {
									totalCount
									nodes {
										commit {
											oid
											message
											committedDate
											author {
												user {
													login
													avatarUrl
													url
												}
											}
										}
									}
								}
								firstComments: comments(first: 30) {
									totalCount
									nodes {
										id
										databaseId
										body
										createdAt
										lastEditedAt
										author { __typename login avatarUrl url }
										reactions(first: 100) {
											nodes { content user { login } }
										}
									}
								}
								lastComments: comments(last: 30) {
									totalCount
									nodes {
										id
										databaseId
										body
										createdAt
										lastEditedAt
										author { __typename login avatarUrl url }
										reactions(first: 100) {
											nodes { content user { login } }
										}
									}
								}
							}
						}
						rateLimit {
							cost
							remaining
							resetAt
						}
					}`,
					{
						owner: data.owner,
						repo: data.repo,
						number: data.pullNumber,
					},
				),
				getTimelineEventsResult(context, {
					owner: data.owner,
					repo: data.repo,
					issueNumber: data.pullNumber,
				}),
				viewerPromise,
			]);

			const pull = response.repository.pullRequest;
			if (!pull) {
				throw new Error(
					`Pull request not found: ${data.owner}/${data.repo}#${data.pullNumber}`,
				);
			}

			const totalComments = pull.comments.totalCount;
			const loadedPages = getLoadedCommentPages(totalComments);
			const detail = mapGraphQLPullDetail(pull, viewer?.login);
			const events = timelineResult.events;

			return {
				detail,
				comments: mapGraphQLComments(
					viewer?.login,
					pull.firstComments,
					pull.lastComments,
				),
				commits: mapGraphQLPullCommits(pull),
				events,
				commentPagination: {
					totalCount: totalComments,
					perPage: COMMENTS_PER_PAGE,
					loadedPages,
				},
				eventPagination: {
					loadedPages: [1],
					hasMore: timelineResult.hasMore,
				},
				headRefDeleted: deriveHeadRefDeleted(events),
			};
		},
	});
}

async function getPullPageDataViaRest(
	context: GitHubContext,
	data: PullFromRepoInput,
): Promise<PullPageData> {
	const pull = await getCachedPullResponse({
		context,
		data,
		resource: "pulls.detail.raw",
	});

	const totalComments = pull.comments ?? 0;
	const totalPages = Math.max(1, Math.ceil(totalComments / COMMENTS_PER_PAGE));
	const issueData = {
		owner: data.owner,
		repo: data.repo,
		issueNumber: data.pullNumber,
	};

	const pagesToFetch = totalPages === 1 ? [1] : [1, totalPages];

	const [commentsPages, commits, timelineResult] = await Promise.all([
		Promise.all(
			pagesToFetch.map((p) =>
				getCommentsPageResult(context, { ...issueData, page: p }),
			),
		),
		getPullCommitsResult(context, data),
		getTimelineEventsResult(context, issueData),
	]);

	const allComments = commentsPages.flatMap((p) => p.comments);

	return {
		detail: mapPullDetail(pull, buildRepositoryRef(data.owner, data.repo)),
		comments: allComments,
		commits,
		events: timelineResult.events,
		commentPagination: {
			totalCount: totalComments,
			perPage: COMMENTS_PER_PAGE,
			loadedPages: pagesToFetch,
		},
		eventPagination: {
			loadedPages: [1],
			hasMore: timelineResult.hasMore,
		},
		headRefDeleted: deriveHeadRefDeleted(timelineResult.events),
	};
}

async function getPullPageDataResult(
	context: GitHubContext,
	data: PullFromRepoInput,
): Promise<PullPageData> {
	try {
		return await getPullPageDataViaGraphQL(context, data);
	} catch (error) {
		console.error("[pull-page:gql] failed, falling back to REST", error);
		return getPullPageDataViaRest(context, data);
	}
}

export const getPullsFromRepo = createServerFn({ method: "GET" })
	.validator(identityValidator<PullsFromRepoInput>)
	.handler(async ({ data }): Promise<PullSummary[]> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return [];
		}

		const pulls = await fetchGitHubResource<
			Awaited<ReturnType<GitHubClient["rest"]["pulls"]["list"]>>["data"],
			PullSummary[]
		>({
			context,
			resource: "pulls.repo.v2",
			params: {
				owner: data.owner,
				repo: data.repo,
				state: data.state ?? "open",
				page: clampPage(data.page),
				perPage: clampPerPage(data.perPage),
				sort: data.sort ?? "updated",
				direction: data.direction ?? "desc",
			},
			request: () =>
				context.octokit.rest.pulls.list({
					owner: data.owner,
					repo: data.repo,
					state: data.state ?? "open",
					page: clampPage(data.page),
					per_page: clampPerPage(data.perPage),
					sort: data.sort ?? "updated",
					direction: data.direction ?? "desc",
				}),
			mapData: (pulls) =>
				pulls.map((pull) =>
					mapPullSummary(pull, buildRepositoryRef(data.owner, data.repo)),
				),
		});
		if (!data.withStats || pulls.length === 0) return pulls;
		return withPullListStats(context, data, pulls);
	});

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

export const getPullFromRepo = createServerFn({ method: "GET" })
	.validator(identityValidator<PullFromRepoInput>)
	.handler(async ({ data }): Promise<PullDetail | null> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return null;
		}

		return getPullDetailResult(context, data);
	});

export const getPullComments = createServerFn({ method: "GET" })
	.validator(identityValidator<PullFromRepoInput>)
	.handler(async ({ data }): Promise<PullComment[]> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return [];
		}

		return getPullCommentsResult(context, data);
	});

export const getPullStatus = createServerFn({ method: "GET" })
	.validator(identityValidator<PullFromRepoInput>)
	.handler(async ({ data }): Promise<PullStatus | null> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return null;
		}

		return getPullStatusResult(context, data);
	});

export const getPullPageData = createServerFn({ method: "GET" })
	.validator(identityValidator<PullFromRepoInput>)
	.handler(async ({ data }): Promise<PullPageData | null> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return null;
		}

		return getPullPageDataResult(context, data);
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
	.handler(async ({ data }): Promise<MutationResult> => {
		const context = await getGitHubUserContextForRepository(data);
		if (!context) {
			return { ok: false, error: "Not authenticated" };
		}

		try {
			await context.octokit.rest.pulls.update({
				owner: data.owner,
				repo: data.repo,
				pull_number: data.pullNumber,
				state: data.state,
			});
			return { ok: true };
		} catch (error) {
			return toMutationError(
				`${data.state === "closed" ? "close" : "reopen"} pull request`,
				error,
			);
		}
	});

export const updatePullBranch = createServerFn({ method: "POST" })
	.validator(identityValidator<PullFromRepoInput>)
	.handler(async ({ data }): Promise<MutationResult> => {
		const context = await getGitHubUserContextForRepository(data);
		if (!context) {
			return { ok: false, error: "Not authenticated" };
		}

		try {
			await context.octokit.rest.pulls.updateBranch({
				owner: data.owner,
				repo: data.repo,
				pull_number: data.pullNumber,
			});
			return { ok: true };
		} catch (error) {
			return toMutationError("update branch", error);
		}
	});

export type MergePullInput = PullFromRepoInput & {
	mergeMethod: "merge" | "squash" | "rebase";
	bypassProtections?: boolean;
	commitTitle?: string;
	commitMessage?: string;
};

export const mergePullRequest = createServerFn({ method: "POST" })
	.validator(identityValidator<MergePullInput>)
	.handler(async ({ data }): Promise<MutationResult> => {
		const context = await getGitHubUserContextForRepository(data);
		if (!context) {
			return { ok: false, error: "Not authenticated" };
		}

		try {
			await context.octokit.rest.pulls.merge({
				owner: data.owner,
				repo: data.repo,
				pull_number: data.pullNumber,
				merge_method: data.mergeMethod,
				...(data.commitTitle && { commit_title: data.commitTitle }),
				...(data.commitMessage && { commit_message: data.commitMessage }),
			});
			return { ok: true };
		} catch (error) {
			return toMutationError("merge pull request", error);
		}
	});

export type ReadyForReviewInput = PullFromRepoInput & {
	/** GraphQL node id of the pull request (e.g. `PR_kwD...`). */
	pullId: string;
};

export const markPullReadyForReview = createServerFn({ method: "POST" })
	.validator(identityValidator<ReadyForReviewInput>)
	.handler(async ({ data }): Promise<MutationResult> => {
		const context = await getGitHubUserContextForRepository(data);
		if (!context) {
			return { ok: false, error: "Not authenticated" };
		}

		try {
			await context.octokit.graphql(
				`mutation($pullRequestId: ID!) {
					markPullRequestReadyForReview(input: { pullRequestId: $pullRequestId }) {
						pullRequest { isDraft }
					}
				}`,
				{ pullRequestId: data.pullId },
			);
			return { ok: true };
		} catch (error) {
			return toMutationError("mark pull request as ready for review", error);
		}
	});

export const deleteBranch = createServerFn({ method: "POST" })
	.validator(
		identityValidator<{
			owner: string;
			repo: string;
			branch: string;
			pullNumber: number;
		}>,
	)
	.handler(async ({ data }): Promise<MutationResult> => {
		const context = await getGitHubUserContextForRepository(data);
		if (!context) {
			return { ok: false, error: "Not authenticated" };
		}

		try {
			await context.octokit.rest.git.deleteRef({
				owner: data.owner,
				repo: data.repo,
				ref: `heads/${data.branch}`,
			});
			return { ok: true };
		} catch (error) {
			return toMutationError("delete branch", error);
		}
	});

export type RerunChecksInput = PullFromRepoInput & {
	failedOnly: boolean;
};

export type RerunChecksResult =
	| {
			ok: true;
			rerun: number;
			/** Checks GitHub refused to rerun because they aren't eligible. */
			skipped: number;
			failed: number;
	  }
	| MutationFailure;

export const rerunChecks = createServerFn({ method: "POST" })
	.validator(identityValidator<RerunChecksInput>)
	.handler(async ({ data }): Promise<RerunChecksResult> => {
		const context = await getGitHubUserContextForRepository(data);
		if (!context) {
			return { ok: false, error: "Not authenticated" };
		}

		try {
			const pr = await context.octokit.rest.pulls.get({
				owner: data.owner,
				repo: data.repo,
				pull_number: data.pullNumber,
			});

			type CheckRunItem = Awaited<
				ReturnType<GitHubClient["rest"]["checks"]["listForRef"]>
			>["data"]["check_runs"][number];
			const checkRuns = await listPaginatedGitHubItems<CheckRunItem>({
				label: `rerun checks ${data.owner}/${data.repo}#${data.pullNumber}`,
				request: (page) =>
					context.octokit.rest.checks.listForRef({
						owner: data.owner,
						repo: data.repo,
						ref: pr.data.head.sha,
						page,
						per_page: 100,
					}),
				getItems: (payload) =>
					((payload as { check_runs?: CheckRunItem[] }).check_runs ??
						[]) as CheckRunItem[],
			});

			const dedupedRuns = deduplicateCheckRuns(checkRuns);

			const runsToRerun = data.failedOnly
				? dedupedRuns.filter(isFailedCheckRun)
				: dedupedRuns;

			if (runsToRerun.length === 0) {
				return { ok: true, rerun: 0, skipped: 0, failed: 0 };
			}

			// Route each check run to the correct rerun endpoint:
			// - GitHub Actions jobs: use actions.reRunWorkflow / reRunWorkflowFailedJobs
			//   (checks.rerequestRun requires the check to belong to the calling GitHub App)
			// - Third-party apps (GitGuardian, CodeRabbit, etc.): can't be rerun by us —
			//   GitHub returns 403 because we're not the owning app. Mark as skipped.
			const actionsRunIdByCheck = new Map<number, number>();
			const actionsRunIds = new Set<number>();
			const otherCheckRunIds: number[] = [];

			for (const run of runsToRerun) {
				if (run.app?.slug === "github-actions") {
					// GHA check URLs can be `/actions/runs/{id}/job/{job_id}` most of
					// the time, but also plain `/actions/runs/{id}`, with a `?query`, or
					// occasionally shortened to `/runs/{id}` — accept all shapes.
					const match = run.html_url?.match(
						/\/(?:actions\/runs|runs)\/(\d+)(?:\/|$|\?)/,
					);
					if (match) {
						const workflowRunId = Number(match[1]);
						actionsRunIdByCheck.set(run.id, workflowRunId);
						actionsRunIds.add(workflowRunId);
						continue;
					}
				}
				otherCheckRunIds.push(run.id);
			}

			type Task = {
				coveredCheckRunIds: number[];
				promise: Promise<unknown>;
			};
			const tasks: Task[] = [];

			for (const workflowRunId of actionsRunIds) {
				const coveredCheckRunIds = runsToRerun
					.filter((r) => actionsRunIdByCheck.get(r.id) === workflowRunId)
					.map((r) => r.id);
				tasks.push({
					coveredCheckRunIds,
					promise: data.failedOnly
						? context.octokit.rest.actions.reRunWorkflowFailedJobs({
								owner: data.owner,
								repo: data.repo,
								run_id: workflowRunId,
							})
						: context.octokit.rest.actions.reRunWorkflow({
								owner: data.owner,
								repo: data.repo,
								run_id: workflowRunId,
							}),
				});
			}

			for (const checkRunId of otherCheckRunIds) {
				tasks.push({
					coveredCheckRunIds: [checkRunId],
					promise: context.octokit.rest.checks.rerequestRun({
						owner: data.owner,
						repo: data.repo,
						check_run_id: checkRunId,
					}),
				});
			}

			const results = await Promise.allSettled(tasks.map((t) => t.promise));

			let rerun = 0;
			let skipped = 0;
			const hardFailures: PromiseRejectedResult[] = [];
			for (let i = 0; i < results.length; i++) {
				const result = results[i];
				const covered = tasks[i].coveredCheckRunIds.length;
				if (result.status === "fulfilled") {
					rerun += covered;
					continue;
				}
				const reason = result.reason;
				const msg =
					reason instanceof RequestError
						? ((reason.response?.data as { message?: string } | undefined)
								?.message ?? reason.message)
						: "";
				if (
					reason instanceof RequestError &&
					reason.status === 403 &&
					is403ResourceError(msg)
				) {
					skipped += covered;
				} else {
					hardFailures.push(result);
				}
			}

			const failed = hardFailures.reduce((total, failure) => {
				const taskIdx = results.indexOf(failure);
				return (
					total + (taskIdx >= 0 ? tasks[taskIdx].coveredCheckRunIds.length : 0)
				);
			}, 0);

			if (rerun === 0 && hardFailures.length > 0) {
				return toMutationError("rerun checks", hardFailures[0].reason);
			}

			return { ok: true, rerun, skipped, failed };
		} catch (error) {
			return toMutationError("rerun checks", error);
		}
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
			return { ok: false, error: "Not authenticated" };
		}

		if (data.workflowRunIds.length === 0) {
			return { ok: true, approved: 0, failed: 0 };
		}

		try {
			const results = await Promise.allSettled(
				data.workflowRunIds.map((runId) =>
					context.octokit.rest.actions.approveWorkflowRun({
						owner: data.owner,
						repo: data.repo,
						run_id: runId,
					}),
				),
			);

			const rejected = results.filter(
				(r): r is PromiseRejectedResult => r.status === "rejected",
			);
			const approved = results.length - rejected.length;

			if (approved === 0 && rejected.length > 0) {
				return toMutationError("approve workflow runs", rejected[0].reason);
			}

			return { ok: true, approved, failed: rejected.length };
		} catch (error) {
			return toMutationError("approve workflow runs", error);
		}
	});

async function getPullFilesResult(
	context: GitHubContext,
	data: PullFilesPageInput,
): Promise<PullFilesPage> {
	const page = clampPage(data.page);
	const perPage = clampPerPage(data.perPage, 20);

	return fetchGitHubResource<RepoPullFile[], PullFilesPage>({
		context,
		resource: "pulls.filesPage",
		params: {
			owner: data.owner,
			repo: data.repo,
			pullNumber: data.pullNumber,
			page,
			perPage,
		},
		request: () =>
			context.octokit.rest.pulls.listFiles({
				owner: data.owner,
				repo: data.repo,
				pull_number: data.pullNumber,
				page,
				per_page: perPage,
			}),
		mapData: (files) => ({
			files: files.map((file) => ({
				sha: file.sha,
				filename: file.filename,
				status: file.status as PullFile["status"],
				additions: file.additions,
				deletions: file.deletions,
				changes: file.changes,
				patch: file.patch ?? null,
				previousFilename: file.previous_filename ?? null,
			})),
			nextPage: files.length === perPage ? page + 1 : null,
		}),
	});
}

type GraphQLPullFileSummariesResponse = {
	repository: {
		pullRequest: {
			files: {
				nodes: Array<{
					path: string;
					changeType:
						| "ADDED"
						| "CHANGED"
						| "COPIED"
						| "DELETED"
						| "MODIFIED"
						| "RENAMED";
					additions: number;
					deletions: number;
				}>;
				pageInfo: { hasNextPage: boolean; endCursor: string | null };
			};
		};
	};
};

function mapGraphQLChangeTypeToStatus(
	changeType: GraphQLPullFileSummariesResponse["repository"]["pullRequest"]["files"]["nodes"][number]["changeType"],
): PullFileSummary["status"] {
	switch (changeType) {
		case "ADDED":
			return "added";
		case "DELETED":
			return "removed";
		case "RENAMED":
			return "renamed";
		case "COPIED":
			return "copied";
		case "CHANGED":
			return "changed";
		default:
			return "modified";
	}
}

const PULL_FILE_SUMMARIES_GRAPHQL_QUERY = `query($owner: String!, $repo: String!, $number: Int!, $cursor: String) {
	repository(owner: $owner, name: $repo) {
		pullRequest(number: $number) {
			files(first: 100, after: $cursor) {
				nodes { path changeType additions deletions }
				pageInfo { hasNextPage endCursor }
			}
		}
	}
}`;

// GitHub caps GraphQL `first:` at 100 for pullRequest.files, but we can
// loop several pages server-side and return them as one client-visible
// batch. 5 × 100 = 500 summaries per client round-trip cuts a 3k-file PR
// from ~30 client round-trips down to ~6.
const PULL_FILE_SUMMARIES_PAGES_PER_BATCH = 5;

// One batch (up to ~500 files) per call so the client renders incrementally;
// loading all pages server-side blocks a 3k-file PR's sidebar for ~9s.
async function getPullFileSummariesResult(
	context: GitHubContext,
	data: PullFileSummariesPageInput,
): Promise<PullFileSummariesPage> {
	return dedupeGitHubRead<PullFileSummariesPage>({
		userId: context.session.user.id,
		resource: "pulls.fileSummaries.graphql.batch",
		params: {
			owner: data.owner,
			repo: data.repo,
			pullNumber: data.pullNumber,
			cursor: data.cursor ?? null,
		},
		fetcher: async () => {
			const items: PullFileSummary[] = [];
			let cursor: string | null = data.cursor ?? null;
			let hasNextPage = true;
			const deadlineAt = Date.now() + GITHUB_PAGINATED_OPERATION_TIMEOUT_MS;

			for (let i = 0; i < PULL_FILE_SUMMARIES_PAGES_PER_BATCH; i++) {
				if (!hasNextPage) break;

				const timeoutMs = getRemainingSearchTimeoutMs(
					deadlineAt,
					GITHUB_OPERATION_TIMEOUT_MS,
				);
				if (timeoutMs < GITHUB_MIN_OPERATION_TIMEOUT_MS) {
					throw new GitHubOperationTimeoutError(
						"github pulls.fileSummaries.graphql.batch",
						timeoutMs,
					);
				}

				const response = await withGitHubOperationTimeout(
					"github pulls.fileSummaries.graphql.batch",
					timeoutMs,
					(signal) =>
						context.octokit.graphql<GraphQLPullFileSummariesResponse>(
							PULL_FILE_SUMMARIES_GRAPHQL_QUERY,
							{
								owner: data.owner,
								repo: data.repo,
								number: data.pullNumber,
								cursor,
								request: { signal },
							},
						),
				);

				const page = response.repository.pullRequest.files;
				for (const node of page.nodes) {
					items.push({
						filename: node.path,
						status: mapGraphQLChangeTypeToStatus(node.changeType),
						additions: node.additions,
						deletions: node.deletions,
						changes: node.additions + node.deletions,
						// GraphQL's PullRequestFile doesn't expose the pre-rename path;
						// the sidebar tree doesn't use it, and the diff view still gets
						// previousFilename via the REST `getPullFiles` endpoint.
						previousFilename: null,
					});
				}

				hasNextPage = page.pageInfo.hasNextPage;
				cursor = page.pageInfo.endCursor ?? null;
			}

			return {
				items,
				nextCursor: hasNextPage ? cursor : null,
			};
		},
	});
}

export const getPullFileSummaries = createServerFn({ method: "GET" })
	.validator(identityValidator<PullFileSummariesPageInput>)
	.handler(async ({ data }): Promise<PullFileSummariesPage> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return { items: [], nextCursor: null };
		}

		return getPullFileSummariesResult(context, data);
	});

export const getPullFiles = createServerFn({ method: "GET" })
	.validator(identityValidator<PullFilesPageInput>)
	.handler(async ({ data }): Promise<PullFilesPage> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return { files: [], nextPage: null };
		}

		return getPullFilesResult(context, data);
	});

export type CreatePullRequestInput = {
	owner: string;
	repo: string;
	title: string;
	body?: string;
	base: string;
	head: string;
	draft?: boolean;
	labels?: string[];
	assignees?: string[];
	reviewers?: string[];
	teamReviewers?: string[];
	milestone?: number;
};

export type CreatePullRequestResult =
	| { ok: true; pullNumber: number; warnings?: string[] }
	| { ok: false; error: string; installUrl?: string };

export const createPullRequest = createServerFn({ method: "POST" })
	.validator(identityValidator<CreatePullRequestInput>)
	.handler(async ({ data }): Promise<CreatePullRequestResult> => {
		const context = await getGitHubUserContextForRepository(data);
		if (!context) {
			return { ok: false, error: "Not authenticated" };
		}

		try {
			const response = await context.octokit.rest.pulls.create({
				owner: data.owner,
				repo: data.repo,
				title: data.title,
				body: data.body,
				base: data.base,
				head: data.head,
				draft: data.draft ?? false,
			});

			const pullNumber = response.data.number;

			const followUps: Array<{ name: string; promise: Promise<unknown> }> = [];
			if (data.labels && data.labels.length > 0) {
				followUps.push({
					name: "addLabels",
					promise: context.octokit.rest.issues.addLabels({
						owner: data.owner,
						repo: data.repo,
						issue_number: pullNumber,
						labels: data.labels,
					}),
				});
			}
			if (data.assignees && data.assignees.length > 0) {
				followUps.push({
					name: "addAssignees",
					promise: context.octokit.rest.issues.addAssignees({
						owner: data.owner,
						repo: data.repo,
						issue_number: pullNumber,
						assignees: data.assignees,
					}),
				});
			}
			if (data.milestone !== undefined) {
				followUps.push({
					name: "setMilestone",
					promise: context.octokit.rest.issues.update({
						owner: data.owner,
						repo: data.repo,
						issue_number: pullNumber,
						milestone: data.milestone,
					}),
				});
			}
			if (
				(data.reviewers && data.reviewers.length > 0) ||
				(data.teamReviewers && data.teamReviewers.length > 0)
			) {
				followUps.push({
					name: "requestReviewers",
					promise: context.octokit.rest.pulls.requestReviewers({
						owner: data.owner,
						repo: data.repo,
						pull_number: pullNumber,
						reviewers: data.reviewers ?? [],
						team_reviewers: data.teamReviewers ?? [],
					}),
				});
			}
			const warnings: string[] = [];
			if (followUps.length > 0) {
				const results = await Promise.allSettled(
					followUps.map((f) => f.promise),
				);
				for (let i = 0; i < results.length; i++) {
					const r = results[i];
					if (r.status === "rejected") {
						const reason = r.reason;
						const msg =
							reason instanceof Error ? reason.message : String(reason);
						const name = followUps[i].name;
						console.error(`[create pull request] ${name} failed`, reason);
						warnings.push(`${name}: ${msg}`);
					}
				}
			}

			return {
				ok: true,
				pullNumber,
				...(warnings.length > 0 ? { warnings } : {}),
			};
		} catch (error) {
			const result = toMutationError("create pull request", error);
			if (result.ok) {
				return { ok: false, error: "" };
			}
			return {
				ok: false,
				error: result.error,
				...(result.installUrl ? { installUrl: result.installUrl } : {}),
			};
		}
	});
