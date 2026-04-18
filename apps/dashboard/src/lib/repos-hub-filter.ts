import type { SerializedFilterStore } from "#/components/filters/filter-cookie";
import { REPO_LIST_PAGE_SIZE } from "#/lib/repo-list-page";
import type { UserRepoSummary } from "./github.types";

const REPOS_FILTER_PAGE_ID = "repos";
const DEFAULT_REPOS_SORT = "updated";
const VALID_REPOS_SORT_IDS = new Set([
	"updated",
	"created",
	"created-asc",
	"title",
]);

/** Matches client hub query key: cookie filters + URL page (for loader prefetch). */
export function buildReposHubPrefetchInput(
	filterStore: SerializedFilterStore,
	urlPage: number,
): ReposHubInput {
	const raw = filterStore[REPOS_FILTER_PAGE_ID];
	const searchQuery =
		raw && typeof raw === "object" && typeof raw.searchQuery === "string"
			? raw.searchQuery
			: "";
	let sortId =
		raw && typeof raw === "object" && typeof raw.sortId === "string"
			? raw.sortId
			: DEFAULT_REPOS_SORT;
	if (!VALID_REPOS_SORT_IDS.has(sortId)) sortId = DEFAULT_REPOS_SORT;

	const visibility: string[] = [];
	if (raw && typeof raw === "object" && Array.isArray(raw.activeFilters)) {
		for (const f of raw.activeFilters) {
			if (
				typeof f === "object" &&
				f !== null &&
				(f as { fieldId?: string }).fieldId === "visibility" &&
				Array.isArray((f as { values: unknown }).values)
			) {
				for (const v of (f as { values: string[] }).values) {
					if (typeof v === "string") visibility.push(v);
				}
			}
		}
	}
	visibility.sort();

	const page =
		Number.isFinite(urlPage) && urlPage > 0
			? Math.min(Math.floor(urlPage), 10_000)
			: 1;

	return {
		searchQuery,
		visibility,
		sortId,
		limit: page * REPO_LIST_PAGE_SIZE,
	};
}

export type ReposHubResult = {
	totals: { all: number; public: number; private: number };
	matchingCount: number;
	repos: UserRepoSummary[];
};

export type ReposHubInput = {
	searchQuery: string;
	/** Selected visibility pill values: `"public"` and/or `"private"`; empty = no visibility filter */
	visibility: string[];
	sortId: string;
	/** Cumulative max rows to return after filter + sort */
	limit: number;
};

function getTime(value: string | null): number {
	return value ? Date.parse(value) || 0 : 0;
}

const sortCompare: Record<
	string,
	(a: UserRepoSummary, b: UserRepoSummary) => number
> = {
	updated: (a, b) => getTime(b.updatedAt) - getTime(a.updatedAt),
	created: (a, b) => getTime(b.createdAt) - getTime(a.createdAt),
	"created-asc": (a, b) => getTime(a.createdAt) - getTime(b.createdAt),
	title: (a, b) => a.name.localeCompare(b.name),
};

export function filterUserRepoSummaries(
	repos: UserRepoSummary[],
	input: Omit<ReposHubInput, "limit">,
): UserRepoSummary[] {
	let result = repos;
	const q = input.searchQuery.toLowerCase().trim();
	if (q) {
		result = result.filter(
			(r) =>
				r.name.toLowerCase().includes(q) ||
				r.fullName.toLowerCase().includes(q) ||
				r.owner.toLowerCase().includes(q) ||
				(r.description?.toLowerCase().includes(q) ?? false),
		);
	}
	if (input.visibility.length > 0) {
		const vis = new Set(input.visibility);
		result = result.filter((r) => vis.has(r.isPrivate ? "private" : "public"));
	}
	const sortFn = sortCompare[input.sortId] ?? sortCompare.updated;
	return [...result].sort(sortFn);
}
