import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
	apiFilterValues,
	applyListView,
	deriveWorkflowRunApiStatus,
	type FilterableItem,
	ListToolbar,
	makeBranchFilterDef,
	repoWorkflowRunFilterDefs,
	useListFilters,
	workflowRunSortOptions,
} from "#/components/filters";
import { DashboardContentLoading } from "#/components/layouts/dashboard-content-loading";
import { SidePanelPortal } from "#/components/layouts/dashboard-side-panel";
import { Pagination } from "#/components/pagination";
import { RepoActivityCards } from "#/components/repo/repo-activity-cards";
import { RepoPageHeader } from "#/components/repo/repo-page-header";
import { WorkflowRunRow } from "#/components/workflows/workflow-run-row";
import {
	githubRepoBranchesQueryOptions,
	githubRepoOverviewQueryOptions,
	githubViewerQueryOptions,
	githubWorkflowRunsFromRepoQueryOptions,
} from "#/lib/github.query";
import type { WorkflowRun } from "#/lib/github.types";
import { buildSeo, formatPageTitle } from "#/lib/seo";
import { useHasMounted } from "#/lib/use-has-mounted";

const PER_PAGE = 30;

export const Route = createFileRoute("/_protected/$owner/$repo/actions/")({
	ssr: false,
	loader: ({ context, params }) => {
		const scope = { userId: context.user.id };
		// Prefetch first-page runs (no filters) and supporting data so the
		// list paints from the server-side cache instantly. The component
		// will refetch with URL-derived filters if those differ.
		void context.queryClient.prefetchQuery(
			githubWorkflowRunsFromRepoQueryOptions(scope, {
				owner: params.owner,
				repo: params.repo,
				page: 1,
				perPage: 30,
			}),
		);
		void context.queryClient.prefetchQuery(
			githubRepoOverviewQueryOptions(scope, {
				owner: params.owner,
				repo: params.repo,
			}),
		);
		void context.queryClient.prefetchQuery(
			githubRepoBranchesQueryOptions(scope, {
				owner: params.owner,
				repo: params.repo,
			}),
		);
		void context.queryClient.prefetchQuery(githubViewerQueryOptions(scope));
	},
	head: ({ match, params }) =>
		buildSeo({
			path: match.pathname,
			title: formatPageTitle(`Actions · ${params.owner}/${params.repo}`),
			description: `Workflow runs for ${params.owner}/${params.repo}.`,
			robots: "noindex",
		}),
	component: RepoActionsPage,
});

type RunFilterable = FilterableItem & {
	status: string;
	conclusion: string | null;
	event: string;
	headBranch: string | null;
	run: WorkflowRun;
};

function toFilterable(run: WorkflowRun, ownerRepo: string): RunFilterable {
	return {
		id: run.id,
		title: run.displayTitle,
		updatedAt: run.updatedAt,
		createdAt: run.createdAt,
		comments: 0,
		author: run.actor
			? { login: run.actor.login, avatarUrl: run.actor.avatarUrl }
			: null,
		repository: { fullName: ownerRepo },
		state: run.status,
		status: run.status,
		conclusion: run.conclusion,
		event: run.event,
		headBranch: run.headBranch,
		run,
	};
}

function RepoActionsPage() {
	const { user } = Route.useRouteContext();
	const { owner, repo } = Route.useParams();
	const scope = useMemo(() => ({ userId: user.id }), [user.id]);
	const hasMounted = useHasMounted();
	const ownerRepo = `${owner}/${repo}`;

	const overviewQuery = useQuery({
		...githubRepoOverviewQueryOptions(scope, { owner, repo }),
		enabled: hasMounted,
	});

	const branchesQuery = useQuery({
		...githubRepoBranchesQueryOptions(scope, { owner, repo }),
		enabled: hasMounted,
	});

	const filterDefs = useMemo(() => {
		const branchNames = branchesQuery.data?.map((b) => b.name) ?? [];
		return [...repoWorkflowRunFilterDefs, makeBranchFilterDef(branchNames)];
	}, [branchesQuery.data]);

	const filterState = useListFilters({
		listId: "repo-actions",
		filterDefs,
		sortOptions: workflowRunSortOptions,
		defaultSortId: "updated",
	});
	const singleApiValue = (fieldId: string) => {
		const values = apiFilterValues(filterState.activeFilters, fieldId);
		return values.size === 1 ? [...values][0] : undefined;
	};
	const apiStatus = deriveWorkflowRunApiStatus(
		apiFilterValues(filterState.activeFilters, "status"),
	);
	const apiEvent = singleApiValue("event");
	const apiActor = singleApiValue("author");
	const apiBranch = singleApiValue("branch");

	const runsQueryInput = useMemo(
		() => ({
			owner,
			repo,
			page: filterState.page,
			perPage: PER_PAGE,
			status: apiStatus,
			event: apiEvent,
			actor: apiActor,
			branch: apiBranch,
		}),
		[owner, repo, filterState.page, apiStatus, apiEvent, apiActor, apiBranch],
	);

	const query = useQuery({
		...githubWorkflowRunsFromRepoQueryOptions(scope, runsQueryInput),
		enabled: hasMounted,
		placeholderData: keepPreviousData,
	});

	const runs = useMemo(() => query.data ?? [], [query.data]);
	const filterableRuns = useMemo(
		() => runs.map((r) => toFilterable(r, ownerRepo)),
		[runs, ownerRepo],
	);
	const hasNextPage = runs.length === PER_PAGE;

	const filtered = useMemo(
		() => applyListView(filterableRuns, filterState),
		[filterableRuns, filterState],
	);

	const repoData = overviewQuery.data;

	return (
		<>
			<RepoPageHeader
				owner={owner}
				repo={repo}
				scope={scope}
				active="actions"
				searchQuery={filterState.searchQuery}
				toolbar={
					<ListToolbar
						state={filterState}
						items={filterableRuns}
						searchPlaceholder="Search workflow runs…"
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
								No workflow runs found.
							</p>
						)}
						{filtered.map((item) => (
							<div
								key={item.run.id}
								style={{
									contentVisibility: "auto",
									containIntrinsicSize: "auto 56px",
								}}
							>
								<WorkflowRunRow run={item.run} owner={owner} repo={repo} />
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
