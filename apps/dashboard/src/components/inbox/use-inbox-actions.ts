import { toast } from "@diffkit/ui/components/sonner";
import { useMemo } from "react";
import {
	markAllNotificationsRead,
	markNotificationDone,
	markNotificationRead,
	unsubscribeNotification,
} from "#/lib/github.functions";
import { type GitHubQueryScope, githubQueryKeys } from "#/lib/github.query";
import type { NotificationItem, NotificationsResult } from "#/lib/github.types";
import { useOptimisticMutation } from "#/lib/use-optimistic-mutation";

type ListUpdate = (items: NotificationItem[]) => NotificationItem[];

const isOk = (result: { ok: boolean }) => result.ok;

/** Inbox writes, applied to both cached lists (unread and all) at once. */
export function useInboxActions(scope: GitHubQueryScope) {
	const { mutate } = useOptimisticMutation();

	return useMemo(() => {
		const lists = [
			githubQueryKeys.notifications.list(scope, { all: false }),
			githubQueryKeys.notifications.list(scope, { all: true }),
		];
		const updates = (update: ListUpdate) =>
			lists.map((queryKey) => ({
				queryKey,
				updater: (prev: NotificationsResult) => ({
					...prev,
					notifications: update(prev.notifications),
				}),
			}));
		const run = async (
			failure: string,
			mutationFn: () => Promise<{ ok: boolean }>,
			update: ListUpdate,
		) => {
			const result = await mutate({
				mutationFn,
				updates: updates(update),
				isSuccess: isOk,
			});
			if (!result?.ok) toast.error(failure);
		};
		const without = (id: string) => (items: NotificationItem[]) =>
			items.filter((item) => item.id !== id);

		return {
			markRead: (item: NotificationItem) =>
				run(
					"Couldn't mark as read",
					() => markNotificationRead({ data: { threadId: item.id } }),
					(items) =>
						items.map((n) => (n.id === item.id ? { ...n, unread: false } : n)),
				),
			markDone: (item: NotificationItem) =>
				run(
					"Couldn't mark as done",
					() => markNotificationDone({ data: { threadId: item.id } }),
					without(item.id),
				),
			unsubscribe: (item: NotificationItem) =>
				run(
					"Couldn't unsubscribe",
					() => unsubscribeNotification({ data: { threadId: item.id } }),
					without(item.id),
				),
			markAllRead: () =>
				run(
					"Couldn't mark all as read",
					() => markAllNotificationsRead(),
					(items) => items.map((n) => ({ ...n, unread: false })),
				),
			markDoneMany: (items: NotificationItem[]) => {
				const ids = new Set(items.map((item) => item.id));
				return run(
					"Couldn't mark all as done",
					async () => {
						const results = await Promise.all(
							items.map((item) =>
								markNotificationDone({ data: { threadId: item.id } }),
							),
						);
						return { ok: results.every(isOk) };
					},
					(current) => current.filter((item) => !ids.has(item.id)),
				);
			},
		};
	}, [mutate, scope]);
}
