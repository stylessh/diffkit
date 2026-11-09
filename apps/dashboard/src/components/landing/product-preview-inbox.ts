import { useState } from "react";
import type { NotificationItem } from "#/lib/github.types";
import type { InboxFilter, InboxGrouping } from "#/lib/inbox";

function toggled(set: ReadonlySet<string>, key: string): ReadonlySet<string> {
	const next = new Set(set);
	if (!next.delete(key)) next.add(key);
	return next;
}

/**
 * The sample inbox, kept above the pages so what a visitor read or cleared is
 * still read or cleared when they come back to it.
 */
export function usePreviewInbox(notifications: NotificationItem[]) {
	const [items, setItems] = useState(notifications);
	const [filter, setFilter] = useState<InboxFilter>("unread");
	const [grouping, setGrouping] = useState<InboxGrouping>("none");
	const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
	const [savedIds, setSavedIds] = useState<ReadonlySet<string>>(new Set());

	const markRead = (target: NotificationItem) =>
		setItems((current) =>
			current.map((item) =>
				item.id === target.id ? { ...item, unread: false } : item,
			),
		);
	const toggleSaved = (target: NotificationItem) =>
		setSavedIds((current) => toggled(current, target.id));
	const markDone = (target: NotificationItem) =>
		setItems((current) => current.filter((item) => item.id !== target.id));

	return {
		items,
		filter,
		setFilter,
		grouping,
		setGrouping,
		collapsed,
		toggleGroup: (key: string) =>
			setCollapsed((current) => toggled(current, key)),
		savedIds,
		toggleSaved,
		markRead,
		markDone,
		markAllRead: () =>
			setItems((current) =>
				current.map((item) => ({ ...item, unread: false })),
			),
		clearRead: () =>
			setItems((current) =>
				current.filter((item) => item.unread || savedIds.has(item.id)),
			),
	};
}

export type PreviewInbox = ReturnType<typeof usePreviewInbox>;
