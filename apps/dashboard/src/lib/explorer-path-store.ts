import { useSyncExternalStore } from "react";

/**
 * Lightweight external store for the current explorer path.
 *
 * Tree nodes subscribe via `useIsActivePath(entryPath)` which returns a
 * derived boolean. Because `useSyncExternalStore` compares snapshots by
 * value (===), React bails out of re-rendering any node whose active
 * status didn't actually change — so navigating between files only
 * re-renders the old-active and new-active nodes instead of the entire tree.
 */

let currentPath = "";
const listeners = new Set<() => void>();

function emit() {
	for (const fn of listeners) fn();
}

function subscribe(cb: () => void) {
	listeners.add(cb);
	return () => {
		listeners.delete(cb);
	};
}

export function setExplorerPath(path: string) {
	if (path === currentPath) return;
	currentPath = path;
	emit();
}

/** Read the current path imperatively (outside of React). */
export function getExplorerPath() {
	return currentPath;
}

export function useExplorerPath() {
	return useSyncExternalStore(
		subscribe,
		() => currentPath,
		() => "",
	);
}

/**
 * Returns true only when `entryPath` exactly matches the current explorer
 * path. Because the snapshot is a boolean primitive, nodes that remain
 * inactive skip re-rendering entirely.
 */
export function useIsActivePath(entryPath: string) {
	return useSyncExternalStore(
		subscribe,
		() => currentPath === entryPath,
		() => false,
	);
}

/**
 * Returns true when the current path is a descendant of `entryPath`
 * (i.e. the directory is an ancestor of the active file/folder).
 */
export function useIsAncestorPath(entryPath: string) {
	return useSyncExternalStore(
		subscribe,
		() => currentPath.startsWith(`${entryPath}/`),
		() => false,
	);
}
