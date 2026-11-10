import { cn } from "@diffkit/ui/lib/utils";
import { memo } from "react";
import {
	GroupedIssueStateToggleDescription,
	GroupedLabelDescription,
	GroupedReviewRequestDescription,
} from "#/components/details/grouped-label-event";
import type {
	GroupedIssueStateToggleEvent,
	GroupedLabelEvent,
	GroupedReviewRequestEvent,
	TimelineEvent,
} from "#/lib/github.types";
import { mergeIssueStateIntoCloseEvent } from "#/lib/timeline-close-reason";
import { RelativeTime } from "./relative-time";
import {
	getTimelineEventDescription,
	getTimelineEventIcon,
	LabelEventIcon,
	ReviewRequestEventIcon,
	type TimelineSubject,
} from "./timeline-event-content";
import type { EventRunPosition } from "./timeline-items";

/**
 * Spacing for an event followed by another event, and the 0.5px thread joining
 * its glyph to the next one's, 1.5px clear of each (glyphs sit 10px in, 14px wide).
 */
export const eventThreadClassName =
	"pb-1 after:absolute after:top-[calc(100%-5.5px)] after:left-[16.75px] after:h-[11.5px] after:w-[0.5px] after:bg-activity-line";

export const timelineGlyphClassName =
	"ml-[10px] mt-[3px] flex size-3.5 shrink-0 items-center justify-center self-start text-muted-foreground [&_svg]:size-3.5";

export const timelineAvatarClassName =
	"ml-[10px] mt-[3px] size-3.5 shrink-0 self-start rounded-full ring-[0.5px] ring-chip-border";

export const timelineTextClassName =
	"min-w-0 text-xs leading-5 font-[450] text-muted-foreground";

/** Fills in a close event's missing reason from the issue's current state. Pull requests have none to fill in. */
export type CloseReasonSource = Parameters<
	typeof mergeIssueStateIntoCloseEvent
>[1];

export function eventRunSpacing({
	isFirst,
	isConsecutive,
	isLastInRun,
}: EventRunPosition) {
	return cn(
		!isFirst && isConsecutive ? "pt-1" : "pt-5",
		isLastInRun ? "pb-5" : eventThreadClassName,
	);
}

export function TimelineTimestamp({ date }: { date: string }) {
	return (
		<span className="-ml-[7.5px] shrink-0 text-xs leading-5 font-[450] tabular-nums text-muted-foreground before:mr-1 before:content-['·']">
			<RelativeTime date={date} />
		</span>
	);
}

function TimelineRow({
	position,
	avatar,
	icon,
	date,
	children,
}: {
	position: EventRunPosition;
	avatar: { login: string; avatarUrl: string } | null | undefined;
	icon: React.ReactNode;
	date: string;
	children: React.ReactNode;
}) {
	return (
		<div
			className={cn(
				"relative flex items-start gap-[11.5px]",
				eventRunSpacing(position),
			)}
		>
			{avatar?.avatarUrl ? (
				<img
					src={avatar.avatarUrl}
					alt={avatar.login}
					className={timelineAvatarClassName}
				/>
			) : (
				<div className={timelineGlyphClassName}>{icon}</div>
			)}
			<span className={timelineTextClassName}>{children}</span>
			{date && <TimelineTimestamp date={date} />}
		</div>
	);
}

export const TimelineEventRow = memo(function TimelineEventRow({
	event: rawEvent,
	subject,
	closeReasonSource,
	isFirst,
	isConsecutive,
	isLastInRun,
}: {
	event: TimelineEvent;
	subject: TimelineSubject;
	closeReasonSource?: CloseReasonSource;
} & EventRunPosition) {
	const event = closeReasonSource
		? mergeIssueStateIntoCloseEvent(rawEvent, closeReasonSource)
		: rawEvent;
	const description = getTimelineEventDescription(event, subject);
	if (!description) return null;

	const isCrossReference =
		event.event === "cross-referenced" || event.event === "referenced";

	return (
		<TimelineRow
			position={{ isFirst, isConsecutive, isLastInRun }}
			avatar={isCrossReference ? null : event.actor}
			icon={getTimelineEventIcon(event, subject.kind)}
			date={event.createdAt}
		>
			{description}
		</TimelineRow>
	);
});

export const TimelineEventGroupRow = memo(function TimelineEventGroupRow({
	group,
	isFirst,
	isConsecutive,
	isLastInRun,
}: {
	group:
		| { type: "label_group"; data: GroupedLabelEvent }
		| { type: "review_request_group"; data: GroupedReviewRequestEvent };
} & EventRunPosition) {
	return (
		<TimelineRow
			position={{ isFirst, isConsecutive, isLastInRun }}
			avatar={group.data.actor}
			icon={
				group.type === "label_group" ? (
					<LabelEventIcon />
				) : (
					<ReviewRequestEventIcon />
				)
			}
			date={group.data.createdAt}
		>
			{group.type === "label_group" ? (
				<GroupedLabelDescription group={group.data} />
			) : (
				<GroupedReviewRequestDescription group={group.data} />
			)}
		</TimelineRow>
	);
});

export const TimelineStateToggleGroupRow = memo(
	function TimelineStateToggleGroupRow({
		group,
		subject,
		closeReasonSource,
		isFirst,
		isConsecutive,
		isLastInRun,
	}: {
		group: GroupedIssueStateToggleEvent;
		subject: TimelineSubject["kind"];
		closeReasonSource?: CloseReasonSource;
	} & EventRunPosition) {
		const withCloseReason = (event: TimelineEvent) =>
			closeReasonSource
				? mergeIssueStateIntoCloseEvent(event, closeReasonSource)
				: event;
		const lastEvent = group.events.at(-1);

		return (
			<TimelineRow
				position={{ isFirst, isConsecutive, isLastInRun }}
				avatar={group.actor}
				icon={
					lastEvent
						? getTimelineEventIcon(withCloseReason(lastEvent), subject)
						: null
				}
				date={group.createdAt}
			>
				<GroupedIssueStateToggleDescription
					group={group}
					subject={subject}
					mergeCloseReason={withCloseReason}
				/>
			</TimelineRow>
		);
	},
);

export const timelineStateToggleGroupKey = (
	group: GroupedIssueStateToggleEvent,
) =>
	`issue_state_toggle_group-${group.events.map((e) => e.id).join("-")}-${group.createdAt}`;
