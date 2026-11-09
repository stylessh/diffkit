import {
	PageHeader,
	PageHeaderCrumb,
	PageHeaderTitle,
} from "@diffkit/ui/components/page-header";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Skeleton } from "skullet/react";
import {
	getCheckState,
	getCheckStateColor,
} from "#/components/checks/check-state-icon";
import { DetailPageLayout } from "#/components/details/detail-page";
import { SkeletonSample } from "#/components/shared/skeleton-sample";
import {
	type GitHubQueryScope,
	githubViewerQueryOptions,
	githubWorkflowDefinitionQueryOptions,
	githubWorkflowRunArtifactsQueryOptions,
	githubWorkflowRunJobsQueryOptions,
	githubWorkflowRunQueryOptions,
} from "#/lib/github.query";
import type {
	WorkflowDefinition,
	WorkflowRun,
	WorkflowRunArtifact,
	WorkflowRunJob,
} from "#/lib/github.types";
import { adaptiveRefetchInterval } from "#/lib/github-refetch-policy";
import { useHasMounted } from "#/lib/use-has-mounted";
import { useRegisterTab } from "#/lib/use-register-tab";
import { WorkflowRunArtifacts } from "./workflow-run-artifacts";
import { WorkflowRunGraph } from "./workflow-run-graph";
import { WorkflowRunHeader } from "./workflow-run-header";
import { WorkflowRunSidebar } from "./workflow-run-sidebar";
import { WorkflowRunSummary } from "./workflow-run-summary";
import { SAMPLE_WORKFLOW_JOBS, SAMPLE_WORKFLOW_RUN } from "./workflow-samples";

const routeApi = getRouteApi("/_protected/$owner/$repo/actions/runs/$runId");

export function WorkflowRunPage() {
	const { user } = routeApi.useRouteContext();
	const { owner, repo, runId } = routeApi.useParams();
	const { pr: prNumberFromSearch } = routeApi.useSearch();

	const runIdNum = Number(runId);
	const scope = useMemo(() => ({ userId: user.id }), [user.id]);
	const input = useMemo(
		() => ({ owner, repo, runId: runIdNum }),
		[owner, repo, runIdNum],
	);
	const hasMounted = useHasMounted();

	const runQuery = useQuery({
		...githubWorkflowRunQueryOptions(scope, input),
		enabled: hasMounted,
	});
	const jobsQuery = useQuery({
		...githubWorkflowRunJobsQueryOptions(scope, input),
		enabled: hasMounted,
	});
	const isRunCompleted = runQuery.data?.status === "completed";
	const artifactsQuery = useQuery({
		...githubWorkflowRunArtifactsQueryOptions(scope, input),
		enabled: hasMounted,
		// Artifacts carry no status of their own; follow the run. They settle
		// once the run completes, so stop polling after the terminal window.
		refetchInterval: adaptiveRefetchInterval(() =>
			isRunCompleted ? "settled" : "waiting",
		),
		refetchIntervalInBackground: false,
	});
	useQuery({
		...githubViewerQueryOptions(scope),
		enabled: hasMounted,
	});

	const definitionInput = useMemo(
		() => ({
			owner,
			repo,
			path: runQuery.data?.path ?? "",
			ref: runQuery.data?.headSha ?? "",
		}),
		[owner, repo, runQuery.data?.path, runQuery.data?.headSha],
	);
	const definitionQuery = useQuery({
		...githubWorkflowDefinitionQueryOptions(scope, definitionInput),
		enabled: hasMounted && !!runQuery.data,
	});

	useRegisterTab(
		runQuery.data
			? {
					type: "actions",
					title:
						runQuery.data.displayTitle ||
						runQuery.data.name ||
						`Run #${runQuery.data.runNumber}`,
					number: runQuery.data.runNumber,
					url: `/${owner}/${repo}/actions/runs/${runIdNum}`,
					repo: `${owner}/${repo}`,
					iconColor: getCheckStateColor(getCheckState(runQuery.data)),
					tabId: `actions:${owner}/${repo}/run/${runIdNum}`,
				}
			: null,
	);

	if (runQuery.error) throw runQuery.error;
	const run = runQuery.data;
	const jobs = jobsQuery.data ?? [];
	const artifacts = artifactsQuery.data ?? [];
	const definition = definitionQuery.data ?? null;
	const routeProps = { owner, repo, scope, runId: runIdNum };

	return (
		<DetailPageLayout
			header={
				<PageHeader>
					<PageHeaderCrumb asChild className="max-md:hidden">
						<Link to="/$owner/$repo" params={{ owner, repo }}>
							{owner}/{repo}
						</Link>
					</PageHeaderCrumb>
					<PageHeaderCrumb asChild>
						<Link to="/$owner/$repo/actions" params={{ owner, repo }}>
							Actions
						</Link>
					</PageHeaderCrumb>
					<Skeleton data={run} sample={SAMPLE_WORKFLOW_RUN} className="min-w-0">
						{(run) => (
							<PageHeaderTitle asChild>
								<span title={run.displayTitle}>
									<span className="truncate">{run.displayTitle}</span>
									<span className="tabular-nums text-muted-foreground">
										#{run.runNumber}
									</span>
								</span>
							</PageHeaderTitle>
						)}
					</Skeleton>
				</PageHeader>
			}
			main={
				<Skeleton loading={!run} label="Loading workflow run">
					{run ? (
						<WorkflowRunMain
							{...routeProps}
							run={run}
							jobs={jobs}
							artifacts={artifacts}
							definition={definition}
							isJobsLoading={jobsQuery.isLoading}
							pullRequestNumber={
								prNumberFromSearch ?? run.pullRequests[0]?.number ?? null
							}
						/>
					) : (
						<SkeletonSample>
							<WorkflowRunMain
								{...routeProps}
								run={SAMPLE_WORKFLOW_RUN}
								jobs={SAMPLE_WORKFLOW_JOBS}
								artifacts={[]}
								definition={null}
								isJobsLoading={false}
								pullRequestNumber={null}
							/>
						</SkeletonSample>
					)}
				</Skeleton>
			}
			sidebar={
				<WorkflowRunSidebar
					jobs={jobs}
					isJobsLoading={!run || jobsQuery.isLoading}
					owner={owner}
					repo={repo}
					runId={runIdNum}
				/>
			}
		/>
	);
}

function WorkflowRunMain({
	owner,
	repo,
	scope,
	runId,
	run,
	jobs,
	artifacts,
	definition,
	isJobsLoading,
	pullRequestNumber,
}: {
	owner: string;
	repo: string;
	scope: GitHubQueryScope;
	runId: number;
	run: WorkflowRun;
	jobs: WorkflowRunJob[];
	artifacts: WorkflowRunArtifact[];
	definition: WorkflowDefinition | null;
	isJobsLoading: boolean;
	pullRequestNumber: number | null;
}) {
	return (
		<div className="flex flex-col gap-8">
			<WorkflowRunHeader
				owner={owner}
				repo={repo}
				run={run}
				pullRequestNumber={pullRequestNumber}
				scope={scope}
			/>
			<WorkflowRunSummary
				run={run}
				jobs={jobs}
				artifacts={artifacts}
				isJobsLoading={isJobsLoading}
			/>
			<WorkflowRunGraph
				run={run}
				jobs={jobs}
				definition={definition}
				scope={scope}
				owner={owner}
				repo={repo}
				runId={runId}
			/>
			<WorkflowRunArtifacts artifacts={artifacts} />
		</div>
	);
}
