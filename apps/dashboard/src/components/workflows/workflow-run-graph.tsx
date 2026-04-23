import { Skeleton } from "@diffkit/ui/components/skeleton";
import { lazy, Suspense } from "react";
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

	if (!hasMounted) return <GraphPlaceholder />;

	return (
		<Suspense fallback={<GraphPlaceholder />}>
			<WorkflowRunGraphCanvas
				run={run}
				jobs={jobs}
				definition={definition}
				scope={scope}
				owner={owner}
				repo={repo}
				runId={runId}
			/>
		</Suspense>
	);
}

function GraphPlaceholder() {
	return (
		<div className="rounded-xl border bg-surface-1">
			<div className="flex flex-col gap-2 px-6 pt-5 pb-3">
				<Skeleton className="h-4 w-40" />
				<Skeleton className="h-3 w-24" />
			</div>
			<div className="h-[620px] w-full border-t" />
		</div>
	);
}
