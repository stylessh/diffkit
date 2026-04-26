import { ChevronDownIcon, ExternalLinkIcon } from "@diffkit/icons";
import { cn } from "@diffkit/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { useCallback } from "react";
import {
	type CheckState,
	CheckStateIcon,
	getCheckState,
} from "#/components/checks/check-state-icon";
import type { WorkflowRunJob, WorkflowRunStep } from "#/lib/github.types";
import { NODE_CARD_CLASS, NODE_HEADER_CLASS, NODE_WIDTH } from "./constants";
import { useGraphConfig } from "./graph-config-context";
import { JobDuration } from "./job-duration";
import { useStepLogActions } from "./step-log-context";

export function getJobCardRingClass(state: CheckState): string {
	if (state === "success") return "ring-4 ring-muted/80 dark:ring-muted/50";
	if (state === "failure")
		return "border-transparent hover:border-transparent ring-4 ring-red-500/25";
	if (state === "pending" || state === "expected")
		return "border-transparent hover:border-transparent ring-4 ring-amber-500/20";
	return "";
}

export function NodeChevron({ open }: { open: boolean }) {
	return (
		<ChevronDownIcon
			className={cn(
				"size-3.5 shrink-0 text-muted-foreground transition-transform",
				open ? "rotate-0" : "-rotate-90",
			)}
		/>
	);
}

function StepRow({
	step,
	job,
	sourceNodeId,
}: {
	step: WorkflowRunStep;
	job: WorkflowRunJob;
	sourceNodeId: string;
}) {
	const state = getCheckState(step);
	const { open } = useStepLogActions();
	const onClick = useCallback(() => {
		open({
			jobId: job.id,
			jobStatus: job.status,
			stepNumber: step.number,
			stepName: step.name,
			sourceNodeId,
		});
	}, [open, job.id, job.status, step.number, step.name, sourceNodeId]);
	return (
		<button
			type="button"
			onClick={onClick}
			className="flex items-center gap-2 px-3 py-1.5 text-left transition-colors first:pt-2 last:pb-2 hover:bg-muted/40"
		>
			<CheckStateIcon state={state} />
			<span className="min-w-0 flex-1 truncate">{step.name}</span>
		</button>
	);
}

export function JobCard({
	job,
	nodeId,
	displayName,
	expanded,
	onToggle,
}: {
	job: WorkflowRunJob;
	nodeId: string;
	displayName?: string;
	expanded: boolean;
	onToggle?: () => void;
}) {
	const state = getCheckState(job);
	const name = displayName ?? job.name;
	const { owner, repo, runId } = useGraphConfig();
	return (
		<div
			className={cn("group/card", NODE_CARD_CLASS, getJobCardRingClass(state))}
			style={{ width: NODE_WIDTH }}
		>
			<div className="relative flex items-stretch">
				<button
					type="button"
					onClick={onToggle}
					disabled={!onToggle}
					aria-expanded={onToggle ? expanded : undefined}
					aria-controls={onToggle ? `job-steps-${job.id}` : undefined}
					className={cn(NODE_HEADER_CLASS, "flex-1")}
				>
					<CheckStateIcon state={state} />
					<span className="min-w-0 flex-1 truncate font-medium text-sm">
						{name}
					</span>
					<JobDuration
						job={job}
						className="shrink-0 text-muted-foreground text-xs tabular-nums"
					/>
					{onToggle ? <NodeChevron open={expanded} /> : null}
				</button>
				<Link
					to="/$owner/$repo/actions/runs/$runId/job/$jobId"
					params={{
						owner,
						repo,
						runId: String(runId),
						jobId: String(job.id),
					}}
					aria-label={`Open job ${name}`}
					onClick={(e) => e.stopPropagation()}
					className="absolute top-1.5 right-1.5 rounded-md bg-background/80 p-1 text-muted-foreground opacity-0 shadow-sm transition-opacity hover:text-foreground group-hover/card:opacity-100"
				>
					<ExternalLinkIcon size={12} strokeWidth={2} />
				</Link>
			</div>
			{expanded ? (
				<div
					id={`job-steps-${job.id}`}
					className="flex flex-col border-t text-xs"
				>
					{job.steps.length === 0 ? (
						<div className="px-3 py-2 text-muted-foreground">No steps</div>
					) : (
						job.steps.map((step) => (
							<StepRow
								key={step.number}
								step={step}
								job={job}
								sourceNodeId={nodeId}
							/>
						))
					)}
				</div>
			) : null}
		</div>
	);
}
