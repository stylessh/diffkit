import type { TimelineEvent } from "#/lib/github.types";

/** Normalized from GitHub REST `state_reason` on close events */
export type CloseReasonKind = "completed" | "not_planned" | "other";

export function parseCloseReason(
	raw: string | undefined,
): CloseReasonKind | null {
	if (!raw) {
		return null;
	}
	const r = raw.toLowerCase();
	if (r === "completed") {
		return "completed";
	}
	if (r === "not_planned") {
		return "not_planned";
	}
	return "other";
}

/** When the timeline payload omits `state_reason`, match the close row to the issue’s current `closedAt` / `stateReason`. */
export function mergeIssueStateIntoCloseEvent(
	event: TimelineEvent,
	opts: {
		issueState?: "open" | "closed";
		issueClosedAt?: string | null;
		issueStateReason?: string | null;
	},
): TimelineEvent {
	if (event.event !== "closed" || event.stateReason) {
		return event;
	}
	if (opts.issueState !== "closed") {
		return event;
	}
	const sr = opts.issueStateReason;
	const closedAt = opts.issueClosedAt;
	if (!sr || !closedAt) {
		return event;
	}
	if (!closeTimestampsMatch(event.createdAt, closedAt)) {
		return event;
	}
	return { ...event, stateReason: sr };
}

function closeTimestampsMatch(created: string, closed: string): boolean {
	const a = Date.parse(created);
	const b = Date.parse(closed);
	if (Number.isNaN(a) || Number.isNaN(b)) {
		return created === closed;
	}
	return Math.abs(a - b) <= 120_000;
}
