import {
	ChevronDownIcon,
	FilterIcon,
	LockIcon,
	ViewIcon,
} from "@diffkit/icons";
import { Button } from "@diffkit/ui/components/button";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryState } from "nuqs";
import { createElement, useEffect, useMemo, useRef } from "react";
import {
	type FilterableItem,
	FilterBar,
	type FilterDefinition,
	getFilterCookie,
	type SortOption,
	useListFilters,
} from "#/components/filters";
import { DashboardContentLoading } from "#/components/layouts/dashboard-content-loading";
import { RepositoryRow } from "#/components/repo/repository-row";
import { ListEmpty, ListPage } from "#/components/shared/list-page";
import {
	githubReposHubQueryOptions,
	githubUserReposQueryOptions,
} from "#/lib/github.query";
import type { UserRepoSummary } from "#/lib/github.types";
import {
	REPO_LIST_PAGE_SIZE,
	repoListHasNextPage,
	repoListPageQueryParser,
	safeRepoListPage,
} from "#/lib/repo-list-page";
import { buildReposHubPrefetchInput } from "#/lib/repos-hub-filter";
import { buildSeo, formatPageTitle } from "#/lib/seo";
import { useDebouncedValue } from "#/lib/use-debounced-value";

export const Route = createFileRoute("/_protected/repos")({
	ssr: false,
	validateSearch: (raw: Record<string, unknown>): { page?: number } => {
		const pageRaw = raw.page;
		if (
			typeof pageRaw === "number" &&
			Number.isFinite(pageRaw) &&
			pageRaw > 0
		) {
			return { page: Math.floor(pageRaw) };
		}
		if (typeof pageRaw === "string" && pageRaw.length > 0) {
			const n = Number.parseInt(pageRaw, 10);
			if (Number.isFinite(n) && n > 0) return { page: n };
		}
		return {};
	},
	loader: async ({ context, location }) => {
		const scope = { userId: context.user.id };
		const filterStore = await getFilterCookie();
		const search = location.search as { page?: number };
		const urlPage =
			typeof search.page === "number" && search.page > 0 ? search.page : 1;
		const hubPrefetchInput = buildReposHubPrefetchInput(filterStore, urlPage);
		await context.queryClient.prefetchQuery(
			githubReposHubQueryOptions(scope, hubPrefetchInput),
		);
		await context.queryClient.prefetchQuery(githubUserReposQueryOptions(scope));
		return { filterStore };
	},
	pendingComponent: DashboardContentLoading,
	head: ({ match }) =>
		buildSeo({
			path: match.pathname,
			title: formatPageTitle("Repositories"),
			description: "Your GitHub repositories in Diffkit.",
			robots: "noindex",
		}),
	component: RepositoriesPage,
});

type RepositoryFilterItem = FilterableItem & {
	repo: UserRepoSummary;
	isPrivate: boolean;
};

const repositoryFilterDefs: FilterDefinition[] = [
	{
		id: "visibility",
		label: "Visibility",
		icon: FilterIcon,
		extractOptions: () => [
			{
				value: "public",
				label: "Public",
				icon: createElement(ViewIcon, {
					size: 14,
					className: "text-muted-foreground",
				}),
			},
			{
				value: "private",
				label: "Private",
				icon: createElement(LockIcon, {
					size: 14,
					className: "text-muted-foreground",
				}),
			},
		],
		match: (item, values) =>
			values.has(asRepo(item).isPrivate ? "private" : "public"),
	},
];

const repositorySortOptions: SortOption[] = [
	{
		id: "updated",
		label: "Recently updated",
		compare: (a, b) => getTime(b.updatedAt) - getTime(a.updatedAt),
	},
	{
		id: "created",
		label: "Newest first",
		compare: (a, b) => getTime(b.createdAt) - getTime(a.createdAt),
	},
	{
		id: "created-asc",
		label: "Oldest first",
		compare: (a, b) => getTime(a.createdAt) - getTime(b.createdAt),
	},
	{
		id: "title",
		label: "Title A-Z",
		compare: (a, b) => a.title.localeCompare(b.title),
	},
];

const EMPTY_REPO_ITEMS: RepositoryFilterItem[] = [];

function RepositoriesPage() {
	const { filterStore } = Route.useLoaderData();
	const { user } = Route.useRouteContext();
	const scope = useMemo(() => ({ userId: user.id }), [user.id]);
	const [page, setPage] = useQueryState("page", repoListPageQueryParser);

	const filterState = useListFilters({
		pageId: "repos",
		items: EMPTY_REPO_ITEMS,
		filterDefs: repositoryFilterDefs,
		sortOptions: repositorySortOptions,
		defaultSortId: "updated",
		initialStore: filterStore,
	});

	const debouncedSearch = useDebouncedValue(filterState.searchQuery, 300);

	const visibilityValues = useMemo(() => {
		const f = filterState.activeFilters.find((x) => x.fieldId === "visibility");
		return f ? [...f.values].sort() : [];
	}, [filterState.activeFilters]);

	const limit = (page ?? 1) * REPO_LIST_PAGE_SIZE;

	const hubInput = useMemo(
		() => ({
			searchQuery: debouncedSearch,
			visibility: visibilityValues,
			sortId: filterState.sortId,
			limit,
		}),
		[debouncedSearch, visibilityValues, filterState.sortId, limit],
	);

	const hubQuery = useQuery({
		...githubReposHubQueryOptions(scope, hubInput),
		placeholderData: keepPreviousData,
	});

	const reposFilterSignature = useMemo(() => {
		const filterParts = filterState.activeFilters
			.map((f) => `${f.fieldId}:${[...f.values].sort().join(",")}`)
			.sort()
			.join("|");
		return `${debouncedSearch}\0${filterState.sortId}\0${filterParts}`;
	}, [debouncedSearch, filterState.sortId, filterState.activeFilters]);

	const prevFilterSignature = useRef(reposFilterSignature);
	useEffect(() => {
		if (prevFilterSignature.current !== reposFilterSignature) {
			prevFilterSignature.current = reposFilterSignature;
			void setPage(null);
		}
	}, [reposFilterSignature, setPage]);

	const matchingCount = hubQuery.data?.matchingCount ?? 0;
	const safePage = safeRepoListPage(page ?? 1, matchingCount);

	useEffect(() => {
		if (!hubQuery.isSuccess || hubQuery.data === undefined) return;
		const safe = safeRepoListPage(page ?? 1, hubQuery.data.matchingCount);
		if ((page ?? 1) !== safe) {
			void setPage(safe === 1 ? null : safe);
		}
	}, [hubQuery.isSuccess, hubQuery.data, page, setPage]);

	if (hubQuery.error) throw hubQuery.error;

	if (!hubQuery.data && hubQuery.isPending) {
		return <DashboardContentLoading />;
	}

	const hub = hubQuery.data;
	const totals = hub?.totals ?? { all: 0, public: 0, private: 0 };
	const displayedRepos = hub?.repos ?? [];

	return (
		<ListPage
			title="Repositories"
			count={totals.all}
			className="overflow-stable"
			actions={
				<span className="hidden items-center gap-3 pr-2 text-xs tabular-nums sm:flex">
					<span className="flex items-center gap-1.5">
						<ViewIcon size={13} strokeWidth={2} />
						{totals.public} public
					</span>
					<span className="flex items-center gap-1.5">
						<LockIcon size={13} strokeWidth={2} />
						{totals.private} private
					</span>
				</span>
			}
			toolbar={
				<FilterBar state={filterState} searchPlaceholder="Search by title…" />
			}
		>
			{totals.all === 0 ? (
				<ListEmpty>No repositories found.</ListEmpty>
			) : matchingCount === 0 ? (
				<ListEmpty>No repositories match these filters.</ListEmpty>
			) : (
				<>
					<div className="flex flex-col">
						{displayedRepos.map((repo) => (
							<div
								key={repo.id}
								style={{
									contentVisibility: "auto",
									containIntrinsicSize: "auto 72px",
								}}
							>
								<RepositoryRow repo={repo} scope={scope} />
							</div>
						))}
					</div>
					{repoListHasNextPage(safePage, matchingCount) ? (
						<div className="flex justify-center pt-4">
							<Button
								type="button"
								variant="pill"
								size="sm"
								onClick={() => {
									void setPage(safePage + 1);
								}}
								iconLeft={<ChevronDownIcon size={14} strokeWidth={2} />}
							>
								Load more
							</Button>
						</div>
					) : null}
				</>
			)}
		</ListPage>
	);
}

function asRepo(item: FilterableItem) {
	return item as RepositoryFilterItem;
}

function getTime(value: unknown) {
	return typeof value === "string" ? Date.parse(value) || 0 : 0;
}
