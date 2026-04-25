import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryStates } from "nuqs";
import { useMemo } from "react";
import {
	applyRepoFilters,
	deriveWorkflowRunApiStatus,
	type FilterableItem,
	FilterBar,
	getFilterValues,
	makeBranchFilterDef,
	parseFilterString,
	repoListUrlParsers,
	repoWorkflowRunFilterDefs,
	useRepoListFilters,
	workflowRunSortOptions,
} from "#/components/filters";
import { DashboardContentLoading } from "#/components/layouts/dashboard-content-loading";
import { SidePanelPortal } from "#/components/layouts/dashboard-side-panel";
import { Pagination } from "#/components/pagination";
import { RepoActivityCards } from "#/components/repo/repo-activity-cards";
import { WorkflowRunRow } from "#/components/workflows/workflow-run-row";
import {
	githubQueryKeys,
	githubRepoBranchesQueryOptions,
	githubRepoOverviewQueryOptions,
	githubViewerQueryOptions,
	githubWorkflowRunsFromRepoQueryOptions,
} from "#/lib/github.query";
import type { WorkflowRun } from "#/lib/github.types";
import { githubRevalidationSignalKeys } from "#/lib/github-revalidation";
import { buildSeo, formatPageTitle } from "#/lib/seo";
import { useGitHubSignalStream } from "#/lib/use-github-signal-stream";
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

	const [urlParams] = useQueryStates(repoListUrlParsers);
	const urlFilters = useMemo(
		() => parseFilterString(urlParams.filters),
		[urlParams.filters],
	);
	const statusValues = getFilterValues(urlFilters, "status");
	const apiStatus = deriveWorkflowRunApiStatus(statusValues);
	const eventValues = getFilterValues(urlFilters, "event");
	const apiEvent = eventValues.size === 1 ? [...eventValues][0] : undefined;
	const authorValues = getFilterValues(urlFilters, "author");
	const apiActor = authorValues.size === 1 ? [...authorValues][0] : undefined;
	const branchValues = getFilterValues(urlFilters, "branch");
	const apiBranch = branchValues.size === 1 ? [...branchValues][0] : undefined;

	const overviewQuery = useQuery({
		...githubRepoOverviewQueryOptions(scope, { owner, repo }),
		enabled: hasMounted,
	});

	const branchesQuery = useQuery({
		...githubRepoBranchesQueryOptions(scope, { owner, repo }),
		enabled: hasMounted,
	});

	const runsQueryInput = useMemo(
		() => ({
			owner,
			repo,
			page: urlParams.page,
			perPage: PER_PAGE,
			status: apiStatus,
			event: apiEvent,
			actor: apiActor,
			branch: apiBranch,
		}),
		[owner, repo, urlParams.page, apiStatus, apiEvent, apiActor, apiBranch],
	);

	const query = useQuery({
		...githubWorkflowRunsFromRepoQueryOptions(scope, runsQueryInput),
		enabled: hasMounted,
		placeholderData: keepPreviousData,
	});

	const webhookTargets = useMemo(
		() => [
			{
				queryKey: githubQueryKeys.actions.runsList(scope, runsQueryInput),
				signalKeys: [githubRevalidationSignalKeys.actionsRepo({ owner, repo })],
			},
		],
		[scope, runsQueryInput, owner, repo],
	);
	useGitHubSignalStream(webhookTargets);

	const runs = useMemo(() => query.data ?? [], [query.data]);
	const filterableRuns = useMemo(
		() => runs.map((r) => toFilterable(r, ownerRepo)),
		[runs, ownerRepo],
	);
	const hasNextPage = runs.length === PER_PAGE;

	const filterDefs = useMemo(() => {
		const branchNames = branchesQuery.data?.map((b) => b.name) ?? [];
		return [...repoWorkflowRunFilterDefs, makeBranchFilterDef(branchNames)];
	}, [branchesQuery.data]);

	const filterState = useRepoListFilters({
		filterDefs,
		sortOptions: workflowRunSortOptions,
		defaultSortId: "updated",
		items: filterableRuns,
	});

	const filtered = useMemo(
		() => applyRepoFilters(filterableRuns, filterState),
		[filterableRuns, filterState],
	);

	const repoData = overviewQuery.data;

	return (
		<>
			<div className="h-full overflow-auto py-10">
				<div className="mx-auto flex min-h-full max-w-4xl flex-col gap-6 px-3 md:px-6">
					<div className="flex flex-col gap-2">
						<h1 className="text-2xl font-semibold tracking-tight">Actions</h1>
						<p className="text-sm text-muted-foreground">
							<Link
								to="/$owner/$repo"
								params={{ owner, repo }}
								className="text-muted-foreground underline-offset-2 hover:underline"
							>
								{owner}/{repo}
							</Link>
							<span> · Workflow runs</span>
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
