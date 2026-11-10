import { Fragment, useMemo } from "react";
import { buildCommentThreads } from "#/components/details/comment-threads";
import {
	DetailActivityHeader,
	DetailCommentBox,
} from "#/components/details/detail-activity";
import { CommentThread } from "#/components/details/timeline/comment-thread";
import { getInvolvedUsers } from "#/components/details/timeline/involved-users";
import { LoadMoreDivider } from "#/components/details/timeline/load-more-divider";
import type { TimelineSubject } from "#/components/details/timeline/timeline-event-content";
import {
	type CloseReasonSource,
	TimelineEventGroupRow,
	TimelineEventRow,
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
import type { IssueDetail, IssuePageData } from "#/lib/github.types";

const ISSUE_SUBJECT: TimelineSubject = { kind: "issue" };

export function IssueDetailActivitySection({
	issue,
	page,
	pageQueryKey,
	owner,
	repo,
	issueNumber,
	scope,
	viewerLogin,
}: {
	issue: IssueDetail;
	page: IssuePageData;
	pageQueryKey: readonly unknown[];
	owner: string;
	repo: string;
	issueNumber: number;
	scope: GitHubQueryScope;
	viewerLogin?: string;
}) {
	const { events } = page;
	const comments = useStableById(page.comments);
	const issueState = issue.state === "closed" ? "closed" : "open";

	const commentThreads = useMemo(
		() => buildCommentThreads(comments),
		[comments],
	);
	const items = useMemo(
		() =>
			buildTimeline([
				...commentTimelineItems(comments, commentThreads.replyIds),
				...eventTimelineItems(events),
			]),
		[comments, commentThreads, events],
	);

	// The timeline can omit why an issue was closed; the issue itself knows.
	const closeReasonSource = useMemo<CloseReasonSource>(
		() => ({
			issueState,
			issueClosedAt: issue.closedAt,
			issueStateReason: issue.stateReason,
		}),
		[issueState, issue.closedAt, issue.stateReason],
	);

	const involvedUsers = useMemo(
		() => getInvolvedUsers([issue.author], comments),
		[issue.author, comments],
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
		issueNumber,
	});

	return (
		<div className="flex flex-col">
			<DetailActivityHeader
				title="Activity"
				count={comments.length + events.length}
			/>

			{visibleItems.length === 0 ? (
				<p className="py-4 text-sm text-muted-foreground">No activity yet.</p>
			) : (
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
												issueNumber={issueNumber}
												scope={scope}
												viewerLogin={viewerLogin}
											/>
										),
									};
								case "label_group":
								case "review_request_group":
									return {
										key: `${item.type}-${item.data.createdAt}`,
										element: (
											<TimelineEventGroupRow group={item} {...position} />
										),
									};
								case "issue_state_toggle_group":
									return {
										key: timelineStateToggleGroupKey(item.data),
										element: (
											<TimelineStateToggleGroupRow
												group={item.data}
												subject="issue"
												closeReasonSource={closeReasonSource}
												{...position}
											/>
										),
									};
								case "event":
									return {
										key: timelineEventKey(item.data),
										element: (
											<TimelineEventRow
												event={item.data}
												subject={ISSUE_SUBJECT}
												closeReasonSource={closeReasonSource}
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
			)}

			<div className="mt-6">
				<DetailCommentBox
					owner={owner}
					repo={repo}
					issueNumber={issueNumber}
					scope={scope}
					involvedUsers={involvedUsers}
					stateToggle={{ kind: "issue", state: issueState }}
				/>
			</div>
		</div>
	);
}
