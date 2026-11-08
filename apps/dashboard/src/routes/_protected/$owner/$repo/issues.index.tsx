import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
	apiFilterValues,
	applyListView,
	issueSortOptions,
	ListToolbar,
	repoIssueFilterDefs,
	useListFilters,
} from "#/components/filters";
import { IssueRow } from "#/components/issues/issue-row";
import { DashboardContentLoading } from "#/components/layouts/dashboard-content-loading";
import { SidePanelPortal } from "#/components/layouts/dashboard-side-panel";
import { Pagination } from "#/components/pagination";
import { RepoActivityCards } from "#/components/repo/repo-activity-cards";
import { RepoPageHeader } from "#/components/repo/repo-page-header";
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

	const filterState = useListFilters({
		listId: "repo-issues",
		filterDefs: repoIssueFilterDefs,
		sortOptions: issueSortOptions,
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
		...githubIssuesFromRepoQueryOptions(scope, {
			owner,
			repo,
			state: apiState,
			page: filterState.page,
			perPage: PER_PAGE,
		}),
		enabled: hasMounted,
		placeholderData: keepPreviousData,
	});

	const issues = useMemo(() => query.data ?? [], [query.data]);
	const hasNextPage = issues.length === PER_PAGE;

	const filtered = useMemo(
		() => applyListView(issues, filterState),
		[issues, filterState],
	);

	const repoData = overviewQuery.data;

	return (
		<>
			<RepoPageHeader
				owner={owner}
				repo={repo}
				scope={scope}
				active="issues"
				searchQuery={filterState.searchQuery}
				toolbar={
					<ListToolbar
						state={filterState}
						items={issues}
						searchPlaceholder="Search issues…"
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
								<IssueRow issue={issue} showRepository={false} />
							</div>
						))}
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
