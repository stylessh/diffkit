import { useCallback, useMemo } from "react";
import type { NotificationItem } from "#/lib/github.types";
import { useLocalStorageState } from "#/lib/use-local-storage-state";

const MAX_SAVED = 200;

function isSavedList(value: unknown): value is NotificationItem[] {
	return (
		Array.isArray(value) &&
		value.every(
			(item) =>
				item &&
				typeof item === "object" &&
				typeof (item as NotificationItem).id === "string",
		)
	);
}

/**
 * GitHub's "Saved" notifications have no public API, so saved threads are
 * kept per user in this browser, as snapshots so they outlive "done".
 */
export function useSavedNotifications(userId: string) {
	const [saved, setSaved] = useLocalStorageState<NotificationItem[]>(
		`diffkit:inbox-saved:${userId}`,
		{
			defaultValue: [],
			validate: isSavedList,
			parse: JSON.parse,
			serialize: JSON.stringify,
		},
	);
	const savedIds = useMemo(
		() => new Set(saved.map((item) => item.id)),
		[saved],
	);

	const toggle = useCallback(
		(item: NotificationItem) =>
			setSaved((current) =>
				current.some((entry) => entry.id === item.id)
					? current.filter((entry) => entry.id !== item.id)
					: [item, ...current].slice(0, MAX_SAVED),
			),
		[setSaved],
	);

	return { saved, savedIds, toggle };
}
