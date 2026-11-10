import { MoreHorizontalIcon } from "@diffkit/icons";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@diffkit/ui/components/dropdown-menu";
import { toast } from "@diffkit/ui/components/sonner";
import { cn } from "@diffkit/ui/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { CheckStateIcon } from "#/components/checks/check-state-icon";
import {
	dismissPullReview,
	requestPullReviewers,
} from "#/lib/github.functions";
import type { PullReview } from "#/lib/github.types";
import {
	invalidateGitHubEntities,
	pullEntityKey,
} from "#/lib/github-query-updates";
import { reportMutationFailure } from "./mutation-failure";
import { StatusDisclosure } from "./status-row";

type PullRef = { owner: string; repo: string; pullNumber: number };

function reviewSummary(approved: PullReview[], changesRequested: PullReview[]) {
	if (changesRequested.length > 0) {
		return {
			status: "error" as const,
			title: "Changes requested",
			description: `${changesRequested.map((r) => r.author?.login).join(", ")} requested changes`,
		};
	}
	if (approved.length > 0) {
		return {
			status: "success" as const,
			title: "Changes approved",
			description: `${approved.length} approving review${approved.length > 1 ? "s" : ""} by reviewers with write access.`,
		};
	}
	return {
		status: "pending" as const,
		title: "Review required",
		description: "Code owner review required by reviewers with write access.",
	};
}

export function ReviewsSection({
	reviews,
	...pull
}: PullRef & { reviews: PullReview[] }) {
	const approved = reviews.filter((r) => r.state === "APPROVED");
	const changesRequested = reviews.filter(
		(r) => r.state === "CHANGES_REQUESTED",
	);
	const decided = [...approved, ...changesRequested];

	return (
		<StatusDisclosure
			{...reviewSummary(approved, changesRequested)}
			defaultOpen={changesRequested.length > 0}
		>
			{decided.length === 0 ? (
				<div className="border-b-[0.5px] border-card-border px-4 py-3 pl-11">
					<p className="text-xs text-muted-foreground">No reviewers added</p>
				</div>
			) : (
				<div className="flex flex-col border-b-[0.5px] border-card-border py-1">
					{decided.map((review) => (
						<ReviewRow key={review.id} review={review} {...pull} />
					))}
				</div>
			)}
		</StatusDisclosure>
	);
}

function ReviewRow({ review, ...pull }: PullRef & { review: PullReview }) {
	const queryClient = useQueryClient();
	const isApproved = review.state === "APPROVED";
	const reviewerLogin = review.author?.login;

	const run = (
		mutation: Promise<
			{ ok: true } | { ok: false; error: string; installUrl?: string }
		>,
		failureMessage: string,
	) => {
		void mutation
			.then((result) => {
				if (result.ok) {
					void invalidateGitHubEntities(queryClient, null, [
						pullEntityKey(pull),
					]);
				} else {
					reportMutationFailure(result, pull);
				}
			})
			.catch(() => {
				toast.error(failureMessage);
			});
	};

	return (
		<div className="flex items-center gap-2 px-4 py-1.5 pl-11">
			<CheckStateIcon state={isApproved ? "success" : "failure"} />
			{review.author && (
				<img
					src={review.author.avatarUrl}
					alt={review.author.login}
					className="size-4 rounded-full ring-[0.5px] ring-chip-border"
				/>
			)}
			<span className="text-xs">{reviewerLogin ?? "Unknown"}</span>
			<span
				className={cn(
					"ml-auto text-xs",
					isApproved ? "text-success" : "text-danger",
				)}
			>
				{isApproved ? "Approved" : "Changes requested"}
			</span>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-ghost-hover hover:text-foreground"
					>
						<MoreHorizontalIcon size={14} strokeWidth={2} />
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem
						onClick={() =>
							run(
								dismissPullReview({
									data: {
										...pull,
										reviewId: review.id,
										message: "Dismissed via DiffKit",
									},
								}),
								"Failed to dismiss review",
							)
						}
					>
						Dismiss review
					</DropdownMenuItem>
					{reviewerLogin && (
						<DropdownMenuItem
							onClick={() =>
								run(
									requestPullReviewers({
										data: { ...pull, reviewers: [reviewerLogin] },
									}),
									"Failed to re-request review",
								)
							}
						>
							Re-request review
						</DropdownMenuItem>
					)}
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
