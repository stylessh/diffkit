import type { NotificationItem } from "./github.types";

export type InboxFilter = "unread" | "all" | "saved";
export type InboxGrouping = "none" | "repository" | "reason";

export const INBOX_GROUPINGS: readonly InboxGrouping[] = [
	"none",
	"repository",
	"reason",
];

export type InboxGroup = {
	key: string;
	title: string;
	items: NotificationItem[];
};

const REASON_LABELS: Record<string, string> = {
	approval_requested: "Approval requested",
	assign: "Assigned",
	author: "Author",
	ci_activity: "CI activity",
	comment: "Commented",
	invitation: "Invited",
	manual: "Subscribed",
	member_feature_requested: "Feature requested",
	mention: "Mentioned",
	review_requested: "Review requested",
	security_advisory_credit: "Security credit",
	security_alert: "Security alert",
	state_change: "State changed",
	subscribed: "Watching",
	team_mention: "Team mentioned",
};

/** Ordered by how much they ask of the viewer. */
const REASON_ORDER = [
	"review_requested",
	"approval_requested",
	"mention",
	"team_mention",
	"assign",
	"author",
	"comment",
	"state_change",
	"ci_activity",
	"security_alert",
	"invitation",
	"manual",
	"subscribed",
];

export function reasonLabel(reason: string) {
	return REASON_LABELS[reason] ?? reason.replaceAll("_", " ");
}

function newestFirst(a: NotificationItem, b: NotificationItem) {
	return b.updatedAt.localeCompare(a.updatedAt);
}

function reasonRank(reason: string) {
	const index = REASON_ORDER.indexOf(reason);
	return index === -1 ? REASON_ORDER.length : index;
}

/**
 * Splits notifications into display groups, newest first inside each. Repo
 * groups are ordered by their latest activity; reason groups by urgency.
 */
export function groupNotifications(
	notifications: readonly NotificationItem[],
	grouping: InboxGrouping,
): InboxGroup[] {
	const sorted = [...notifications].sort(newestFirst);
	if (grouping === "none") {
		return [{ key: "all", title: "All", items: sorted }];
	}

	const groups = new Map<string, InboxGroup>();
	for (const item of sorted) {
		const key =
			grouping === "repository" ? item.repository.fullName : item.reason;
		const group = groups.get(key) ?? {
			key,
			title:
				grouping === "repository"
					? item.repository.fullName
					: reasonLabel(item.reason),
			items: [],
		};
		group.items.push(item);
		groups.set(key, group);
	}

	const list = [...groups.values()];
	return grouping === "reason"
		? list.sort((a, b) => reasonRank(a.key) - reasonRank(b.key))
		: list;
}

/** Notification ids in the order j/k walk them: open groups only. */
export function visibleOrder(
	groups: readonly InboxGroup[],
	collapsed: ReadonlySet<string>,
) {
	return groups.flatMap((group) =>
		collapsed.has(group.key) ? [] : group.items.map((item) => item.id),
	);
}

export function stepSelection(
	order: readonly string[],
	current: string | null,
	step: 1 | -1,
): string | null {
	if (order.length === 0) return null;
	const index = current === null ? -1 : order.indexOf(current);
	if (index === -1) return step === 1 ? order[0] : order[order.length - 1];
	return order[Math.min(order.length - 1, Math.max(0, index + step))];
}

/**
 * Where selection goes when `removed` leaves the list: the next row, or the
 * previous one at the end, as in Linear's inbox.
 */
export function selectionAfterRemoval(
	order: readonly string[],
	current: string | null,
	removed: string,
): string | null {
	if (current !== removed) return current;
	const index = order.indexOf(removed);
	if (index === -1) return null;
	return order[index + 1] ?? order[index - 1] ?? null;
}

export type SubjectRef = {
	type: "PullRequest" | "Issue";
	owner: string;
	repo: string;
	number: number;
};

const API_SUBJECT = /\/repos\/[^/]+\/[^/]+\/(pulls|issues)\/(\d+)$/u;

export function parseSubjectRef(
	notification: NotificationItem,
): SubjectRef | null {
	const match = notification.subject.url?.match(API_SUBJECT);
	if (!match) return null;
	return {
		type: match[1] === "pulls" ? "PullRequest" : "Issue",
		owner: notification.repository.owner.login,
		repo: notification.repository.name,
		number: Number(match[2]),
	};
}

export function subjectHref(subject: SubjectRef) {
	return subject.type === "PullRequest"
		? `/${subject.owner}/${subject.repo}/pull/${subject.number}`
		: `/${subject.owner}/${subject.repo}/issues/${subject.number}`;
}
