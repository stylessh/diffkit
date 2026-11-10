import { Fragment, useMemo } from "react";
import { buildCommentThreads } from "#/components/details/comment-threads";
import { CommentThread } from "#/components/details/timeline/comment-thread";
import { LoadMoreDivider } from "#/components/details/timeline/load-more-divider";
import type { TimelineSubject } from "#/components/details/timeline/timeline-event-content";
import {
	TimelineEventGroupRow,
	TimelineStateToggleGroupRow,
	timelineStateToggleGroupKey,
} from "#/components/details/timeline/timeline-event-row";
import {
	buildTimeline,
	commentTimelineItems,
	eventRunPosition,
	eventTimelineItems,
	timelineEventKey,
} from "#/components/details/timeline/timeline-items";
import { useStableById } from "#/components/details/timeline/use-stable-by-id";
import { useWindowedTimeline } from "#/components/details/timeline/use-windowed-timeline";
import type { GitHubQueryScope } from "#/lib/github.query";
import type {
	PullDetail,
	PullPageData,
	PullReviewComment,
} from "#/lib/github.types";
import type { ReviewThreadInfo } from "../review-comments/review-comment-thread";
import { CommitRow, MergedRow, PullEventRow } from "./pull-timeline-rows";

function groupReviewComments(reviewComments: readonly PullReviewComment[]) {
	const byReviewId = new Map<number, PullReviewComment[]>();
	const repliesByCommentId = new Map<number, PullReviewComment[]>();
	const append = (
		groups: Map<number, PullReviewComment[]>,
		key: number,
		comment: PullReviewComment,
	) => groups.set(key, [...(groups.get(key) ?? []), comment]);

	for (const comment of reviewComments) {
		if (comment.inReplyToId != null) {
			append(repliesByCommentId, comment.inReplyToId, comment);
		} else if (comment.pullRequestReviewId != null) {
			append(byReviewId, comment.pullRequestReviewId, comment);
		}
	}
	return { byReviewId, repliesByCommentId };
}

const NO_REVIEW_COMMENTS: PullReviewComment[] = [];

export function PullTimeline({
	pr,
	page,
	reviewComments = NO_REVIEW_COMMENTS,
	threadInfoByCommentId,
	pageQueryKey,
	owner,
	repo,
	pullNumber,
	scope,
	viewerLogin,
}: {
	pr: PullDetail;
	page: PullPageData;
	reviewComments: PullReviewComment[] | undefined;
	threadInfoByCommentId: ReadonlyMap<number, ReviewThreadInfo> | undefined;
	pageQueryKey: readonly unknown[];
	owner: string;
	repo: string;
	pullNumber: number;
	scope: GitHubQueryScope;
	viewerLogin?: string;
}) {
	const { commits, events } = page;
	const comments = useStableById(page.comments);

	const reviewThreads = useMemo(
		() => groupReviewComments(reviewComments),
		[reviewComments],
	);
	const commentThreads = useMemo(
		() => buildCommentThreads(comments),
		[comments],
	);

	const { isMerged, mergedAt } = pr;
	const items = useMemo(
		() =>
			buildTimeline([
				...commentTimelineItems(comments, commentThreads.replyIds),
				...commits.map((commit) => ({
					type: "commit" as const,
					date: commit.createdAt,
					data: commit,
				})),
				// A merge closes the pull request too; the merged row stands for both.
				...eventTimelineItems(
					isMerged ? events.filter((e) => e.event !== "closed") : events,
				),
				...(isMerged && mergedAt
					? [{ type: "merged" as const, date: mergedAt, data: mergedAt }]
					: []),
			]),
		[comments, commentThreads, commits, events, isMerged, mergedAt],
	);

	const subject = useMemo<TimelineSubject>(
		() => ({ kind: "pull", headRefName: pr.headRefName }),
		[pr.headRefName],
	);

	const {
		visibleItems,
		hiddenCount,
		hasMorePages,
		loadMoreIndex,
		loadMore,
		isFetchingPage,
	} = useWindowedTimeline(items, {
		commentPagination: page.commentPagination,
		eventPagination: page.eventPagination,
		pageQueryKey,
		owner,
		repo,
		issueNumber: pullNumber,
	});

	if (visibleItems.length === 0) return null;

	return (
		<div className="relative flex flex-col">
			{visibleItems.map((item, index) => {
				const position = eventRunPosition(visibleItems, index);
				const row = (() => {
					switch (item.type) {
						case "comment":
							return {
								key: `comment-${item.data.id}`,
								element: (
									<CommentThread
										comment={item.data}
										replies={commentThreads.repliesByCommentId.get(
											item.data.id,
										)}
										isFirst={position.isFirst}
										owner={owner}
										repo={repo}
										issueNumber={pullNumber}
										scope={scope}
										viewerLogin={viewerLogin}
									/>
								),
							};
						case "commit":
							return {
								key: `commit-${item.data.sha}`,
								element: (
									<CommitRow
										commit={item.data}
										isFirst={position.isFirst}
										isConsecutive={visibleItems[index - 1]?.type === "commit"}
										isLastInRun={visibleItems[index + 1]?.type !== "commit"}
									/>
								),
							};
						case "merged":
							return {
								key: "merged",
								element: <MergedRow pr={pr} mergedAt={item.data} />,
							};
						case "label_group":
						case "review_request_group":
							return {
								key: `${item.type}-${item.data.createdAt}`,
								element: <TimelineEventGroupRow group={item} {...position} />,
							};
						case "issue_state_toggle_group":
							return {
								key: timelineStateToggleGroupKey(item.data),
								element: (
									<TimelineStateToggleGroupRow
										group={item.data}
										subject="pull"
										{...position}
									/>
								),
							};
						case "event":
							return {
								key: timelineEventKey(item.data),
								element: (
									<PullEventRow
										event={item.data}
										subject={subject}
										reviewComments={
											item.data.event === "reviewed"
												? reviewThreads.byReviewId.get(item.data.id)
												: undefined
										}
										repliesByCommentId={reviewThreads.repliesByCommentId}
										threadInfoByCommentId={threadInfoByCommentId}
										owner={owner}
										repo={repo}
										pullNumber={pullNumber}
										viewerLogin={viewerLogin}
										{...position}
									/>
								),
							};
					}
				})();

				return (
					<Fragment key={row.key}>
						{index === loadMoreIndex && (
							<LoadMoreDivider
								hiddenCount={hiddenCount}
								hasMorePages={hasMorePages}
								isFetchingPage={isFetchingPage}
								onLoadMore={loadMore}
							/>
						)}
						{row.element}
					</Fragment>
				);
			})}
		</div>
	);
}
