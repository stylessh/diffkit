import { ReviewsIcon } from "@diffkit/icons";
import { Button } from "@diffkit/ui/components/button";
import {
	Callout,
	CalloutAction,
	CalloutContent,
} from "@diffkit/ui/components/callout";
import { StatePill } from "@diffkit/ui/components/state-pill";
import { Link } from "@tanstack/react-router";
import { DetailPageTitle } from "#/components/details/detail-page";
import { CopyBadge } from "#/components/shared/copy-badge";
import type { PullDetail } from "#/lib/github.types";
import { getPrStateConfig } from "#/lib/pr-state";

export { getPrStateConfig, type PrStateConfig } from "#/lib/pr-state";

export function PullDetailTitle({
	owner,
	repo,
	pr,
}: {
	owner: string;
	repo: string;
	pr: PullDetail;
}) {
	const stateConfig = getPrStateConfig(pr);
	const StateIcon = stateConfig.icon;

	return (
		<DetailPageTitle
			collectionHref="/pulls"
			collectionLabel="Pull Requests"
			owner={owner}
			repo={repo}
			number={pr.number}
			icon={StateIcon}
			iconClassName={stateConfig.color}
			title={pr.title}
			subtitle={
				<div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs font-[450] text-muted-foreground">
					<StatePill tone={stateConfig.tone}>{stateConfig.label}</StatePill>
					{pr.author && (
						<>
							<img
								src={pr.author.avatarUrl}
								alt={pr.author.login}
								className="size-4 shrink-0 rounded-full ring-[0.5px] ring-chip-border"
							/>
							<span className="shrink-0 font-medium text-foreground">
								{pr.author.login}
							</span>
							{(pr.isMerged || pr.state !== "closed") && (
								<>
									<span className="shrink-0">
										{pr.isMerged ? "merged into" : "wants to merge into"}
									</span>
									<CopyBadge value={pr.baseRefName} />
									<span className="shrink-0">from</span>
									<CopyBadge
										value={
											pr.headRepoOwner && pr.headRepoOwner !== owner
												? `${pr.headRepoOwner}:${pr.headRefName}`
												: pr.headRefName
										}
										canTruncate
									/>
								</>
							)}
						</>
					)}
				</div>
			}
		/>
	);
}

/** Always rendered, so the page keeps its spacing whether or not a review is requested. */
export function PullReviewRequest({
	owner,
	repo,
	pullId,
	pr,
	viewerLogin,
}: {
	owner: string;
	repo: string;
	pullId: string;
	pr: PullDetail | null | undefined;
	viewerLogin?: string | null;
}) {
	const isReviewRequested =
		pr != null &&
		viewerLogin != null &&
		pr.requestedReviewers.some((reviewer) => reviewer.login === viewerLogin);

	return (
		<div className="flex flex-col gap-2">
			{isReviewRequested && (
				<Callout>
					<CalloutContent className="leading-5">
						<span className="flex size-4 items-center justify-center text-muted-foreground">
							<ReviewsIcon size={14} strokeWidth={2} />
						</span>
						Your review has been requested
					</CalloutContent>
					<CalloutAction>
						<Button asChild size="sm" variant="gold">
							<Link
								to="/$owner/$repo/review/$pullId"
								params={{ owner, repo, pullId }}
							>
								Review changes
							</Link>
						</Button>
					</CalloutAction>
				</Callout>
			)}
		</div>
	);
}
