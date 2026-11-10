import { ChevronDownIcon } from "@diffkit/icons";
import { cn } from "@diffkit/ui/lib/utils";
import { Skeleton } from "skullet/react";
import { SkeletonSample } from "#/components/shared/skeleton-sample";
import type { GitHubQueryScope } from "#/lib/github.query";
import { CommentThread } from "./comment-thread";
import { SAMPLE_TIMELINE_PAGE_COMMENTS } from "./timeline-samples";

const SAMPLE_SCOPE: GitHubQueryScope = { userId: "sample" };

function TimelinePageSkeleton() {
	return (
		<Skeleton loading label="Loading more activity">
			<SkeletonSample>
				{SAMPLE_TIMELINE_PAGE_COMMENTS.map((comment) => (
					<CommentThread
						key={comment.id}
						comment={comment}
						isFirst={false}
						owner="sample"
						repo="sample"
						issueNumber={0}
						scope={SAMPLE_SCOPE}
					/>
				))}
			</SkeletonSample>
		</Skeleton>
	);
}

/**
 * Sits where a long timeline is cut. Hidden items are revealed in place; once
 * those run out it fetches the next page, shown as a skeleton until it lands.
 */
export function LoadMoreDivider({
	hiddenCount,
	hasMorePages,
	isFetchingPage,
	onLoadMore,
}: {
	hiddenCount: number;
	hasMorePages: boolean;
	isFetchingPage: boolean;
	onLoadMore: () => void;
}) {
	const label =
		hiddenCount > 0
			? `${hiddenCount}${hasMorePages ? "+" : ""} more ${hiddenCount === 1 && !hasMorePages ? "item" : "items"}`
			: "Load more";

	return (
		<>
			<div className="flex items-center gap-3 py-3">
				<div className="h-px flex-1 bg-border" />
				<button
					type="button"
					onClick={onLoadMore}
					disabled={isFetchingPage}
					className={cn(
						"flex shrink-0 items-center gap-1.5 rounded-md border-[0.5px] border-border bg-surface-1 px-3 py-1 text-xs text-muted-foreground transition-colors",
						isFetchingPage
							? "cursor-not-allowed opacity-60"
							: "hover:bg-ghost-hover hover:text-foreground",
					)}
				>
					<ChevronDownIcon size={12} strokeWidth={2} />
					{label}
				</button>
				<div className="h-px flex-1 bg-border" />
			</div>
			{isFetchingPage && <TimelinePageSkeleton />}
		</>
	);
}
