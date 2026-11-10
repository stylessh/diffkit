import { toast } from "@diffkit/ui/components/sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { submitPullReview } from "#/lib/github.functions";
import type { GitHubQueryScope } from "#/lib/github.query";
import {
	invalidateGitHubEntities,
	pullEntityKey,
} from "#/lib/github-query-updates";
import { checkPermissionWarning } from "#/lib/warning-store";
import {
	isMultiLineComment,
	type PendingComment,
	type ReviewEvent,
} from "./review-types";

const isAccessRestriction = (message: string) =>
	message.includes("OAuth App access restrictions") ||
	message.includes("Insufficient permissions");

const toReviewComment = (comment: PendingComment) => ({
	path: comment.path,
	line: comment.line,
	side: comment.side,
	body: comment.body,
	...(isMultiLineComment(comment)
		? {
				startLine: comment.startLine,
				startSide: comment.startSide ?? comment.side,
			}
		: {}),
});

/** Sends the pending comments as one review, then returns to the pull request. */
export function useSubmitReview({
	scope,
	owner,
	repo,
	pullNumber,
	pending,
	onSubmitted,
}: {
	scope: GitHubQueryScope;
	owner: string;
	repo: string;
	pullNumber: number;
	pending: readonly PendingComment[];
	onSubmitted: () => void;
}) {
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	const mutation = useMutation({
		mutationFn: ({ body, event }: { body: string; event: ReviewEvent }) =>
			submitPullReview({
				data: {
					owner,
					repo,
					pullNumber,
					body,
					event,
					comments: pending.map(toReviewComment),
				},
			}),
		onSuccess(accepted) {
			if (!accepted) {
				toast.error("Failed to submit review");
				return;
			}
			onSubmitted();
			void invalidateGitHubEntities(queryClient, scope, [
				pullEntityKey({ owner, repo, pullNumber }),
			]);
			void navigate({
				to: "/$owner/$repo/pull/$pullId",
				params: { owner, repo, pullId: String(pullNumber) },
			});
		},
		onError(error) {
			console.error("[submitReview]", error);
			const message = error instanceof Error ? error.message : "Unknown error";
			checkPermissionWarning({ ok: false, error: message }, `${owner}/${repo}`);
			if (!isAccessRestriction(message)) {
				toast.error("Failed to submit review", { description: message });
			}
		},
	});

	const { mutateAsync } = mutation;
	const submit = (body: string, event: ReviewEvent) =>
		mutateAsync({ body, event }).catch(() => false);

	return { submit, isSubmitting: mutation.isPending };
}
