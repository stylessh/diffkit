import { parseAsInteger } from "nuqs";

/** Match GitHub’s default repo list page size */
export const REPO_LIST_PAGE_SIZE = 30;

export const repoListPageQueryParser = parseAsInteger
	.withDefault(1)
	.withOptions({ history: "push" });

export function maxRepoListPage(itemCount: number): number {
	return Math.max(1, Math.ceil(itemCount / REPO_LIST_PAGE_SIZE));
}

export function safeRepoListPage(page: number, itemCount: number): number {
	const max = maxRepoListPage(itemCount);
	return Math.min(Math.max(1, page), max);
}

/** Cumulative slice for “Load more”: page 1 → first chunk, page 2 → first two chunks, etc. */
export function sliceReposForPage<T>(items: T[], page: number): T[] {
	const safe = safeRepoListPage(page, items.length);
	const end = Math.min(items.length, safe * REPO_LIST_PAGE_SIZE);
	return items.slice(0, end);
}

export function repoListHasNextPage(page: number, itemCount: number): boolean {
	const safe = safeRepoListPage(page, itemCount);
	return safe * REPO_LIST_PAGE_SIZE < itemCount;
}
