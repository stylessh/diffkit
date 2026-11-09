import { lazy } from "react";
import { Skeleton, SkeletonSuspense } from "skullet/react";
import { useIsSkeletonSample } from "#/components/shared/skeleton-sample";
import type { GitHubQueryScope } from "#/lib/github.query";
import type {
	WorkflowDefinition,
	WorkflowRun,
	WorkflowRunJob,
} from "#/lib/github.types";
import { useHasMounted } from "#/lib/use-has-mounted";

const WorkflowRunGraphCanvas = lazy(() =>
	import("./workflow-run-graph-canvas").then((mod) => ({
		default: mod.WorkflowRunGraphCanvas,
	})),
);

export function WorkflowRunGraph({
	run,
	jobs,
	definition,
	scope,
	owner,
	repo,
	runId,
}: {
	run: WorkflowRun;
	jobs: WorkflowRunJob[];
	definition: WorkflowDefinition | null;
	scope: GitHubQueryScope;
	owner: string;
	repo: string;
	runId: number;
}) {
	const hasMounted = useHasMounted();
	const isSample = useIsSkeletonSample();
	const frame = <GraphFrame run={run} />;

	if (isSample) return frame;
	if (!hasMounted) {
		return (
			<Skeleton loading label="Loading workflow graph">
				{frame}
			</Skeleton>
		);
	}

	return (
		<SkeletonSuspense skeleton={frame} label="Loading workflow graph">
			<WorkflowRunGraphCanvas
				run={run}
				jobs={jobs}
				definition={definition}
				scope={scope}
				owner={owner}
				repo={repo}
				runId={runId}
			/>
		</SkeletonSuspense>
	);
}

function GraphFrame({ run }: { run: WorkflowRun }) {
	const segments = run.path.split("/");
	const workflowFilename = segments[segments.length - 1] || run.path;

	return (
		<div className="relative flex flex-col overflow-hidden rounded-xl border-[0.5px] bg-surface-1">
			<div skullet-ignore="" className="h-[620px] w-full rounded-b-xl" />
			<div className="pointer-events-none absolute top-3 left-3 z-10 flex w-fit flex-col gap-0.5 rounded-lg bg-surface-1 px-4 py-3">
				<h2 className="font-medium text-sm">{workflowFilename}</h2>
				<p className="text-muted-foreground text-xs">on: {run.event}</p>
			</div>
		</div>
	);
}
