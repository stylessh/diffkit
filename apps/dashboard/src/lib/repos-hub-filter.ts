import { REPO_LIST_PAGE_SIZE } from "#/lib/repo-list-page";
import type { UserRepoSummary } from "./github.types";

const DEFAULT_REPOS_SORT = "updated";
const VALID_REPOS_SORT_IDS = new Set([
	"updated",
	"created",
	"created-asc",
	"title",
]);

/** The hub query input the list will ask for, so the loader can prefetch it. */
export function buildReposHubPrefetchInput(
	view: Omit<ReposHubInput, "limit">,
	urlPage: number,
): ReposHubInput {
	const page =
		Number.isFinite(urlPage) && urlPage > 0
			? Math.min(Math.floor(urlPage), 10_000)
			: 1;
	return {
		searchQuery: view.searchQuery,
		visibility: [...view.visibility].sort(),
		sortId: VALID_REPOS_SORT_IDS.has(view.sortId)
			? view.sortId
			: DEFAULT_REPOS_SORT,
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
