import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SerializedFilterStore } from "./filter-cookie";
import { readFilterCookieClient, writeFilterCookie } from "./filter-cookie";

// ── Types ──────────────────────────────────────────────────────────────

export type FilterDefinition = {
	id: string;
	label: string;
	icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
	/** Extract all possible values from the full item list */
	extractOptions: (items: FilterableItem[]) => FilterOption[];
	/** Test whether an item matches a set of selected values */
	match: (item: FilterableItem, values: Set<string>) => boolean;
};

export type FilterOption = {
	value: string;
	label: string;
	icon?: React.ReactNode;
};

export type ActiveFilter = {
	fieldId: string;
	values: Set<string>;
};

export type SortOption = {
	id: string;
	label: string;
	compare: (a: FilterableItem, b: FilterableItem) => number;
};

export type FilterableItem = {
	id: number;
	title: string;
	updatedAt: string;
	createdAt: string;
	comments: number;
	author: { login: string; avatarUrl: string } | null;
	repository: { fullName: string };
	state: string;
	[key: string]: unknown;
};

// ── Deserialize from cookie store ──────────────────────────────────────

function readPageState(
	store: SerializedFilterStore,
	pageId: string,
	defaultSortId: string,
): { searchQuery: string; activeFilters: ActiveFilter[]; sortId: string } {
	const page = store[pageId];
	if (!page || typeof page !== "object") {
		return { searchQuery: "", activeFilters: [], sortId: defaultSortId };
	}

	const searchQuery =
		typeof page.searchQuery === "string" ? page.searchQuery : "";
	const sortId = typeof page.sortId === "string" ? page.sortId : defaultSortId;

	let activeFilters: ActiveFilter[] = [];
	if (Array.isArray(page.activeFilters)) {
		activeFilters = page.activeFilters
			.filter(
				(f): f is { fieldId: string; values: string[] } =>
					typeof f === "object" &&
					f !== null &&
					typeof f.fieldId === "string" &&
					Array.isArray(f.values) &&
					f.values.every((v: unknown) => typeof v === "string"),
			)
			.map((f) => ({ fieldId: f.fieldId, values: new Set(f.values) }));
	}

	return { searchQuery, activeFilters, sortId };
}

function writePageState(
	pageId: string,
	state: { searchQuery: string; activeFilters: ActiveFilter[]; sortId: string },
) {
	const store = readFilterCookieClient();
	store[pageId] = {
		searchQuery: state.searchQuery,
		activeFilters: state.activeFilters.map((f) => ({
			fieldId: f.fieldId,
			values: [...f.values],
		})),
		sortId: state.sortId,
	};
	writeFilterCookie(store);
}

// ── Hook ───────────────────────────────────────────────────────────────

export function useListFilters<T extends FilterableItem>({
	pageId,
	items,
	filterDefs,
	sortOptions,
	defaultSortId,
	initialStore,
}: {
	/** Unique key for this page (e.g. "pulls", "issues", "reviews") */
	pageId: string;
	/** All items (used to extract filter options) */
	items: T[];
	filterDefs: FilterDefinition[];
	sortOptions: SortOption[];
	defaultSortId: string;
	/** Pre-read cookie store from the loader (avoids flash) */
	initialStore?: SerializedFilterStore;
}) {
	const [state, setState] = useState(() =>
		readPageState(initialStore ?? {}, pageId, defaultSortId),
	);

	// Validate sortId against available options
	const sortId = sortOptions.some((o) => o.id === state.sortId)
		? state.sortId
		: defaultSortId;

	// Persist to cookie on change
	const isInitial = useRef(true);
	useEffect(() => {
		if (isInitial.current) {
			isInitial.current = false;
			return;
		}
		writePageState(pageId, state);
	}, [pageId, state]);

	const availableOptions = useMemo(() => {
		const map = new Map<string, FilterOption[]>();
		for (const def of filterDefs) {
			map.set(def.id, def.extractOptions(items));
		}
		return map;
	}, [items, filterDefs]);

	const setSearchQuery = useCallback((searchQuery: string) => {
		setState((prev) => ({ ...prev, searchQuery }));
	}, []);

	const setSortId = useCallback((sortId: string) => {
		setState((prev) => ({ ...prev, sortId }));
	}, []);

	const addFilter = useCallback((fieldId: string, value: string) => {
		setState((prev) => {
			const existing = prev.activeFilters.find((f) => f.fieldId === fieldId);
			if (existing) {
				return {
					...prev,
					activeFilters: prev.activeFilters.map((f) =>
						f.fieldId === fieldId
							? { ...f, values: new Set([...f.values, value]) }
							: f,
					),
				};
			}
			return {
				...prev,
				activeFilters: [
					...prev.activeFilters,
					{ fieldId, values: new Set([value]) },
				],
			};
		});
	}, []);

	const removeFilterValue = useCallback((fieldId: string, value: string) => {
		setState((prev) => ({
			...prev,
			activeFilters: prev.activeFilters
				.map((f) => {
					if (f.fieldId !== fieldId) return f;
					const next = new Set(f.values);
					next.delete(value);
					return { ...f, values: next };
				})
				.filter((f) => f.values.size > 0),
		}));
	}, []);

	const removeFilter = useCallback((fieldId: string) => {
		setState((prev) => ({
			...prev,
			activeFilters: prev.activeFilters.filter((f) => f.fieldId !== fieldId),
		}));
	}, []);

	const clearAllFilters = useCallback(() => {
		setState((prev) => ({
			...prev,
			searchQuery: "",
			activeFilters: [],
		}));
	}, []);

	const hasActiveFilters =
		state.activeFilters.length > 0 || state.searchQuery.length > 0;

	return {
		searchQuery: state.searchQuery,
		setSearchQuery,
		activeFilters: state.activeFilters,
		sortId,
		setSortId,
		availableOptions,
		addFilter,
		removeFilterValue,
		removeFilter,
		clearAllFilters,
		hasActiveFilters,
		sortOptions,
		filterDefs,
	};
}

export type ListFilterState<T extends FilterableItem> = ReturnType<
	typeof useListFilters<T>
>;

/** Apply current filter state to an array of items */
export function applyFilters<T extends FilterableItem>(
	items: T[],
	state: ListFilterState<T>,
): T[] {
	const query = state.searchQuery.toLowerCase().trim();
	const sortFn =
		state.sortOptions.find((s) => s.id === state.sortId)?.compare ??
		state.sortOptions[0].compare;

	let result: T[] = items;

	// Text search
	if (query) {
		result = result.filter(
			(item) =>
				item.title.toLowerCase().includes(query) ||
				item.repository.fullName.toLowerCase().includes(query) ||
				(item.author?.login.toLowerCase().includes(query) ?? false),
		);
	}

	// Active filters (AND across fields, OR within a field)
	for (const filter of state.activeFilters) {
		if (filter.values.size === 0) continue;
		const def = state.filterDefs.find((d) => d.id === filter.fieldId);
		if (!def) continue;
		result = result.filter((item) => def.match(item, filter.values));
	}

	// Sort
	return [...result].sort(sortFn);
}
