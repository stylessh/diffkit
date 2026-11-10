import { GitPullRequestIcon } from "@diffkit/icons";
import { Button } from "@diffkit/ui/components/button";
import { toast } from "@diffkit/ui/components/sonner";
import { Spinner } from "@diffkit/ui/components/spinner";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { markPullReadyForReview } from "#/lib/github.functions";
import {
	invalidateGitHubEntities,
	pullEntityKey,
} from "#/lib/github-query-updates";
import { reportMutationFailure } from "./mutation-failure";

export function ReadyForReviewFooter({
	owner,
	repo,
	pullNumber,
	pullId,
}: {
	owner: string;
	repo: string;
	pullNumber: number;
	pullId: string | undefined;
}) {
	const [isMarking, setIsMarking] = useState(false);
	const queryClient = useQueryClient();

	// Stays busy after a success: the refreshed pull request replaces this footer.
	const handleMarkReady = async () => {
		if (!pullId) {
			toast.error("Missing pull request id");
			return;
		}
		setIsMarking(true);
		try {
			const result = await markPullReadyForReview({
				data: { owner, repo, pullNumber, pullId },
			});
			if (result.ok) {
				await invalidateGitHubEntities(queryClient, null, [
					pullEntityKey({ owner, repo, pullNumber }),
				]);
			} else {
				reportMutationFailure(result, { owner, repo });
				setIsMarking(false);
			}
		} catch {
			toast.error("Failed to mark as ready for review");
			setIsMarking(false);
		}
	};

	return (
		<div className="flex items-center gap-3 px-4 py-3">
			<Button
				size="sm"
				disabled={isMarking || !pullId}
				onClick={() => {
					void handleMarkReady();
				}}
				iconLeft={
					isMarking ? (
						<Spinner size={14} />
					) : (
						<GitPullRequestIcon size={14} strokeWidth={2} />
					)
				}
			>
				Ready for review
			</Button>
			<p className="text-xs text-muted-foreground">
				This pull request is a draft. Mark it as ready for review to allow
				merging.
			</p>
		</div>
	);
}
