import type { ComponentType, ReactNode } from "react";

export type FilterOperator = "is" | "is-not";

export type ActiveFilter = {
	fieldId: string;
	operator: FilterOperator;
	values: Set<string>;
};

export type FilterOption = {
	value: string;
	label: string;
	icon?: ReactNode;
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
	number?: number;
	headRefName?: string | null;
	[key: string]: unknown;
};

export type FilterDefinition = {
	id: string;
	label: string;
	icon: ComponentType<{ size?: number; strokeWidth?: number }>;
	extractOptions: (items: FilterableItem[]) => FilterOption[];
	match: (item: FilterableItem, values: Set<string>) => boolean;
	/** False when the field is sent to the GitHub API, which has no "is not". */
	negatable?: boolean;
};

export type SortOption = {
	id: string;
	label: string;
	compare: (a: FilterableItem, b: FilterableItem) => number;
};

const ESCAPES: Record<string, string> = {
	"%": "%25",
	",": "%2C",
	"|": "%7C",
	":": "%3A",
	"!": "%21",
};

function escapeValue(value: string) {
	return value.replace(/[%,|:!]/g, (char) => ESCAPES[char] ?? char);
}

function unescapeValue(value: string) {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

/** `status:open,draft|author!:nova` — `!:` is "is not"; values are escaped. */
export function parseFilterString(raw: string | null): ActiveFilter[] {
	if (!raw) return [];
	const filters: ActiveFilter[] = [];
	for (const segment of raw.split("|")) {
		const colon = segment.indexOf(":");
		if (colon <= 0) continue;
		const negated = segment[colon - 1] === "!";
		const fieldId = segment.slice(0, negated ? colon - 1 : colon);
		const values = segment
			.slice(colon + 1)
			.split(",")
			.filter(Boolean)
			.map(unescapeValue);
		if (!fieldId || values.length === 0) continue;
		if (filters.some((filter) => filter.fieldId === fieldId)) continue;
		filters.push({
			fieldId,
			operator: negated ? "is-not" : "is",
			values: new Set(values),
		});
	}
	return filters;
}

export function serializeFilters(filters: ActiveFilter[]): string | null {
	const segments = filters
		.filter((filter) => filter.values.size > 0)
		.map((filter) => {
			const marker = filter.operator === "is-not" ? "!:" : ":";
			const values = [...filter.values].map(escapeValue).join(",");
			return `${filter.fieldId}${marker}${values}`;
		});
	return segments.length > 0 ? segments.join("|") : null;
}

export function withValueToggled(
	filters: ActiveFilter[],
	fieldId: string,
	value: string,
): ActiveFilter[] {
	const existing = filters.find((filter) => filter.fieldId === fieldId);
	if (!existing) {
		return [...filters, { fieldId, operator: "is", values: new Set([value]) }];
	}
	const values = new Set(existing.values);
	if (values.has(value)) values.delete(value);
	else values.add(value);
	if (values.size === 0) return withoutField(filters, fieldId);
	return filters.map((filter) =>
		filter.fieldId === fieldId ? { ...filter, values } : filter,
	);
}

export function withoutField(
	filters: ActiveFilter[],
	fieldId: string,
): ActiveFilter[] {
	return filters.filter((filter) => filter.fieldId !== fieldId);
}

export function withOperator(
	filters: ActiveFilter[],
	fieldId: string,
	operator: FilterOperator,
): ActiveFilter[] {
	return filters.map((filter) =>
		filter.fieldId === fieldId ? { ...filter, operator } : filter,
	);
}

/** "Author is nova", "Label is any of bug, docs", "Status is not merged". */
export function operatorLabel(filter: ActiveFilter) {
	const many = filter.values.size > 1;
	if (filter.operator === "is-not") return many ? "is none of" : "is not";
	return many ? "is any of" : "is";
}

/** Only the values a field is positively filtered to, as the GitHub API takes them. */
export function apiFilterValues(
	filters: ActiveFilter[],
	fieldId: string,
): Set<string> {
	const filter = filters.find((f) => f.fieldId === fieldId);
	return filter?.operator === "is" ? filter.values : new Set();
}

function searchTerms(item: FilterableItem) {
	const terms = [item.title, item.repository.fullName];
	if (item.author) terms.push(item.author.login);
	if (typeof item.number === "number") terms.push(`#${item.number}`);
	if (item.headRefName) terms.push(item.headRefName);
	return terms.map((term) => term.toLowerCase());
}

export function matchesSearch(item: FilterableItem, query: string) {
	const needle = query.trim().toLowerCase();
	if (!needle) return true;
	const terms = searchTerms(item);
	if (/^#?\d+$/.test(needle)) {
		const number = `#${needle.replace("#", "")}`;
		if (terms.includes(number)) return true;
	}
	return terms.some((term) => term.includes(needle));
}

export function matchesFilters(
	item: FilterableItem,
	filters: ActiveFilter[],
	defs: FilterDefinition[],
) {
	return filters.every((filter) => {
		const def = defs.find((d) => d.id === filter.fieldId);
		if (!def || filter.values.size === 0) return true;
		const matched = def.match(item, filter.values);
		return filter.operator === "is" ? matched : !matched;
	});
}

export function applyListView<T extends FilterableItem>(
	items: T[],
	view: {
		searchQuery: string;
		activeFilters: ActiveFilter[];
		filterDefs: FilterDefinition[];
		sortOptions: SortOption[];
		sortId: string;
	},
): T[] {
	const compare =
		view.sortOptions.find((option) => option.id === view.sortId)?.compare ??
		view.sortOptions[0]?.compare;
	const result = items.filter(
		(item) =>
			matchesSearch(item, view.searchQuery) &&
			matchesFilters(item, view.activeFilters, view.filterDefs),
	);
	return compare ? result.sort(compare) : result;
}
