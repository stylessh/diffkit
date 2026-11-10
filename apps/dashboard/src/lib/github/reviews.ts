import { createServerFn } from "@tanstack/react-start";
import type {
	CreateReviewCommentInput,
	PullReviewComment,
	ReplyToReviewCommentInput,
	ReviewThreadInfo,
	SubmitReviewInput,
} from "../github.types";
import { fetchPaginatedGitHubResource } from "./client";
import {
	getGitHubContextForRepository,
	getGitHubUserContextForRepository,
} from "./installations";
import { restEditedAt } from "./mappers";
import { mutateRepository } from "./mutations";
import type {
	GitHubClient,
	GitHubContext,
	MutationResult,
	PullFromRepoInput,
} from "./shared";
import { identityValidator } from "./validators";

type RepoPullReviewComment = Awaited<
	ReturnType<GitHubClient["rest"]["pulls"]["listReviewComments"]>
>["data"][number];

async function getPullReviewCommentsResult(
	context: GitHubContext,
	data: PullFromRepoInput,
): Promise<PullReviewComment[]> {
	return fetchPaginatedGitHubResource<
		RepoPullReviewComment,
		PullReviewComment[]
	>({
		context,
		resource: "pulls.reviewComments",
		params: data,
		request: (page) =>
			context.octokit.rest.pulls.listReviewComments({
				owner: data.owner,
				repo: data.repo,
				pull_number: data.pullNumber,
				page,
				per_page: 100,
			}),
		mapData: (comments) =>
			comments.map((comment) => ({
				id: comment.id,
				nodeId: comment.node_id,
				pullRequestReviewId: comment.pull_request_review_id ?? null,
				body: comment.body,
				path: comment.path,
				line: comment.line ?? null,
				startLine: comment.start_line ?? null,
				side: (comment.side?.toUpperCase() as "LEFT" | "RIGHT") ?? "RIGHT",
				createdAt: comment.created_at,
				updatedAt: comment.updated_at,
				editedAt: restEditedAt(comment),
				author: comment.user
					? {
							login: comment.user.login,
							avatarUrl: comment.user.avatar_url,
							url: comment.user.html_url,
							type: comment.user.type ?? "User",
						}
					: null,
				inReplyToId: comment.in_reply_to_id ?? null,
				diffHunk: comment.diff_hunk,
			})),
	});
}

export const getPullReviewComments = createServerFn({ method: "GET" })
	.validator(identityValidator<PullFromRepoInput>)
	.handler(async ({ data }): Promise<PullReviewComment[]> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return [];
		}

		return getPullReviewCommentsResult(context, data);
	});

type GraphQLReviewThread = {
	id: string;
	isResolved: boolean;
	comments: {
		nodes: Array<{ databaseId: number }>;
	};
};

type GraphQLReviewThreadsResponse = {
	repository: {
		pullRequest: {
			reviewThreads: {
				nodes: GraphQLReviewThread[];
				pageInfo: { hasNextPage: boolean; endCursor: string | null };
			};
		};
	};
};

export const getReviewThreadStatuses = createServerFn({ method: "GET" })
	.validator(identityValidator<PullFromRepoInput>)
	.handler(async ({ data }): Promise<ReviewThreadInfo[]> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) return [];

		try {
			const threads: ReviewThreadInfo[] = [];
			let cursor: string | null = null;
			let hasNext = true;

			while (hasNext) {
				const response: GraphQLReviewThreadsResponse =
					await context.octokit.graphql<GraphQLReviewThreadsResponse>(
						`query($owner: String!, $repo: String!, $number: Int!, $cursor: String) {
							repository(owner: $owner, name: $repo) {
								pullRequest(number: $number) {
									reviewThreads(first: 100, after: $cursor) {
										nodes {
											id
											isResolved
											comments(first: 1) {
												nodes { databaseId }
											}
										}
										pageInfo { hasNextPage endCursor }
									}
								}
							}
						}`,
						{
							owner: data.owner,
							repo: data.repo,
							number: data.pullNumber,
							cursor,
						},
					);

				const page = response.repository.pullRequest.reviewThreads;
				for (const thread of page.nodes) {
					const firstCommentId = thread.comments.nodes[0]?.databaseId;
					if (firstCommentId != null) {
						threads.push({
							threadId: thread.id,
							isResolved: thread.isResolved,
							firstCommentId,
						});
					}
				}

				hasNext = page.pageInfo.hasNextPage;
				cursor = page.pageInfo.endCursor;
			}

			return threads;
		} catch {
			return [];
		}
	});

export type ResolveThreadInput = {
	owner: string;
	repo: string;
	threadId: string;
};

export const resolveReviewThread = createServerFn({ method: "POST" })
	.validator(identityValidator<ResolveThreadInput>)
	.handler(
		({ data }): Promise<MutationResult> =>
			mutateRepository(data, "resolve thread", (context) =>
				context.octokit.graphql(
					`mutation($threadId: ID!) {
					resolveReviewThread(input: { threadId: $threadId }) {
						thread { isResolved }
					}
				}`,
					{ threadId: data.threadId },
				),
			),
	);

export const unresolveReviewThread = createServerFn({ method: "POST" })
	.validator(identityValidator<ResolveThreadInput>)
	.handler(
		({ data }): Promise<MutationResult> =>
			mutateRepository(data, "unresolve thread", (context) =>
				context.octokit.graphql(
					`mutation($threadId: ID!) {
					unresolveReviewThread(input: { threadId: $threadId }) {
						thread { isResolved }
					}
				}`,
					{ threadId: data.threadId },
				),
			),
	);

export const submitPullReview = createServerFn({ method: "POST" })
	.validator(identityValidator<SubmitReviewInput>)
	.handler(async ({ data }): Promise<boolean> => {
		const context = await getGitHubUserContextForRepository(data);
		if (!context) {
			return false;
		}

		try {
			await context.octokit.rest.pulls.createReview({
				owner: data.owner,
				repo: data.repo,
				pull_number: data.pullNumber,
				body: data.body,
				event: data.event,
				comments: data.comments?.map((c) => ({
					path: c.path,
					line: c.line,
					side: c.side,
					body: c.body,
					...(c.startLine != null && c.startLine !== c.line
						? { start_line: c.startLine, start_side: c.startSide ?? c.side }
						: {}),
				})),
			});
			return true;
		} catch (error) {
			console.error("[submitPullReview] Failed:", error);
			const message = error instanceof Error ? error.message : "Unknown error";
			throw new Error(message);
		}
	});

export const createReviewComment = createServerFn({ method: "POST" })
	.validator(identityValidator<CreateReviewCommentInput>)
	.handler(async ({ data }): Promise<PullReviewComment | null> => {
		const context = await getGitHubUserContextForRepository(data);
		if (!context) {
			return null;
		}

		try {
			const response = await context.octokit.rest.pulls.createReviewComment({
				owner: data.owner,
				repo: data.repo,
				pull_number: data.pullNumber,
				body: data.body,
				commit_id: data.commitId,
				path: data.path,
				line: data.line,
				side: data.side,
			});

			const comment = response.data;

			return {
				id: comment.id,
				nodeId: comment.node_id,
				pullRequestReviewId: comment.pull_request_review_id ?? null,
				body: comment.body,
				path: comment.path,
				line: comment.line ?? null,
				startLine: comment.start_line ?? null,
				side: (comment.side?.toUpperCase() as "LEFT" | "RIGHT") ?? "RIGHT",
				createdAt: comment.created_at,
				updatedAt: comment.updated_at,
				editedAt: restEditedAt(comment),
				author: comment.user
					? {
							login: comment.user.login,
							avatarUrl: comment.user.avatar_url,
							url: comment.user.html_url,
							type: comment.user.type ?? "User",
						}
					: null,
				inReplyToId: comment.in_reply_to_id ?? null,
				diffHunk: comment.diff_hunk,
			};
		} catch {
			return null;
		}
	});

export const replyToReviewComment = createServerFn({ method: "POST" })
	.validator(identityValidator<ReplyToReviewCommentInput>)
	.handler(async ({ data }): Promise<PullReviewComment | null> => {
		const context = await getGitHubUserContextForRepository(data);
		if (!context) {
			return null;
		}

		try {
			const response =
				await context.octokit.rest.pulls.createReplyForReviewComment({
					owner: data.owner,
					repo: data.repo,
					pull_number: data.pullNumber,
					comment_id: data.commentId,
					body: data.body,
				});

			const comment = response.data;

			return {
				id: comment.id,
				nodeId: comment.node_id,
				pullRequestReviewId: comment.pull_request_review_id ?? null,
				body: comment.body,
				path: comment.path,
				line: comment.line ?? null,
				startLine: comment.start_line ?? null,
				side: (comment.side?.toUpperCase() as "LEFT" | "RIGHT") ?? "RIGHT",
				createdAt: comment.created_at,
				updatedAt: comment.updated_at,
				editedAt: restEditedAt(comment),
				author: comment.user
					? {
							login: comment.user.login,
							avatarUrl: comment.user.avatar_url,
							url: comment.user.html_url,
							type: comment.user.type ?? "User",
						}
					: null,
				inReplyToId: comment.in_reply_to_id ?? null,
				diffHunk: comment.diff_hunk,
			};
		} catch {
			return null;
		}
	});

export type DismissReviewInput = {
	owner: string;
	repo: string;
	pullNumber: number;
	reviewId: number;
	message: string;
};

export const dismissPullReview = createServerFn({ method: "POST" })
	.validator(identityValidator<DismissReviewInput>)
	.handler(
		({ data }): Promise<MutationResult> =>
			mutateRepository(data, "dismiss review", (context) =>
				context.octokit.rest.pulls.dismissReview({
					owner: data.owner,
					repo: data.repo,
					pull_number: data.pullNumber,
					review_id: data.reviewId,
					message: data.message,
				}),
			),
	);
