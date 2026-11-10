import { useQuery } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { githubNotificationsQueryOptions } from "#/lib/github.query";
import type { NotificationItem } from "#/lib/github.types";
import {
	groupNotifications,
	INBOX_GROUPINGS,
	type InboxFilter,
	type InboxGrouping,
	parseSubjectRef,
	selectionAfterRemoval,
	stepSelection,
	subjectHref,
	visibleOrder,
} from "#/lib/inbox";
import { type ShortcutDefinition, useGlobalShortcuts } from "#/lib/shortcuts";
import { useHasMounted } from "#/lib/use-has-mounted";
import { useLocalStorageState } from "#/lib/use-local-storage-state";
import { useMediaQuery } from "#/lib/use-media-query";
import { InboxList } from "./inbox-list";
import { InboxPreview } from "./inbox-preview";
import { useInboxActions } from "./use-inbox-actions";
import { useSavedNotifications } from "./use-saved-notifications";

const routeApi = getRouteApi("/_protected/inbox");

function isGrouping(value: unknown): value is InboxGrouping {
	return INBOX_GROUPINGS.includes(value as InboxGrouping);
}

function useInboxItems(
	scope: { userId: string },
	filter: InboxFilter,
	saved: NotificationItem[],
) {
	const hasMounted = useHasMounted();
	const unread = useQuery({
		...githubNotificationsQueryOptions(scope, { all: false }),
		enabled: hasMounted,
	});
	const all = useQuery({
		...githubNotificationsQueryOptions(scope, { all: true }),
		enabled: hasMounted && filter !== "unread",
	});

	const items = useMemo(() => {
		if (filter === "unread") return unread.data?.notifications;
		if (filter === "all") return all.data?.notifications;
		const fresh = new Map(
			(all.data?.notifications ?? []).map((item) => [item.id, item]),
		);
		return saved.map((item) => fresh.get(item.id) ?? item);
	}, [filter, unread.data, all.data, saved]);

	const active = filter === "unread" ? unread : all;
	return {
		items,
		unreadCount: unread.data
			? unread.data.notifications.filter((item) => item.unread).length
			: null,
		error: active.error,
		isReady: hasMounted && (filter === "saved" || active.data !== undefined),
	};
}

export function InboxPage() {
	const { user } = routeApi.useRouteContext();
	const scope = useMemo(() => ({ userId: user.id }), [user.id]);
	const navigate = useNavigate();
	const isDesktop = useMediaQuery("(min-width: 768px)");
	const actions = useInboxActions(scope);
	const {
		saved,
		savedIds,
		toggle: toggleSaved,
	} = useSavedNotifications(user.id);

	const [filter, setFilter] = useState<InboxFilter>("unread");
	const [grouping, setGrouping] = useLocalStorageState<InboxGrouping>(
		"diffkit:inbox-grouping",
		{ defaultValue: "none", validate: isGrouping },
	);
	const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
	const [selectedId, setSelectedId] = useState<string | null>(null);

	const inbox = useInboxItems(scope, filter, saved);
	const groups = useMemo(
		() => groupNotifications(inbox.items ?? [], grouping),
		[inbox.items, grouping],
	);
	const order = useMemo(
		() => visibleOrder(groups, collapsed),
		[groups, collapsed],
	);
	const selected = inbox.items?.find((item) => item.id === selectedId) ?? null;

	const select = useCallback(
		(item: NotificationItem) => {
			const subject = parseSubjectRef(item);
			if (!isDesktop && subject) {
				void navigate({ to: subjectHref(subject) });
				return;
			}
			setSelectedId(item.id);
			if (item.unread) void actions.markRead(item);
		},
		[actions, isDesktop, navigate],
	);

	const remove = useCallback(
		(
			item: NotificationItem,
			write: (item: NotificationItem) => Promise<void>,
		) => {
			if (filter !== "saved") {
				setSelectedId((current) =>
					selectionAfterRemoval(order, current, item.id),
				);
			}
			void write(item);
		},
		[filter, order],
	);
	const markDone = useCallback(
		(item: NotificationItem) => remove(item, actions.markDone),
		[remove, actions],
	);
	const unsubscribe = useCallback(
		(item: NotificationItem) => remove(item, actions.unsubscribe),
		[remove, actions],
	);

	const step = (direction: 1 | -1) => {
		const id = stepSelection(order, selectedId, direction);
		const item = inbox.items?.find((entry) => entry.id === id);
		if (item) select(item);
	};
	const withSelected = (run: (item: NotificationItem) => void) => () => {
		if (selected) run(selected);
	};
	const shortcuts: ShortcutDefinition[] = [
		{ shortcut: { key: "j" }, onTrigger: () => step(1) },
		{ shortcut: { key: "ArrowDown" }, onTrigger: () => step(1) },
		{ shortcut: { key: "k" }, onTrigger: () => step(-1) },
		{ shortcut: { key: "ArrowUp" }, onTrigger: () => step(-1) },
		{ shortcut: { key: "e" }, onTrigger: withSelected(markDone) },
		{ shortcut: { key: "s" }, onTrigger: withSelected(toggleSaved) },
		{
			shortcut: { key: "m", shift: true },
			onTrigger: withSelected(unsubscribe),
		},
		{
			shortcut: { key: "Enter" },
			onTrigger: withSelected((item) => {
				const subject = parseSubjectRef(item);
				if (subject) void navigate({ to: subjectHref(subject) });
			}),
			enabled: selected !== null,
		},
		{
			shortcut: { key: "Escape" },
			onTrigger: () => setSelectedId(null),
			enabled: selected !== null,
		},
	];
	useGlobalShortcuts(shortcuts);

	const toggleGroup = useCallback((key: string) => {
		setCollapsed((current) => {
			const next = new Set(current);
			if (!next.delete(key)) next.add(key);
			return next;
		});
	}, []);

	if (inbox.error) throw inbox.error;

	return (
		<div className="flex h-full min-h-0">
			<InboxList
				filter={filter}
				onFilterChange={(next) => {
					setFilter(next);
					setSelectedId(null);
				}}
				counts={{ unread: inbox.unreadCount, all: null, saved: saved.length }}
				grouping={grouping}
				onGroupingChange={setGrouping}
				groups={groups}
				collapsed={collapsed}
				onToggleGroup={toggleGroup}
				selectedId={selectedId}
				savedIds={savedIds}
				isLoading={!inbox.isReady}
				onSelect={select}
				onMarkRead={(item) => void actions.markRead(item)}
				onMarkDone={markDone}
				onToggleSaved={toggleSaved}
				onMarkAllRead={() => void actions.markAllRead()}
				onMarkReadDone={() =>
					void actions.markDoneMany(
						(inbox.items ?? []).filter(
							(item) => !item.unread && !savedIds.has(item.id),
						),
					)
				}
			/>
			<InboxPreview
				item={selected}
				userId={user.id}
				saved={selected ? savedIds.has(selected.id) : false}
				onToggleSaved={toggleSaved}
				onUnsubscribe={unsubscribe}
				onMarkDone={markDone}
			/>
		</div>
	);
}
