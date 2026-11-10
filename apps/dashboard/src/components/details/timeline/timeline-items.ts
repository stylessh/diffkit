import { groupTimelineEvents } from "#/components/details/grouped-label-event";
import type { IssueComment, TimelineEvent } from "#/lib/github.types";

export type CommentTimelineItem = {
	type: "comment";
	date: string;
	data: IssueComment;
};

export type EventTimelineItem = {
	type: "event";
	date: string;
	data: TimelineEvent;
};

export function commentTimelineItems(
	comments: readonly IssueComment[],
	replyIds: ReadonlySet<number>,
): CommentTimelineItem[] {
	return comments
		.filter((comment) => !replyIds.has(comment.id))
		.map((comment) => ({
			type: "comment",
			date: comment.createdAt,
			data: comment,
		}));
}

export function eventTimelineItems(
	events: readonly TimelineEvent[],
): EventTimelineItem[] {
	return events.map((event) => ({
		type: "event",
		date: event.createdAt,
		data: event,
	}));
}

/** Oldest first, with one actor's rapid label, review-request and open/close changes folded into single rows. */
export function buildTimeline<
	T extends { type: string; date: string; data: unknown },
>(items: T[]) {
	return groupTimelineEvents(
		[...items].sort(
			(a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
		),
	);
}

const EVENT_LIKE_TYPES = new Set([
	"event",
	"label_group",
	"review_request_group",
	"issue_state_toggle_group",
]);

export type EventRunPosition = {
	isFirst: boolean;
	isConsecutive: boolean;
	isLastInRun: boolean;
};

/** Where an event row sits in a run of adjacent event rows, which sets its spacing and connector. */
export function eventRunPosition(
	items: readonly { type: string }[],
	index: number,
): EventRunPosition {
	const isEventLike = (at: number) =>
		at >= 0 && at < items.length && EVENT_LIKE_TYPES.has(items[at].type);
	return {
		isFirst: index === 0,
		isConsecutive: isEventLike(index) && isEventLike(index - 1),
		isLastInRun: isEventLike(index) && !isEventLike(index + 1),
	};
}

export const timelineEventKey = (event: TimelineEvent) =>
	`event-${event.event}-${event.id}-${event.createdAt}`;
