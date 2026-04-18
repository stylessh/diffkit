import {
	ArchiveIcon,
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
		<div className="overflow-stable h-full overflow-auto py-10">
			<div className="mx-auto grid max-w-7xl gap-14 px-3 md:px-6 xl:grid-cols-[minmax(15rem,18rem)_minmax(0,1fr)]">
				<aside className="flex h-fit flex-col gap-5 xl:sticky xl:top-0">
					<div className="flex flex-col gap-2">
						<h1 className="text-2xl font-semibold tracking-tight">
							Repositories
						</h1>
						<p className="text-sm text-muted-foreground">
							Browse and filter the repositories you can access.
						</p>
					</div>

					<div className="flex flex-col gap-2">
						<RepositoryMetricCard
							icon={ArchiveIcon}
							label="All repositories"
							value={totals.all}
						/>
						<RepositoryMetricCard
							icon={ViewIcon}
							label="Public"
							value={totals.public}
						/>
						<RepositoryMetricCard
							icon={LockIcon}
							label="Private"
							value={totals.private}
						/>
					</div>
				</aside>

				<div className="flex flex-col gap-2">
					<FilterBar state={filterState} searchPlaceholder="Search by title…" />

					{totals.all === 0 ? (
						<p className="py-12 text-center text-sm text-muted-foreground">
							No repositories found.
						</p>
					) : matchingCount === 0 ? (
						<p className="py-12 text-center text-sm text-muted-foreground">
							No repositories match these filters.
						</p>
					) : (
						<>
							<div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-1">
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
								<Button
									type="button"
									variant="secondary"
									size="sm"
									className="mx-auto mt-6 rounded-full"
									onClick={() => {
										void setPage(safePage + 1);
									}}
								>
									<ChevronDownIcon size={14} strokeWidth={2} />
									Load more
								</Button>
							) : null}
						</>
					)}
				</div>
			</div>
		</div>
	);
}

function RepositoryMetricCard({
	icon: Icon,
	label,
	value,
}: {
	icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
	label: string;
	value: number;
}) {
	return (
		<div className="flex items-center justify-between gap-4 rounded-xl bg-surface-1 px-3.5 py-3">
			<div className="flex min-w-0 items-center gap-2">
				<div className="shrink-0 text-muted-foreground">
					<Icon size={15} strokeWidth={1.9} />
				</div>
				<p className="truncate text-sm font-medium">{label}</p>
			</div>
			<p className="font-semibold tabular-nums leading-tight">{value}</p>
		</div>
	);
}

function asRepo(item: FilterableItem) {
	return item as RepositoryFilterItem;
}

function getTime(value: unknown) {
	return typeof value === "string" ? Date.parse(value) || 0 : 0;
}
