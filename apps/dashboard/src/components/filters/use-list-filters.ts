import { parseAsInteger, parseAsString, useQueryStates } from "nuqs";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	type RememberedView,
	readRememberedView,
	rememberView,
} from "./filter-cookie";
import {
	type ActiveFilter,
	type FilterDefinition,
	type FilterOperator,
	parseFilterString,
	type SortOption,
	serializeFilters,
	withOperator,
	withoutField,
	withValueToggled,
} from "./filter-model";

export const listViewParsers = {
	q: parseAsString
		.withDefault("")
		.withOptions({ history: "replace", throttleMs: 150 }),
	filters: parseAsString.withOptions({ history: "push" }),
	sort: parseAsString.withOptions({ history: "push" }),
	page: parseAsInteger.withDefault(1).withOptions({ history: "push" }),
};

type Restoration = { kind: "none" } | { kind: "pending"; view: RememberedView };

function initialRestoration(
	listId: string,
	params: { filters: string | null; sort: string | null; q: string },
): Restoration {
	if (params.filters || params.sort || params.q) return { kind: "none" };
	if (typeof document === "undefined") return { kind: "none" };
	const view = readRememberedView(listId);
	return view ? { kind: "pending", view } : { kind: "none" };
}

/**
 * One list's search, filters and sort. The URL is the source of truth; the
 * filter cookie only remembers the last filters and sort per list, restored
 * when the list is opened without any.
 */
export function useListFilters({
	listId,
	filterDefs,
	sortOptions,
	defaultSortId,
}: {
	listId: string;
	filterDefs: FilterDefinition[];
	sortOptions: SortOption[];
	defaultSortId: string;
}) {
	const [params, setParams] = useQueryStates(listViewParsers);
	const [restoration, setRestoration] = useState<Restoration>(() =>
		initialRestoration(listId, params),
	);

	useEffect(() => {
		if (restoration.kind !== "pending") return;
		void setParams(
			{
				filters: restoration.view.filters ?? null,
				sort: restoration.view.sort ?? null,
			},
			{ history: "replace" },
		);
		setRestoration({ kind: "none" });
	}, [restoration, setParams]);

	const rawFilters =
		restoration.kind === "pending"
			? (restoration.view.filters ?? null)
			: params.filters;
	const rawSort =
		restoration.kind === "pending"
			? (restoration.view.sort ?? null)
			: params.sort;

	const knownFieldIds = useMemo(
		() => new Set(filterDefs.map((def) => def.id)),
		[filterDefs],
	);
	const activeFilters = useMemo(
		() =>
			parseFilterString(rawFilters).filter((filter) =>
				knownFieldIds.has(filter.fieldId),
			),
		[rawFilters, knownFieldIds],
	);
	const sortId =
		rawSort && sortOptions.some((option) => option.id === rawSort)
			? rawSort
			: defaultSortId;

	const commitFilters = useCallback(
		(next: ActiveFilter[]) => {
			const filters = serializeFilters(next);
			void setParams({ filters, page: null });
			rememberView(listId, {
				filters: filters ?? undefined,
				sort: rawSort ?? undefined,
			});
		},
		[listId, rawSort, setParams],
	);

	const setSortId = useCallback(
		(next: string) => {
			const sort = next === defaultSortId ? null : next;
			void setParams({ sort, page: null });
			rememberView(listId, {
				filters: rawFilters ?? undefined,
				sort: sort ?? undefined,
			});
		},
		[listId, defaultSortId, rawFilters, setParams],
	);

	const setSearchQuery = useCallback(
		(q: string) => {
			void setParams({ q: q || null, page: null });
		},
		[setParams],
	);

	const toggleValue = useCallback(
		(fieldId: string, value: string) =>
			commitFilters(withValueToggled(activeFilters, fieldId, value)),
		[activeFilters, commitFilters],
	);
	const setOperator = useCallback(
		(fieldId: string, operator: FilterOperator) =>
			commitFilters(withOperator(activeFilters, fieldId, operator)),
		[activeFilters, commitFilters],
	);
	const removeFilter = useCallback(
		(fieldId: string) => commitFilters(withoutField(activeFilters, fieldId)),
		[activeFilters, commitFilters],
	);
	const clearAllFilters = useCallback(() => {
		void setParams({ filters: null, page: null });
		rememberView(listId, { sort: rawSort ?? undefined });
	}, [listId, rawSort, setParams]);

	const setPage = useCallback(
		(page: number) => {
			void setParams({ page: page <= 1 ? null : page });
		},
		[setParams],
	);

	return {
		listId,
		searchQuery: params.q,
		setSearchQuery,
		activeFilters,
		toggleValue,
		setOperator,
		removeFilter,
		clearAllFilters,
		sortId,
		setSortId,
		filterDefs,
		sortOptions,
		page: params.page,
		setPage,
	};
}

export type ListFilterState = ReturnType<typeof useListFilters>;
