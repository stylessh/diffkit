import { parseAsInteger, parseAsString, useQueryStates } from "nuqs";
import { useCallback, useMemo } from "react";
import type {
	ActiveFilter,
	FilterableItem,
	FilterDefinition,
	FilterOption,
	SortOption,
} from "./use-list-filters";

// ── URL parsers ──────────────────────────────────────────────────────────

export const repoListUrlParsers = {
	q: parseAsString
		.withDefault("")
		.withOptions({ history: "replace", throttleMs: 300 }),
	sort: parseAsString.withOptions({ history: "push", throttleMs: 300 }),
	page: parseAsInteger
		.withDefault(1)
		.withOptions({ history: "push", throttleMs: 300 }),
	filters: parseAsString.withOptions({ history: "push", throttleMs: 300 }),
};

// ── Compact filter serialization ─────────────────────────────────────────
// URL format: "state:open,closed|author:user1,user2"

export function parseFilterString(raw: string | null): ActiveFilter[] {
	if (!raw) return [];
	return raw
		.split("|")
		.filter(Boolean)
		.map((segment) => {
			const colonIdx = segment.indexOf(":");
			if (colonIdx === -1) return null;
			const fieldId = segment.slice(0, colonIdx);
			const values = segment
				.slice(colonIdx + 1)
				.split(",")
				.filter(Boolean);
			return values.length > 0 ? { fieldId, values: new Set(values) } : null;
		})
		.filter((f): f is ActiveFilter => f !== null);
}

function serializeFilters(filters: ActiveFilter[]): string | null {
	const valid = filters.filter((f) => f.values.size > 0);
	if (valid.length === 0) return null;
	return valid.map((f) => `${f.fieldId}:${[...f.values].join(",")}`).join("|");
}

// ── Hook ─────────────────────────────────────────────────────────────────

export function useRepoListFilters<T extends FilterableItem>({
	filterDefs,
	sortOptions,
	defaultSortId,
	items,
}: {
	filterDefs: FilterDefinition[];
	sortOptions: SortOption[];
	defaultSortId: string;
	/** Loaded items for the current page (used by extractOptions for data-driven filters like author). */
	items: T[];
}) {
	const [params, setParams] = useQueryStates(repoListUrlParsers);

	const activeFilters = useMemo(
		() => parseFilterString(params.filters),
		[params.filters],
	);

	const sortId =
		sortOptions.some((o) => o.id === params.sort) && params.sort
			? params.sort
			: defaultSortId;

	const availableOptions = useMemo(() => {
		const map = new Map<string, FilterOption[]>();
		for (const def of filterDefs) {
			map.set(def.id, def.extractOptions(items));
		}
		return map;
	}, [items, filterDefs]);

	const setSearchQuery = useCallback(
		(q: string) => {
			void setParams({ q, page: 1 });
		},
		[setParams],
	);

	const setSortId = useCallback(
		(sort: string) => {
			void setParams({ sort, page: 1 });
		},
		[setParams],
	);

	const addFilter = useCallback(
		(fieldId: string, value: string) => {
			const current = parseFilterString(params.filters);
			const existing = current.find((f) => f.fieldId === fieldId);
			let next: ActiveFilter[];
			if (existing) {
				next = current.map((f) =>
					f.fieldId === fieldId
						? { ...f, values: new Set([...f.values, value]) }
						: f,
				);
			} else {
				next = [...current, { fieldId, values: new Set([value]) }];
			}
			void setParams({ filters: serializeFilters(next), page: 1 });
		},
		[params.filters, setParams],
	);

	const removeFilterValue = useCallback(
		(fieldId: string, value: string) => {
			const current = parseFilterString(params.filters);
			const next = current
				.map((f) => {
					if (f.fieldId !== fieldId) return f;
					const values = new Set(f.values);
					values.delete(value);
					return { ...f, values };
				})
				.filter((f) => f.values.size > 0);
			void setParams({ filters: serializeFilters(next), page: 1 });
		},
		[params.filters, setParams],
	);

	const removeFilter = useCallback(
		(fieldId: string) => {
			const current = parseFilterString(params.filters);
			const next = current.filter((f) => f.fieldId !== fieldId);
			void setParams({ filters: serializeFilters(next), page: 1 });
		},
		[params.filters, setParams],
	);

	const clearAllFilters = useCallback(() => {
		void setParams({ q: "", filters: null, page: 1 });
	}, [setParams]);

	const hasActiveFilters = activeFilters.length > 0 || params.q.length > 0;

	const setPage = useCallback(
		(page: number) => {
			void setParams({ page });
		},
		[setParams],
	);

	return {
		// ListFilterState-compatible shape (reuses FilterBar as-is)
		searchQuery: params.q,
		setSearchQuery,
		activeFilters,
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
		// Pagination (repo-list specific)
		page: params.page,
		setPage,
	};
}

// ── Helpers ──────────────────────────────────────────────────────────────

/** Read selected values for a specific filter field. */
export function getFilterValues(
	activeFilters: ActiveFilter[],
	fieldId: string,
): Set<string> {
	return activeFilters.find((f) => f.fieldId === fieldId)?.values ?? new Set();
}

/** Apply client-side filters (search, match, sort) to items from the current page. */
export function applyRepoFilters<T extends FilterableItem>(
	items: T[],
	state: ReturnType<typeof useRepoListFilters<T>>,
): T[] {
	const query = state.searchQuery.toLowerCase().trim();
	const sortFn =
		state.sortOptions.find((s) => s.id === state.sortId)?.compare ??
		state.sortOptions[0].compare;

	let result: T[] = items;

	if (query) {
		result = result.filter(
			(item) =>
				item.title.toLowerCase().includes(query) ||
				item.repository.fullName.toLowerCase().includes(query) ||
				(item.author?.login.toLowerCase().includes(query) ?? false),
		);
	}

	for (const filter of state.activeFilters) {
		if (filter.values.size === 0) continue;
		const def = state.filterDefs.find((d) => d.id === filter.fieldId);
		if (!def) continue;
		result = result.filter((item) => def.match(item, filter.values));
	}

	return [...result].sort(sortFn);
}
