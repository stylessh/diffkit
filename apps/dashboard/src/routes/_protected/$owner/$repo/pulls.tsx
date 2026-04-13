import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryStates } from "nuqs";
import { useMemo } from "react";
import {
	applyRepoFilters,
	FilterBar,
	getFilterValues,
	parseFilterString,
	pullSortOptions,
	repoListUrlParsers,
	repoPullFilterDefs,
	useRepoListFilters,
} from "#/components/filters";
import { DashboardContentLoading } from "#/components/layouts/dashboard-content-loading";
import { Pagination } from "#/components/pagination";
import { PullRequestRow } from "#/components/pulls/pull-request-row";
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

/**
 * Map the status filter pill values to the GitHub API `state` parameter.
 * No status selected → default to "open".
 */
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

	// 1. Read URL params directly — needed before the query
	const [urlParams] = useQueryStates(repoListUrlParsers);
	const urlFilters = useMemo(
		() => parseFilterString(urlParams.filters),
		[urlParams.filters],
	);
	const statusValues = getFilterValues(urlFilters, "status");
	const apiState = deriveApiState(statusValues);

	// 2. Fetch data using URL-derived params
	const overviewQuery = useQuery({
		...githubRepoOverviewQueryOptions(scope, { owner, repo }),
		enabled: hasMounted,
	});

	const query = useQuery({
		...githubPullsFromRepoQueryOptions(scope, {
			owner,
			repo,
			state: apiState,
			page: urlParams.page,
			perPage: PER_PAGE,
		}),
		enabled: hasMounted,
		placeholderData: keepPreviousData,
	});

	const pulls = useMemo(() => query.data ?? [], [query.data]);
	const hasNextPage = pulls.length === PER_PAGE;

	// 3. Full filter hook with loaded items — populates author options
	const filterState = useRepoListFilters({
		filterDefs: repoPullFilterDefs,
		sortOptions: pullSortOptions,
		defaultSortId: "updated",
		items: pulls,
	});

	const filtered = useMemo(
		() => applyRepoFilters(pulls, filterState),
		[pulls, filterState],
	);

	const totalLabel = overviewQuery.data?.openPullCount;

	return (
		<div className="h-full overflow-auto py-10">
			<div className="mx-auto flex min-h-full max-w-4xl flex-col gap-6 px-3 md:px-6">
				<div className="flex flex-col gap-2">
					<h1 className="text-2xl font-semibold tracking-tight">
						Pull Requests
					</h1>
					<p className="text-sm text-muted-foreground">
						{totalLabel != null ? (
							<span className="tabular-nums">{totalLabel} open · </span>
						) : null}
						<Link
							to="/$owner/$repo"
							params={{ owner, repo }}
							className="text-muted-foreground underline-offset-2 hover:underline"
						>
							{owner}/{repo}
						</Link>
					</p>
				</div>

				<FilterBar state={filterState} />

				{query.isLoading ? (
					<div className="flex flex-1 items-center justify-center">
						<DashboardContentLoading />
					</div>
				) : (
					<div className="flex flex-col gap-1">
						{filtered.length === 0 && (
							<p className="py-12 text-center text-sm text-muted-foreground">
								No pull requests found.
							</p>
						)}
						{filtered.map((pr) => (
							<div
								key={pr.id}
								style={{
									contentVisibility: "auto",
									containIntrinsicSize: "auto 52px",
								}}
							>
								<PullRequestRow pr={pr} scope={scope} />
							</div>
						))}
					</div>
				)}

				<Pagination
					page={filterState.page}
					hasNextPage={hasNextPage}
					onPageChange={filterState.setPage}
				/>
			</div>
		</div>
	);
}
