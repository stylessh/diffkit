import { createServerFn } from "@tanstack/react-start";
import type {
	GitHubActor,
	IssueComment,
	IssueDetail,
	IssuePageData,
	IssueSummary,
	RepositoryRef,
} from "../github.types";
import { executeGitHubGraphQL, fetchGitHubResource, getViewer } from "./client";
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
	mapIssueSummary,
	restEditedAt,
} from "./mappers";
import { dedupeGitHubRead } from "./request-dedup";
import {
	clampPage,
	clampPerPage,
	type GitHubClient,
	type GitHubContext,
	type GitHubGraphQLActor,
	type GitHubGraphQLCommentConnection,
	type GitHubGraphQLLabel,
	type GitHubGraphQLRateLimit,
	type GitHubGraphQLRepositoryRef,
	type MutationResult,
	type RepoState,
	toMutationError,
} from "./shared";
import {
	COMMENTS_PER_PAGE,
	getCommentsPageResult,
	getLoadedCommentPages,
	getTimelineEventsResult,
} from "./timeline";
import { identityValidator } from "./validators";

type GitHubGraphQLIssuePageResponse = {
	repository: {
		issue: {
			id: string;
			databaseId: number | null;
			number: number;
			title: string;
			state: string;
			stateReason: string | null;
			createdAt: string;
			updatedAt: string;
			closedAt: string | null;
			url: string;
			body: string;
			reactions: {
				nodes: Array<{
					content: string;
					user: { login: string } | null;
				} | null> | null;
			} | null;
			comments: { totalCount: number };
			author: GitHubGraphQLActor;
			labels: {
				nodes: Array<GitHubGraphQLLabel | null> | null;
			} | null;
			repository: GitHubGraphQLRepositoryRef;
			assignees: {
				nodes: Array<GitHubGraphQLActor | null> | null;
			} | null;
			milestone: {
				title: string;
				description: string | null;
				dueOn: string | null;
			} | null;
			firstComments: GitHubGraphQLCommentConnection;
			lastComments: GitHubGraphQLCommentConnection;
		} | null;
	};
	rateLimit: GitHubGraphQLRateLimit;
};
type RepoIssueDetail = Awaited<
	ReturnType<GitHubClient["rest"]["issues"]["get"]>
>["data"];
type IssueSort = "comments" | "created" | "updated";

export type IssuesFromRepoInput = {
	owner: string;
	repo: string;
	state?: RepoState;
	page?: number;
	perPage?: number;
	sort?: IssueSort;
	direction?: "asc" | "desc";
};

export type IssueFromRepoInput = {
	owner: string;
	repo: string;
	issueNumber: number;
};

function mapIssueDetail(
	issue: RepoIssueDetail,
	repository: RepositoryRef,
): IssueDetail {
	return {
		...mapIssueSummary(issue, repository),
		graphqlId:
			"node_id" in issue && typeof issue.node_id === "string"
				? issue.node_id
				: undefined,
		body: issue.body ?? "",
		assignees: (issue.assignees ?? [])
			.map((assignee) => mapActor(assignee))
			.filter((assignee): assignee is GitHubActor => Boolean(assignee)),
		milestone: issue.milestone
			? {
					title: issue.milestone.title,
					description: issue.milestone.description ?? null,
					dueOn: issue.milestone.due_on ?? null,
				}
			: null,
	};
}

function mapGraphQLIssueDetail(
	issue: NonNullable<GitHubGraphQLIssuePageResponse["repository"]["issue"]>,
	viewerLogin: string | undefined,
): IssueDetail {
	return {
		id: issue.databaseId ?? 0,
		graphqlId: issue.id,
		number: issue.number,
		title: issue.title,
		state: issue.state.toLowerCase(),
		stateReason: issue.stateReason?.toLowerCase() ?? null,
		createdAt: issue.createdAt,
		updatedAt: issue.updatedAt,
		closedAt: issue.closedAt,
		comments: issue.comments.totalCount,
		url: issue.url,
		author: mapGraphQLActor(issue.author),
		labels: mapGraphQLLabels(issue.labels),
		repository: mapGraphQLRepositoryRef(issue.repository),
		reactions: buildCommentReactionSummary(
			issue.reactions?.nodes ?? undefined,
			viewerLogin,
		),
		body: issue.body,
		assignees: (issue.assignees?.nodes ?? [])
			.map((assignee) => mapGraphQLActor(assignee))
			.filter((assignee): assignee is GitHubActor => Boolean(assignee)),
		milestone: issue.milestone
			? {
					title: issue.milestone.title,
					description: issue.milestone.description,
					dueOn: issue.milestone.dueOn,
				}
			: null,
	};
}

async function getIssueDetailResult(
	context: GitHubContext,
	data: IssueFromRepoInput,
): Promise<IssueDetail | null> {
	return fetchGitHubResource<RepoIssueDetail, IssueDetail | null>({
		context,
		resource: "issues.detail",
		params: data,
		request: () =>
			context.octokit.rest.issues.get({
				owner: data.owner,
				repo: data.repo,
				issue_number: data.issueNumber,
			}),
		mapData: (issue) => {
			if (issue.pull_request) {
				return null;
			}

			return mapIssueDetail(issue, buildRepositoryRef(data.owner, data.repo));
		},
	});
}

async function getIssueCommentsResult(
	context: GitHubContext,
	data: IssueFromRepoInput,
): Promise<IssueComment[]> {
	type RawIssueComment = Awaited<
		ReturnType<GitHubClient["rest"]["issues"]["listComments"]>
	>["data"][number];

	return fetchGitHubResource<RawIssueComment[], IssueComment[]>({
		context,
		resource: "issues.comments",
		params: data,
		request: () =>
			context.octokit.rest.issues.listComments({
				owner: data.owner,
				repo: data.repo,
				issue_number: data.issueNumber,
				per_page: 30,
			}),
		mapData: (comments) =>
			comments.map((comment) => ({
				id: comment.id,
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
			})),
	});
}

async function getIssuePageDataViaGraphQL(
	context: GitHubContext,
	data: IssueFromRepoInput,
): Promise<IssuePageData> {
	return dedupeGitHubRead<IssuePageData>({
		userId: context.session.user.id,
		resource: "issues.pageData.graphql.v2",
		params: data,
		fetcher: async () => {
			const viewerPromise = getGitHubUserContextForRepository({
				owner: data.owner,
				repo: data.repo,
			}).then((userCtx) => (userCtx ? getViewer(userCtx) : null));

			const [response, timelineResult, viewer] = await Promise.all([
				executeGitHubGraphQL<GitHubGraphQLIssuePageResponse>(
					context,
					`github issue page ${data.owner}/${data.repo}#${data.issueNumber}`,
					`query($owner: String!, $repo: String!, $number: Int!) {
						repository(owner: $owner, name: $repo) {
							issue(number: $number) {
								id
								databaseId
								number
								title
								state
								stateReason
								createdAt
								updatedAt
								closedAt
								url
								body
								reactions(first: 100) {
									nodes { content user { login } }
								}
								comments { totalCount }
								author { __typename login avatarUrl url }
								labels(first: 20) {
									nodes { name color description }
								}
								repository {
									name
									nameWithOwner
									url
									isPrivate
									owner { login }
								}
								assignees(first: 20) {
									nodes {
										__typename
										login
										avatarUrl
										url
									}
								}
								milestone {
									title
									description
									dueOn
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
						number: data.issueNumber,
					},
				),
				getTimelineEventsResult(context, {
					owner: data.owner,
					repo: data.repo,
					issueNumber: data.issueNumber,
				}),
				viewerPromise,
			]);

			const issue = response.repository.issue;
			if (!issue) {
				throw new Error(
					`Issue not found: ${data.owner}/${data.repo}#${data.issueNumber}`,
				);
			}

			const totalComments = issue.comments.totalCount;

			return {
				detail: mapGraphQLIssueDetail(issue, viewer?.login),
				comments: mapGraphQLComments(
					viewer?.login,
					issue.firstComments,
					issue.lastComments,
				),
				events: timelineResult.events,
				commentPagination: {
					totalCount: totalComments,
					perPage: COMMENTS_PER_PAGE,
					loadedPages: getLoadedCommentPages(totalComments),
				},
				eventPagination: {
					loadedPages: [1],
					hasMore: timelineResult.hasMore,
				},
			};
		},
	});
}

async function getIssuePageDataViaRest(
	context: GitHubContext,
	data: IssueFromRepoInput,
): Promise<IssuePageData> {
	const detail = await getIssueDetailResult(context, data);

	const totalComments = detail?.comments ?? 0;
	const totalPages = Math.max(1, Math.ceil(totalComments / COMMENTS_PER_PAGE));
	const issueData = {
		owner: data.owner,
		repo: data.repo,
		issueNumber: data.issueNumber,
	};

	const pagesToFetch = totalPages === 1 ? [1] : [1, totalPages];

	const [commentsPages, timelineResult] = await Promise.all([
		Promise.all(
			pagesToFetch.map((p) =>
				getCommentsPageResult(context, { ...issueData, page: p }),
			),
		),
		getTimelineEventsResult(context, issueData),
	]);

	const allComments = commentsPages.flatMap((p) => p.comments);

	return {
		detail,
		comments: allComments,
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
	};
}

async function getIssuePageDataResult(
	context: GitHubContext,
	data: IssueFromRepoInput,
): Promise<IssuePageData> {
	try {
		return await getIssuePageDataViaGraphQL(context, data);
	} catch (error) {
		console.error("[issue-page:gql] failed, falling back to REST", error);
		return getIssuePageDataViaRest(context, data);
	}
}

export const getIssuesFromRepo = createServerFn({ method: "GET" })
	.validator(identityValidator<IssuesFromRepoInput>)
	.handler(async ({ data }): Promise<IssueSummary[]> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return [];
		}

		return fetchGitHubResource<
			Awaited<
				ReturnType<GitHubClient["rest"]["issues"]["listForRepo"]>
			>["data"],
			IssueSummary[]
		>({
			context,
			resource: "issues.repo",
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
				context.octokit.rest.issues.listForRepo({
					owner: data.owner,
					repo: data.repo,
					state: data.state ?? "open",
					page: clampPage(data.page),
					per_page: clampPerPage(data.perPage),
					sort: data.sort ?? "updated",
					direction: data.direction ?? "desc",
				}),
			mapData: (issues) =>
				issues
					.filter((issue) => !issue.pull_request)
					.map((issue) =>
						mapIssueSummary(issue, buildRepositoryRef(data.owner, data.repo)),
					),
		});
	});

export const getIssueFromRepo = createServerFn({ method: "GET" })
	.validator(identityValidator<IssueFromRepoInput>)
	.handler(async ({ data }): Promise<IssueDetail | null> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return null;
		}

		return getIssueDetailResult(context, data);
	});

export const getIssueComments = createServerFn({ method: "GET" })
	.validator(identityValidator<IssueFromRepoInput>)
	.handler(async ({ data }): Promise<IssueComment[]> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return [];
		}

		return getIssueCommentsResult(context, data);
	});

export const getIssuePageData = createServerFn({ method: "GET" })
	.validator(identityValidator<IssueFromRepoInput>)
	.handler(async ({ data }): Promise<IssuePageData | null> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return null;
		}

		return getIssuePageDataResult(context, data);
	});

type UpdateIssueStateInput = {
	owner: string;
	repo: string;
	issueNumber: number;
	state: "open" | "closed";
	/** Required when `state` is `closed` (GitHub “close as”) */
	closeReason?: "completed" | "not_planned";
};

export const updateIssueState = createServerFn({ method: "POST" })
	.validator(identityValidator<UpdateIssueStateInput>)
	.handler(async ({ data }): Promise<MutationResult> => {
		const context = await getGitHubUserContextForRepository(data);
		if (!context) {
			return { ok: false, error: "Not authenticated" };
		}

		if (data.state === "closed" && !data.closeReason) {
			return { ok: false, error: "Close reason is required" };
		}

		try {
			await context.octokit.rest.issues.update({
				owner: data.owner,
				repo: data.repo,
				issue_number: data.issueNumber,
				state: data.state,
				state_reason:
					data.state === "closed" ? data.closeReason : ("reopened" as const),
			});

			return { ok: true };
		} catch (error) {
			return toMutationError("update issue", error);
		}
	});

export type CreateIssueInput = {
	owner: string;
	repo: string;
	title: string;
	body?: string;
	labels?: string[];
	assignees?: string[];
};

export type CreateIssueResult =
	| { ok: true; issueNumber: number }
	| { ok: false; error: string; installUrl?: string };

export const createIssue = createServerFn({ method: "POST" })
	.validator(identityValidator<CreateIssueInput>)
	.handler(async ({ data }): Promise<CreateIssueResult> => {
		const context = await getGitHubUserContextForRepository(data);
		if (!context) {
			return { ok: false, error: "Not authenticated" };
		}

		try {
			const response = await context.octokit.rest.issues.create({
				owner: data.owner,
				repo: data.repo,
				title: data.title,
				body: data.body,
				labels: data.labels,
				assignees: data.assignees,
			});

			return { ok: true, issueNumber: response.data.number };
		} catch (error) {
			const result = toMutationError("create issue", error);
			return { ok: false, error: result.ok ? "" : result.error };
		}
	});
