import { useCallback } from "react";
import { useLocalStorageState } from "./use-local-storage-state";

type CollapsedGroupsState = Record<string, boolean>;

function isCollapsedGroupsState(value: unknown): value is CollapsedGroupsState {
	return (
		typeof value === "object" &&
		value !== null &&
		!Array.isArray(value) &&
		Object.values(value).every((item) => typeof item === "boolean")
	);
}

export function useCollapsedGroups(storageKey: string) {
	const [collapsedGroups, setCollapsedGroups] =
		useLocalStorageState<CollapsedGroupsState>(storageKey, {
			defaultValue: {},
			parse: JSON.parse,
			serialize: JSON.stringify,
			validate: isCollapsedGroupsState,
		});

	const setGroupCollapsed = useCallback(
		(groupId: string, isCollapsed: boolean) => {
			setCollapsedGroups((currentGroups) => {
				if (currentGroups[groupId] === isCollapsed) {
					return currentGroups;
				}

				return {
					...currentGroups,
					[groupId]: isCollapsed,
				};
			});
		},
		[setCollapsedGroups],
	);

	return { collapsedGroups, setGroupCollapsed };
}
