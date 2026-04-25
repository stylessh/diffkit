import { Skeleton } from "@diffkit/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useMemo } from "react";
import {
	getCheckState,
	getCheckStateColor,
} from "#/components/checks/check-state-icon";
import {
	DetailPageLayout,
	DetailPageSkeletonLayout,
	StaggerItem,
} from "#/components/details/detail-page";
import {
	githubQueryKeys,
	githubViewerQueryOptions,
	githubWorkflowDefinitionQueryOptions,
	githubWorkflowRunArtifactsQueryOptions,
	githubWorkflowRunJobsQueryOptions,
	githubWorkflowRunQueryOptions,
} from "#/lib/github.query";
import { githubRevalidationSignalKeys } from "#/lib/github-revalidation";
import { useGitHubSignalStream } from "#/lib/use-github-signal-stream";
import { useHasMounted } from "#/lib/use-has-mounted";
import { useRegisterTab } from "#/lib/use-register-tab";
import { WorkflowRunArtifacts } from "./workflow-run-artifacts";
import { WorkflowRunGraph } from "./workflow-run-graph";
import { WorkflowRunHeader } from "./workflow-run-header";
import { WorkflowRunSidebar } from "./workflow-run-sidebar";
import { WorkflowRunSummary } from "./workflow-run-summary";

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

	const webhookRefreshTargets = useMemo(() => {
		const runSignals = [githubRevalidationSignalKeys.workflowRunEntity(input)];
		return [
			{
				queryKey: githubQueryKeys.actions.workflowRun(scope, input),
				signalKeys: runSignals,
			},
			{
				queryKey: githubQueryKeys.actions.workflowRunJobs(scope, input),
				signalKeys: runSignals,
			},
			{
				queryKey: githubQueryKeys.actions.workflowRunArtifacts(scope, input),
				signalKeys: runSignals,
			},
		];
	}, [scope, input]);
	useGitHubSignalStream(webhookRefreshTargets);

	const runQuery = useQuery({
		...githubWorkflowRunQueryOptions(scope, input),
		enabled: hasMounted,
	});
	const jobsQuery = useQuery({
		...githubWorkflowRunJobsQueryOptions(scope, input),
		enabled: hasMounted,
	});
	const artifactsQuery = useQuery({
		...githubWorkflowRunArtifactsQueryOptions(scope, input),
		enabled: hasMounted,
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
	if (!run) return <WorkflowRunPageSkeleton />;

	const jobs = jobsQuery.data ?? [];
	const artifacts = artifactsQuery.data ?? [];
	const definition = definitionQuery.data ?? null;
	const pullRequestNumber =
		prNumberFromSearch ?? run.pullRequests[0]?.number ?? null;

	return (
		<DetailPageLayout
			main={
				<>
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
						isJobsLoading={jobsQuery.isLoading}
					/>
					<WorkflowRunGraph
						run={run}
						jobs={jobs}
						definition={definition}
						scope={scope}
						owner={owner}
						repo={repo}
						runId={runIdNum}
					/>
					<WorkflowRunArtifacts artifacts={artifacts} />
				</>
			}
			sidebar={
				<WorkflowRunSidebar
					jobs={jobs}
					isJobsLoading={jobsQuery.isLoading}
					owner={owner}
					repo={repo}
					runId={runIdNum}
				/>
			}
		/>
	);
}

function WorkflowRunPageSkeleton() {
	return (
		<DetailPageSkeletonLayout mainItemCount={3}>
			<StaggerItem index={0}>
				<div className="flex flex-col gap-3">
					<Skeleton className="h-3 w-40" />
					<div className="flex items-start gap-3">
						<Skeleton className="mt-1 size-5 rounded-full" />
						<div className="flex min-w-0 flex-1 flex-col gap-2">
							<Skeleton className="h-7 w-3/5" />
							<Skeleton className="h-4 w-40" />
						</div>
					</div>
				</div>
			</StaggerItem>
			<StaggerItem index={1}>
				<div className="rounded-lg bg-surface-1 px-4 py-3">
					<Skeleton className="h-4 w-full" />
				</div>
			</StaggerItem>
			<StaggerItem index={2}>
				<div className="flex h-48 items-center rounded-xl border px-6">
					<Skeleton className="h-12 w-52" />
				</div>
			</StaggerItem>
		</DetailPageSkeletonLayout>
	);
}
