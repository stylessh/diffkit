import { toast } from "@diffkit/ui/components/sonner";
import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import {
	deletePendingReview,
	submitPendingReview,
} from "#/lib/github.functions";
import { type GitHubQueryScope, githubQueryKeys } from "#/lib/github.query";
import type {
	ReviewDraftPull,
	ReviewDraftSubmitEvent,
	ReviewDraftsResult,
} from "#/lib/github.types";
import {
	invalidateGitHubEntities,
	pullEntityKey,
} from "#/lib/github-query-updates";
import { checkPermissionWarning } from "#/lib/warning-store";

export type ReviewDraftBusyState = "submit" | "delete";

/** Drop a draft from the cached list so the UI updates before any refetch. */
export function removeReviewDraftFromCache(
	queryClient: QueryClient,
	scope: GitHubQueryScope,
	reviewId: number,
) {
	queryClient.setQueryData<ReviewDraftsResult>(
		githubQueryKeys.reviewDrafts.mine(scope),
		(current) =>
			current
				? {
						...current,
						drafts: current.drafts.filter(
							(draft) => draft.review.reviewId !== reviewId,
						),
					}
				: current,
	);
}

export function useReviewDraftActions(scope: GitHubQueryScope) {
	const queryClient = useQueryClient();
	const [busy, setBusy] = useState<ReadonlyMap<number, ReviewDraftBusyState>>(
		() => new Map(),
	);

	const run = useCallback(
		async (
			draft: ReviewDraftPull,
			state: ReviewDraftBusyState,
			action: () => Promise<{
				ok: boolean;
				error?: string;
				installUrl?: string;
			}>,
			messages: { success: string; failure: string },
		) => {
			const reviewId = draft.review.reviewId;
			setBusy((current) => new Map(current).set(reviewId, state));
			try {
				const result = await action();
				if (!result.ok) {
					checkPermissionWarning(result, draft.repositoryFullName);
					toast.error(messages.failure, { description: result.error });
					return false;
				}
				removeReviewDraftFromCache(queryClient, scope, reviewId);
				void invalidateGitHubEntities(queryClient, scope, [
					pullEntityKey({
						owner: draft.owner,
						repo: draft.repo,
						pullNumber: draft.number,
					}),
				]);
				toast.success(messages.success);
				return true;
			} catch (error) {
				console.error(`[review-drafts] ${state}`, error);
				toast.error(messages.failure, {
					description: error instanceof Error ? error.message : undefined,
				});
				return false;
			} finally {
				setBusy((current) => {
					const next = new Map(current);
					next.delete(reviewId);
					return next;
				});
			}
		},
		[queryClient, scope],
	);

	const submit = useCallback(
		(draft: ReviewDraftPull, event: ReviewDraftSubmitEvent, body: string) =>
			run(
				draft,
				"submit",
				() =>
					submitPendingReview({
						data: {
							owner: draft.owner,
							repo: draft.repo,
							pullNumber: draft.number,
							reviewId: draft.review.reviewId,
							event,
							body,
						},
					}),
				{
					success: `Submitted review on ${draft.repositoryFullName} #${draft.number}`,
					failure: "Failed to submit review",
				},
			),
		[run],
	);

	const discard = useCallback(
		(draft: ReviewDraftPull) =>
			run(
				draft,
				"delete",
				() =>
					deletePendingReview({
						data: {
							owner: draft.owner,
							repo: draft.repo,
							pullNumber: draft.number,
							reviewId: draft.review.reviewId,
						},
					}),
				{
					success: `Deleted draft review on ${draft.repositoryFullName} #${draft.number}`,
					failure: "Failed to delete draft review",
				},
			),
		[run],
	);

	return { busy, submit, discard };
}
