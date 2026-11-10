export type ListSelectionStore = ReturnType<typeof createListSelectionStore>;

const NOTHING_SELECTED: ReadonlySet<string> = new Set();

/**
 * Selection lives outside React state so a toggle re-renders the rows whose
 * checkbox changed, not the whole list.
 */
export function createListSelectionStore() {
	let selected = NOTHING_SELECTED;
	const listeners = new Set<() => void>();

	const commit = (next: ReadonlySet<string>) => {
		const unchanged =
			next.size === selected.size &&
			[...next].every((key) => selected.has(key));
		if (unchanged) return;
		selected = next.size === 0 ? NOTHING_SELECTED : next;
		for (const listener of listeners) listener();
	};

	return {
		subscribe(listener: () => void) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		get: () => selected,
		toggle(key: string) {
			const next = new Set(selected);
			if (!next.delete(key)) next.add(key);
			commit(next);
		},
		add: (keys: readonly string[]) => commit(new Set([...selected, ...keys])),
		remove(keys: readonly string[]) {
			const gone = new Set(keys);
			commit(new Set([...selected].filter((key) => !gone.has(key))));
		},
		/** Drops every selected key that is no longer listed. */
		retain: (listed: ReadonlySet<string>) =>
			commit(new Set([...selected].filter((key) => listed.has(key)))),
		clear: () => commit(NOTHING_SELECTED),
	};
}
