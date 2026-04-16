import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryStates } from "nuqs";
import { useMemo } from "react";
import {
	applyRepoFilters,
	FilterBar,
	getFilterValues,
	issueSortOptions,
	parseFilterString,
	repoIssueFilterDefs,
	repoListUrlParsers,
	useRepoListFilters,
} from "#/components/filters";
import { IssueRow } from "#/components/issues/issue-row";
import { DashboardContentLoading } from "#/components/layouts/dashboard-content-loading";
import { SidePanelPortal } from "#/components/layouts/dashboard-side-panel";
import { Pagination } from "#/components/pagination";
import { RepoActivityCards } from "#/components/repo/repo-activity-cards";
import {
	githubIssuesFromRepoQueryOptions,
	githubRepoOverviewQueryOptions,
} from "#/lib/github.query";
import { buildSeo, formatPageTitle } from "#/lib/seo";
import { useHasMounted } from "#/lib/use-has-mounted";

const PER_PAGE = 30;

export const Route = createFileRoute("/_protected/$owner/$repo/issues/")({
	ssr: false,
	head: ({ match, params }) =>
		buildSeo({
			path: match.pathname,
			title: formatPageTitle(`Issues · ${params.owner}/${params.repo}`),
			description: `Issues for ${params.owner}/${params.repo}.`,
			robots: "noindex",
		}),
	component: RepoIssuesPage,
});

/**
 * Map the status filter pill values to the GitHub API `state` parameter.
 * No status selected → default to "open".
 */
function deriveApiState(statusValues: Set<string>): "open" | "closed" | "all" {
	if (statusValues.size === 0) return "open";
	const hasOpen = statusValues.has("open");
	const hasClosed =
		statusValues.has("completed") || statusValues.has("not_planned");
	if (hasOpen && hasClosed) return "all";
	if (hasClosed) return "closed";
	return "open";
}

function RepoIssuesPage() {
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
		...githubIssuesFromRepoQueryOptions(scope, {
			owner,
			repo,
			state: apiState,
			page: urlParams.page,
			perPage: PER_PAGE,
		}),
		enabled: hasMounted,
		placeholderData: keepPreviousData,
	});

	const issues = useMemo(() => query.data ?? [], [query.data]);
	const hasNextPage = issues.length === PER_PAGE;

	// 3. Full filter hook with loaded items — populates author options
	const filterState = useRepoListFilters({
		filterDefs: repoIssueFilterDefs,
		sortOptions: issueSortOptions,
		defaultSortId: "updated",
		items: issues,
	});

	const filtered = useMemo(
		() => applyRepoFilters(issues, filterState),
		[issues, filterState],
	);

	const totalLabel = overviewQuery.data?.openIssueCount;
	const repoData = overviewQuery.data;

	return (
		<>
			<div className="h-full overflow-auto py-10">
				<div className="mx-auto flex min-h-full max-w-4xl flex-col gap-6 px-3 md:px-6">
					<div className="flex flex-col gap-2">
						<h1 className="text-2xl font-semibold tracking-tight">Issues</h1>
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
									No issues found.
								</p>
							)}
							{filtered.map((issue) => (
								<div
									key={issue.id}
									style={{
										contentVisibility: "auto",
										containIntrinsicSize: "auto 52px",
									}}
								>
									<IssueRow issue={issue} />
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
