import {
	FilterIcon,
	FolderLibraryIcon,
	LockIcon,
	ViewIcon,
} from "@diffkit/icons";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { createElement, useMemo } from "react";
import {
	applyFilters,
	type FilterableItem,
	FilterBar,
	type FilterDefinition,
	getFilterCookie,
	type SortOption,
	useListFilters,
} from "#/components/filters";
import { DashboardContentLoading } from "#/components/layouts/dashboard-content-loading";
import { RepositoryCard } from "#/components/repo/repository-card";
import { githubUserReposQueryOptions } from "#/lib/github.query";
import type { UserRepoSummary } from "#/lib/github.types";
import { buildSeo, formatPageTitle } from "#/lib/seo";
import { useHasMounted } from "#/lib/use-has-mounted";

export const Route = createFileRoute("/_protected/repos")({
	ssr: false,
	loader: async ({ context }) => {
		const scope = { userId: context.user.id };
		void context.queryClient.prefetchQuery(githubUserReposQueryOptions(scope));
		const filterStore = await getFilterCookie();
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
		extractOptions: (items) => {
			const hasPublic = items.some((item) => !asRepo(item).isPrivate);
			const hasPrivate = items.some((item) => asRepo(item).isPrivate);
			return [
				hasPublic
					? {
							value: "public",
							label: "Public",
							icon: createElement(ViewIcon, {
								size: 14,
								className: "text-muted-foreground",
							}),
						}
					: null,
				hasPrivate
					? {
							value: "private",
							label: "Private",
							icon: createElement(LockIcon, {
								size: 14,
								className: "text-muted-foreground",
							}),
						}
					: null,
			].filter((option) => option !== null);
		},
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

function RepositoriesPage() {
	const { filterStore } = Route.useLoaderData();
	const { user } = Route.useRouteContext();
	const scope = useMemo(() => ({ userId: user.id }), [user.id]);
	const hasMounted = useHasMounted();
	const reposQuery = useQuery({
		...githubUserReposQueryOptions(scope),
		enabled: hasMounted,
	});

	const filterItems = useMemo(
		() => reposQuery.data?.map(toRepositoryFilterItem) ?? [],
		[reposQuery.data],
	);
	const filterState = useListFilters({
		pageId: "repos",
		items: filterItems,
		filterDefs: repositoryFilterDefs,
		sortOptions: repositorySortOptions,
		defaultSortId: "updated",
		initialStore: filterStore,
	});
	const filteredRepos = useMemo(
		() => applyFilters(filterItems, filterState).map((item) => item.repo),
		[filterItems, filterState],
	);

	if (reposQuery.error) throw reposQuery.error;

	if (!reposQuery.data) {
		return <DashboardContentLoading />;
	}

	const repos = reposQuery.data;
	const publicCount = repos.filter((repo) => !repo.isPrivate).length;
	const privateCount = repos.length - publicCount;

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
							icon={FolderLibraryIcon}
							label="All repositories"
							value={repos.length}
						/>
						<RepositoryMetricCard
							icon={ViewIcon}
							label="Public"
							value={publicCount}
						/>
						<RepositoryMetricCard
							icon={LockIcon}
							label="Private"
							value={privateCount}
						/>
					</div>
				</aside>

				<div className="flex flex-col gap-2">
					<FilterBar state={filterState} searchPlaceholder="Search by title…" />

					{repos.length === 0 ? (
						<div className="rounded-xl bg-surface-1 px-4 py-8 text-center text-sm text-muted-foreground">
							No repositories found.
						</div>
					) : filteredRepos.length === 0 ? (
						<div className="rounded-xl bg-surface-1 px-4 py-8 text-center text-sm text-muted-foreground">
							No repositories match these filters.
						</div>
					) : (
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
							{filteredRepos.map((repo) => (
								<RepositoryCard key={repo.id} repo={repo} />
							))}
						</div>
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

function toRepositoryFilterItem(repo: UserRepoSummary): RepositoryFilterItem {
	return {
		...repo,
		repo,
		title: repo.name,
		updatedAt: repo.updatedAt ?? "",
		createdAt: repo.createdAt ?? "",
		comments: 0,
		author: null,
		repository: { fullName: repo.fullName },
		state: repo.isPrivate ? "private" : "public",
	};
}
