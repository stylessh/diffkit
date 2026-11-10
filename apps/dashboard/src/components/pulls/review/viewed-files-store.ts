/**
 * Which files the reviewer has ticked as viewed. A store rather than state so
 * a tick re-renders the one file header and the progress meter, not the diff.
 */
export type ViewedFilesStore = {
	has: (path: string) => boolean;
	count: () => number;
	set: (path: string, viewed: boolean) => void;
	subscribe: (listener: () => void) => () => void;
};

export function createViewedFilesStore(): ViewedFilesStore {
	const viewed = new Set<string>();
	const listeners = new Set<() => void>();
	return {
		has: (path) => viewed.has(path),
		count: () => viewed.size,
		set(path, value) {
			if (viewed.has(path) === value) return;
			if (value) viewed.add(path);
			else viewed.delete(path);
			for (const listener of listeners) listener();
		},
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
}
