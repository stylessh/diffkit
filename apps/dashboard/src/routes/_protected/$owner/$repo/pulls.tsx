import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
	apiFilterValues,
	applyListView,
	ListToolbar,
	pullSortOptions,
	repoPullFilterDefs,
	useListFilters,
} from "#/components/filters";
import { DashboardContentLoading } from "#/components/layouts/dashboard-content-loading";
import { SidePanelPortal } from "#/components/layouts/dashboard-side-panel";
import { Pagination } from "#/components/pagination";
import { StackedPullList } from "#/components/pulls/stack/stacked-pull-list";
import { RepoActivityCards } from "#/components/repo/repo-activity-cards";
import { RepoPageHeader } from "#/components/repo/repo-page-header";
import {
	githubPullsFromRepoQueryOptions,
	githubRepoOverviewQueryOptions,
} from "#/lib/github.query";
import { buildSeo, formatPageTitle } from "#/lib/seo";
import { useHasMounted } from "#/lib/use-has-mounted";

const PER_PAGE = 30;

export const Route = createFileRoute("/_protected/$owner/$repo/pulls")({
	ssr: false,
	head: ({ match, params }) =>
		buildSeo({
			path: match.pathname,
			title: formatPageTitle(`Pull requests · ${params.owner}/${params.repo}`),
			description: `Pull requests for ${params.owner}/${params.repo}.`,
			robots: "noindex",
		}),
	component: RepoPullsPage,
});

function deriveApiState(statusValues: Set<string>): "open" | "closed" | "all" {
	if (statusValues.size === 0) return "open";
	const hasOpen = statusValues.has("open") || statusValues.has("draft");
	const hasClosed = statusValues.has("closed") || statusValues.has("merged");
	if (hasOpen && hasClosed) return "all";
	if (hasClosed) return "closed";
	return "open";
}

function RepoPullsPage() {
	const { user } = Route.useRouteContext();
	const { owner, repo } = Route.useParams();
	const scope = { userId: user.id };
	const hasMounted = useHasMounted();

	const filterState = useListFilters({
		listId: "repo-pulls",
		filterDefs: repoPullFilterDefs,
		sortOptions: pullSortOptions,
		defaultSortId: "updated",
	});
	const apiState = deriveApiState(
		apiFilterValues(filterState.activeFilters, "status"),
	);

	const overviewQuery = useQuery({
		...githubRepoOverviewQueryOptions(scope, { owner, repo }),
		enabled: hasMounted,
	});

	const query = useQuery({
		...githubPullsFromRepoQueryOptions(scope, {
			owner,
			repo,
			state: apiState,
			page: filterState.page,
			perPage: PER_PAGE,
		}),
		enabled: hasMounted,
		placeholderData: keepPreviousData,
	});

	const pulls = useMemo(() => query.data ?? [], [query.data]);
	const hasNextPage = pulls.length === PER_PAGE;

	const filtered = useMemo(
		() => applyListView(pulls, filterState),
		[pulls, filterState],
	);

	const repoData = overviewQuery.data;

	return (
		<>
			<RepoPageHeader
				owner={owner}
				repo={repo}
				scope={scope}
				active="pulls"
				searchQuery={filterState.searchQuery}
				toolbar={
					<ListToolbar
						state={filterState}
						items={pulls}
						searchPlaceholder="Search pull requests…"
					/>
				}
			>
				{query.isLoading ? (
					<div className="flex flex-1 items-center justify-center">
						<DashboardContentLoading />
					</div>
				) : (
					<div className="flex flex-col">
						{filtered.length === 0 && (
							<p className="py-16 text-center text-[13px] text-muted-foreground">
								No pull requests found.
							</p>
						)}
						<StackedPullList pulls={filtered} allPulls={pulls} scope={scope} />
					</div>
				)}

				<Pagination
					page={filterState.page}
					hasNextPage={hasNextPage}
					onPageChange={filterState.setPage}
				/>
			</RepoPageHeader>
			{repoData && (
				<SidePanelPortal>
					<RepoActivityCards
						owner={owner}
						repo={repo}
						scope={scope}
						repoData={repoData}
					/>
				</SidePanelPortal>
			)}
		</>
	);
}
