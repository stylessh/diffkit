import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Skeleton } from "skullet/react";
import {
	apiFilterValues,
	applyListView,
	issueSortOptions,
	repoIssueFilterDefs,
	useListFilters,
} from "#/components/filters";
import { IssueBulkSelection } from "#/components/issues/issue-bulk-selection";
import { SAMPLE_ISSUES } from "#/components/issues/issue-list-samples";
import { IssueRow } from "#/components/issues/issue-row";
import { Pagination } from "#/components/pagination";
import { RepoPageHeader } from "#/components/repo/repo-page-header";
import { ListEmpty } from "#/components/shared/list-page";
import { githubIssuesFromRepoQueryOptions } from "#/lib/github.query";
import type { IssueSummary } from "#/lib/github.types";
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
	const showSkeleton = !hasMounted || (query.isPending && !query.data);

	return (
		<RepoPageHeader
			owner={owner}
			repo={repo}
			scope={scope}
			active="issues"
			filters={{
				state: filterState,
				items: issues,
				searchPlaceholder: "Search issues…",
			}}
		>
			<Skeleton loading={showSkeleton} label="Loading issues">
				{showSkeleton ? (
					<IssueList issues={SAMPLE_ISSUES} />
				) : (
					<div className="flex flex-col">
						{filtered.length === 0 ? (
							<ListEmpty>
								{filterState.activeFilters.length > 0 || filterState.searchQuery
									? "No issues match your filters."
									: "No issues yet."}
							</ListEmpty>
						) : null}
						<IssueBulkSelection issues={filtered} scope={scope}>
							<IssueList issues={filtered} />
						</IssueBulkSelection>
					</div>
				)}
			</Skeleton>

			<Pagination
				page={filterState.page}
				hasNextPage={hasNextPage}
				onPageChange={filterState.setPage}
			/>
		</RepoPageHeader>
	);
}

function IssueList({ issues }: { issues: IssueSummary[] }) {
	return (
		<div className="flex flex-col">
			{issues.map((issue) => (
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
	);
}
