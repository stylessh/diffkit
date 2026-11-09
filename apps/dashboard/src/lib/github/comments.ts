import { createServerFn } from "@tanstack/react-start";
import type { CommentReactionContent } from "../github.types";
import { executeGitHubGraphQL } from "./client";
import {
	getGitHubContextForRepository,
	getGitHubUserContextForRepository,
} from "./installations";
import { type MutationResult, toMutationError } from "./shared";
import {
	type CommentPageInput,
	getCommentsPageResult,
	getRestTimelineEventsPage,
} from "./timeline";
import { identityValidator } from "./validators";

export const getCommentPage = createServerFn({ method: "GET" })
	.validator(identityValidator<CommentPageInput>)
	.handler(async ({ data }) => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return { comments: [], total: 0 };
		}

		return getCommentsPageResult(context, data);
	});

type TimelineEventPageInput = {
	owner: string;
	repo: string;
	issueNumber: number;
	page: number;
};

export const getTimelineEventPage = createServerFn({ method: "GET" })
	.validator(identityValidator<TimelineEventPageInput>)
	.handler(async ({ data }) => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return { events: [], hasMore: false };
		}

		return getRestTimelineEventsPage(context, data, data.page);
	});

export type CreateCommentInput = {
	owner: string;
	repo: string;
	issueNumber: number;
	body: string;
};

export const createComment = createServerFn({ method: "POST" })
	.validator(identityValidator<CreateCommentInput>)
	.handler(async ({ data }): Promise<MutationResult> => {
		const context = await getGitHubUserContextForRepository(data);
		if (!context) {
			return { ok: false, error: "Not authenticated" };
		}

		try {
			await context.octokit.rest.issues.createComment({
				owner: data.owner,
				repo: data.repo,
				issue_number: data.issueNumber,
				body: data.body,
			});

			return { ok: true };
		} catch (error) {
			return toMutationError("create comment", error);
		}
	});

export type ToggleIssueCommentReactionInput = {
	owner: string;
	repo: string;
	/** Issue or pull request number (conversation thread) */
	issueNumber: number;
	commentId: number;
	/** GitHub GraphQL node id — numeric REST id can be wrong when GraphQL `databaseId` was absent */
	commentGraphqlId: string;
	content: CommentReactionContent;
	/** True = remove; false = add (from UI before toggle) */
	remove: boolean;
};

function restReactionContentToGraphQL(content: CommentReactionContent): string {
	switch (content) {
		case "+1":
			return "THUMBS_UP";
		case "-1":
			return "THUMBS_DOWN";
		case "laugh":
			return "LAUGH";
		case "confused":
			return "CONFUSED";
		case "heart":
			return "HEART";
		case "hooray":
			return "HOORAY";
		case "rocket":
			return "ROCKET";
		case "eyes":
			return "EYES";
		default:
			return "THUMBS_UP";
	}
}

export const toggleIssueCommentReaction = createServerFn({ method: "POST" })
	.validator(identityValidator<ToggleIssueCommentReactionInput>)
	.handler(async ({ data }): Promise<MutationResult> => {
		const context = await getGitHubUserContextForRepository(data);
		if (!context) {
			return { ok: false, error: "Not authenticated" };
		}

		if (!data.commentGraphqlId) {
			return { ok: false, error: "Missing comment node id" };
		}

		try {
			const gqlContent = restReactionContentToGraphQL(data.content);
			const mutation = data.remove
				? `mutation($subjectId: ID!, $content: ReactionContent!) {
					removeReaction(input: { subjectId: $subjectId, content: $content }) {
						subject { id }
					}
				}`
				: `mutation($subjectId: ID!, $content: ReactionContent!) {
					addReaction(input: { subjectId: $subjectId, content: $content }) {
						subject { id }
					}
				}`;

			await executeGitHubGraphQL<{
				addReaction?: { subject: { id: string } | null } | null;
				removeReaction?: { subject: { id: string } | null } | null;
			}>(
				context,
				`github reaction ${data.remove ? "remove" : "add"}`,
				mutation,
				{
					subjectId: data.commentGraphqlId,
					content: gqlContent,
				},
			);

			return { ok: true };
		} catch (error) {
			return toMutationError("toggle comment reaction", error);
		}
	});

export type EditCommentInput = {
	owner: string;
	repo: string;
	commentId: number;
	body: string;
};

export const editComment = createServerFn({ method: "POST" })
	.validator(identityValidator<EditCommentInput>)
	.handler(async ({ data }): Promise<MutationResult> => {
		const context = await getGitHubUserContextForRepository(data);
		if (!context) {
			return { ok: false, error: "Not authenticated" };
		}

		try {
			await context.octokit.rest.issues.updateComment({
				owner: data.owner,
				repo: data.repo,
				comment_id: data.commentId,
				body: data.body,
			});
			return { ok: true };
		} catch (error) {
			return toMutationError("edit comment", error);
		}
	});

export type DeleteCommentInput = {
	owner: string;
	repo: string;
	commentId: number;
};

export const deleteComment = createServerFn({ method: "POST" })
	.validator(identityValidator<DeleteCommentInput>)
	.handler(async ({ data }): Promise<MutationResult> => {
		const context = await getGitHubUserContextForRepository(data);
		if (!context) {
			return { ok: false, error: "Not authenticated" };
		}

		try {
			await context.octokit.rest.issues.deleteComment({
				owner: data.owner,
				repo: data.repo,
				comment_id: data.commentId,
			});
			return { ok: true };
		} catch (error) {
			return toMutationError("delete comment", error);
		}
	});

export type EditReviewCommentInput = {
	owner: string;
	repo: string;
	commentId: number;
	body: string;
};

export const editReviewComment = createServerFn({ method: "POST" })
	.validator(identityValidator<EditReviewCommentInput>)
	.handler(async ({ data }): Promise<MutationResult> => {
		const context = await getGitHubUserContextForRepository(data);
		if (!context) {
			return { ok: false, error: "Not authenticated" };
		}

		try {
			await context.octokit.rest.pulls.updateReviewComment({
				owner: data.owner,
				repo: data.repo,
				comment_id: data.commentId,
				body: data.body,
			});
			return { ok: true };
		} catch (error) {
			return toMutationError("edit review comment", error);
		}
	});

export type DeleteReviewCommentInput = {
	owner: string;
	repo: string;
	commentId: number;
};

export const deleteReviewComment = createServerFn({ method: "POST" })
	.validator(identityValidator<DeleteReviewCommentInput>)
	.handler(async ({ data }): Promise<MutationResult> => {
		const context = await getGitHubUserContextForRepository(data);
		if (!context) {
			return { ok: false, error: "Not authenticated" };
		}

		try {
			await context.octokit.rest.pulls.deleteReviewComment({
				owner: data.owner,
				repo: data.repo,
				comment_id: data.commentId,
			});
			return { ok: true };
		} catch (error) {
			return toMutationError("delete review comment", error);
		}
	});

export type MinimizeCommentInput = {
	owner: string;
	repo: string;
	commentId: number;
	commentType: "issue" | "review";
};

export const minimizeComment = createServerFn({ method: "POST" })
	.validator(identityValidator<MinimizeCommentInput>)
	.handler(async ({ data }): Promise<MutationResult> => {
		const context = await getGitHubUserContextForRepository(data);
		if (!context) {
			return { ok: false, error: "Not authenticated" };
		}

		try {
			// GitHub's minimize API requires the GraphQL node_id.
			// Fetch the comment first to get the node_id, then minimize via GraphQL.
			let nodeId: string;
			if (data.commentType === "review") {
				const { data: comment } =
					await context.octokit.rest.pulls.getReviewComment({
						owner: data.owner,
						repo: data.repo,
						comment_id: data.commentId,
					});
				nodeId = comment.node_id;
			} else {
				const { data: comment } = await context.octokit.rest.issues.getComment({
					owner: data.owner,
					repo: data.repo,
					comment_id: data.commentId,
				});
				nodeId = comment.node_id;
			}

			await context.octokit.graphql(
				`mutation($id: ID!, $classifier: ReportedContentClassifiers!) {
					minimizeComment(input: { subjectId: $id, classifier: $classifier }) {
						minimizedComment { isMinimized }
					}
				}`,
				{ id: nodeId, classifier: "OFF_TOPIC" },
			);

			return { ok: true };
		} catch (error) {
			return toMutationError("minimize comment", error);
		}
	});
