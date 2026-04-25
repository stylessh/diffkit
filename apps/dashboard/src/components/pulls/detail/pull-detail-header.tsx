import { FileIcon, GitCommitIcon, ReviewsIcon } from "@diffkit/icons";
import {
	Callout,
	CalloutAction,
	CalloutContent,
} from "@diffkit/ui/components/callout";
import { StatePill } from "@diffkit/ui/components/state-pill";
import { cn } from "@diffkit/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { DetailPageTitle } from "#/components/details/detail-page";
import { CopyBadge } from "#/components/shared/copy-badge";
import type { PullDetail } from "#/lib/github.types";
import { getPrStateConfig } from "#/lib/pr-state";

export { getPrStateConfig, type PrStateConfig } from "#/lib/pr-state";

export function PullDetailHeader({
	owner,
	repo,
	pullId,
	pr,
	viewerLogin,
}: {
	owner: string;
	repo: string;
	pullId: string;
	pr: PullDetail;
	viewerLogin?: string | null;
}) {
	const stateConfig = getPrStateConfig(pr);
	const StateIcon = stateConfig.icon;
	const isReviewRequested =
		viewerLogin != null &&
		pr.requestedReviewers.some((reviewer) => reviewer.login === viewerLogin);

	return (
		<>
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
					<div className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
						<StatePill tone={stateConfig.tone}>{stateConfig.label}</StatePill>
						{pr.author && (
							<>
								<img
									src={pr.author.avatarUrl}
									alt={pr.author.login}
									className="size-4 shrink-0 rounded-full border border-border"
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

			<div className="flex flex-col gap-2">
				{isReviewRequested && (
					<Callout variant="warning">
						<CalloutContent>
							<ReviewsIcon size={15} strokeWidth={2} />
							Your review has been requested
						</CalloutContent>
						<CalloutAction>
							<Link
								to="/$owner/$repo/review/$pullId"
								params={{ owner, repo, pullId }}
								className="rounded-md bg-yellow-400 px-3 py-1 text-xs font-medium text-neutral-900 transition-colors hover:bg-yellow-400/90 dark:bg-yellow-500 dark:text-neutral-950 dark:hover:bg-yellow-500/90"
							>
								Review changes
							</Link>
						</CalloutAction>
					</Callout>
				)}

				<div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-surface-1 px-4 py-2.5 text-sm text-muted-foreground">
					<span className="flex items-center gap-1.5">
						<GitCommitIcon size={15} strokeWidth={2} />
						<span className="tabular-nums font-medium text-foreground">
							{pr.commits}
						</span>{" "}
						{pr.commits === 1 ? "commit" : "commits"}
					</span>
					<span className="text-muted-foreground/50">·</span>
					<span className="flex items-center gap-1.5">
						<FileIcon size={15} strokeWidth={2} />
						<span className="tabular-nums font-medium text-foreground">
							{pr.changedFiles}
						</span>{" "}
						{pr.changedFiles === 1 ? "file" : "files"} changed
					</span>
					<span className="flex items-center gap-1.5 text-xs">
						<span className="tabular-nums font-medium text-green-500">
							+{pr.additions}
						</span>
						<span className="tabular-nums font-medium text-red-500">
							-{pr.deletions}
						</span>
						<DiffBoxes additions={pr.additions} deletions={pr.deletions} />
					</span>
					{!isReviewRequested && (
						<Link
							to="/$owner/$repo/review/$pullId"
							params={{ owner, repo, pullId }}
							className="md:ml-auto rounded-lg bg-foreground px-3 py-1 text-xs font-medium text-background transition-opacity hover:opacity-90"
						>
							Review changes
						</Link>
					)}
				</div>
			</div>
		</>
	);
}

const DIFF_BOX_COUNT = 5;

function DiffBoxes({
	additions,
	deletions,
}: {
	additions: number;
	deletions: number;
}) {
	const total = additions + deletions;
	const greenCount =
		total === 0 ? 0 : Math.round((additions / total) * DIFF_BOX_COUNT);
	const redCount = total === 0 ? 0 : DIFF_BOX_COUNT - greenCount;

	const boxes: string[] = [];
	for (let i = 0; i < greenCount; i++) boxes.push("bg-green-500");
	for (let i = 0; i < redCount; i++) boxes.push("bg-red-500");
	while (boxes.length < DIFF_BOX_COUNT) boxes.push("bg-muted-foreground/30");

	return (
		<span className="flex items-center gap-px">
			{boxes.map((color, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: static decorative boxes, order never changes
				<span key={i} className={cn("size-2 rounded-[2px]", color)} />
			))}
		</span>
	);
}
