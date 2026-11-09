/**
 * The path the repo explorer shows. Set by the explorer layout before paint
 * and read imperatively by the file tree, which selects and reveals it without
 * re-rendering.
 */

let currentPath = "";
const listeners = new Set<() => void>();

export function subscribeExplorerPath(cb: () => void) {
	listeners.add(cb);
	return () => {
		listeners.delete(cb);
	};
}

export function setExplorerPath(path: string) {
	if (path === currentPath) return;
	currentPath = path;
	for (const fn of listeners) fn();
}

export function getExplorerPath() {
	return currentPath;
}
