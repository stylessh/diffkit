import { GitCommitIcon, GitMergeIcon } from "@diffkit/icons";
import { cn } from "@diffkit/ui/lib/utils";
import { memo } from "react";
import { RelativeTime } from "#/components/details/timeline/relative-time";
import {
	getTimelineEventDescription,
	getTimelineEventIcon,
	type TimelineSubject,
} from "#/components/details/timeline/timeline-event-content";
import {
	eventRunSpacing,
	TimelineEventRow,
	TimelineTimestamp,
	timelineAvatarClassName,
	timelineGlyphClassName,
	timelineTextClassName,
} from "#/components/details/timeline/timeline-event-row";
import type { EventRunPosition } from "#/components/details/timeline/timeline-items";
import { AppMarkdown } from "#/components/markdown/app-markdown";
import type {
	PullCommit,
	PullDetail,
	PullReviewComment,
	TimelineEvent,
} from "#/lib/github.types";
import {
	ReviewCommentThread,
	type ReviewThreadInfo,
} from "../review-comments/review-comment-thread";

export const CommitRow = memo(function CommitRow({
	commit,
	...position
}: { commit: PullCommit } & EventRunPosition) {
	return (
		<div
			className={cn(
				"relative flex items-start gap-[11.5px]",
				eventRunSpacing(position),
			)}
		>
			<div className={timelineGlyphClassName}>
				<GitCommitIcon
					size={12}
					strokeWidth={2}
					className="text-muted-foreground"
				/>
			</div>
			{commit.author ? (
				<img
					src={commit.author.avatarUrl}
					alt={commit.author.login}
					className={timelineAvatarClassName}
				/>
			) : (
				<div className="size-3.5 shrink-0 rounded-full bg-group" />
			)}
			<span className="min-w-0 truncate text-xs leading-5 font-[450] text-text-header">
				{commit.message.split("\n")[0]}
			</span>
			<code className="ml-auto shrink-0 font-mono text-[11px] text-icon-faint">
				{commit.sha.slice(0, 7)}
			</code>
			<span className="shrink-0 text-xs font-[450] tabular-nums text-icon-faint">
				<RelativeTime date={commit.createdAt} />
			</span>
		</div>
	);
});

export const MergedRow = memo(function MergedRow({
	pr,
	mergedAt,
}: {
	pr: PullDetail;
	mergedAt: string;
}) {
	return (
		<div className="flex items-center gap-1.5 pt-5 pb-5">
			<div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-merged text-white">
				<GitMergeIcon size={12} strokeWidth={2} />
			</div>
			{pr.mergedBy ? (
				<img
					src={pr.mergedBy.avatarUrl}
					alt={pr.mergedBy.login}
					className={timelineAvatarClassName}
				/>
			) : (
				<div className="size-3.5 shrink-0 rounded-full bg-group" />
			)}
			<span className="text-[13px]">
				<span className="font-medium">{pr.mergedBy?.login ?? "Unknown"}</span>
				{" merged commit "}
				{pr.mergeCommitSha && (
					<code className="font-mono text-[11px] text-icon-faint">
						{pr.mergeCommitSha.slice(0, 7)}
					</code>
				)}
				{" into "}
				<code className="font-mono text-[11px] text-icon-faint">
					{pr.baseRefName}
				</code>
			</span>
			<TimelineTimestamp date={mergedAt} />
		</div>
	);
});

/** A review that says something, as a body or inline comments, opens up under its event line. */
export const PullEventRow = memo(function PullEventRow({
	event,
	subject,
	reviewComments,
	repliesByCommentId,
	threadInfoByCommentId,
	owner,
	repo,
	pullNumber,
	viewerLogin,
	...position
}: {
	event: TimelineEvent;
	subject: TimelineSubject;
	reviewComments: PullReviewComment[] | undefined;
	repliesByCommentId: ReadonlyMap<number, PullReviewComment[]>;
	threadInfoByCommentId: ReadonlyMap<number, ReviewThreadInfo> | undefined;
	owner: string;
	repo: string;
	pullNumber: number;
	viewerLogin?: string;
} & EventRunPosition) {
	const reviewBody = event.body?.trim() ? event.body : null;
	const isExpandedReview =
		event.event === "reviewed" &&
		(reviewBody !== null || (reviewComments?.length ?? 0) > 0);

	if (!isExpandedReview) {
		return <TimelineEventRow event={event} subject={subject} {...position} />;
	}

	return (
		<div className="flex flex-col gap-2 py-5">
			<div className="flex items-center gap-1.5">
				{getTimelineEventIcon(event, "pull")}
				<span className={timelineTextClassName}>
					{getTimelineEventDescription(event, subject)}
				</span>
				<TimelineTimestamp date={event.createdAt} />
			</div>
			{reviewBody && (
				<AppMarkdown
					owner={owner}
					repo={repo}
					className="text-muted-foreground"
				>
					{reviewBody}
				</AppMarkdown>
			)}
			{reviewComments && reviewComments.length > 0 && (
				<div className="flex flex-col gap-2">
					{reviewComments.map((comment) => (
						<ReviewCommentThread
							key={comment.id}
							comment={comment}
							replies={repliesByCommentId.get(comment.id)}
							owner={owner}
							repo={repo}
							pullNumber={pullNumber}
							viewerLogin={viewerLogin}
							threadInfo={threadInfoByCommentId?.get(comment.id)}
						/>
					))}
				</div>
			)}
		</div>
	);
});
