import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import {
	type CommentChange,
	type CommentTarget,
	commentQueryFilters,
	patchComment,
} from "#/lib/comment-cache";
import {
	deleteComment,
	deleteReviewComment,
	editComment,
	editReviewComment,
	type MutationResult,
} from "#/lib/github.functions";
import {
	invalidateGitHubEntities,
	pullOrIssueEntityKeys,
} from "#/lib/github-query-updates";
import { useGitHubQueryScope } from "#/lib/use-github-query-scope";

function failureOf(error: unknown): MutationResult {
	return {
		ok: false,
		error: error instanceof Error ? error.message : "Request failed",
	};
}

/**
 * Edits and deletes a posted comment optimistically in every cached view of
 * it, restores those views if GitHub rejects the write, and otherwise hands
 * reconciliation to the shared entity invalidation.
 */
export function useCommentActions(target: CommentTarget) {
	const queryClient = useQueryClient();
	const scope = useGitHubQueryScope();
	const { kind, owner, repo, number, commentId } = target;

	const apply = useCallback(
		async (change: CommentChange, write: () => Promise<MutationResult>) => {
			const filters = commentQueryFilters(scope, {
				kind,
				owner,
				repo,
				number,
				commentId,
			});
			await queryClient.cancelQueries(filters);
			const snapshots = queryClient.getQueriesData(filters);
			queryClient.setQueriesData(filters, (data: unknown) =>
				data === undefined ? data : patchComment(data, commentId, change),
			);

			const result = await write().catch(failureOf);
			if (!result.ok) {
				for (const [queryKey, data] of snapshots) {
					queryClient.setQueryData(queryKey, data);
				}
				return result;
			}
			void invalidateGitHubEntities(
				queryClient,
				scope,
				pullOrIssueEntityKeys({ owner, repo, number }),
			);
			return result;
		},
		[queryClient, scope, kind, owner, repo, number, commentId],
	);

	return useMemo(
		() => ({
			edit: (body: string) =>
				apply({ type: "edit", body, editedAt: new Date().toISOString() }, () =>
					(kind === "review" ? editReviewComment : editComment)({
						data: { owner, repo, commentId, body },
					}),
				),
			remove: () =>
				apply({ type: "delete" }, () =>
					(kind === "review" ? deleteReviewComment : deleteComment)({
						data: { owner, repo, commentId },
					}),
				),
		}),
		[apply, kind, owner, repo, commentId],
	);
}
