import { AlertCircleIcon, ClockIcon, PackageIcon } from "@diffkit/icons";
import { Skeleton } from "@diffkit/ui/components/skeleton";
import {
	StatePill,
	type StatePillTone,
} from "@diffkit/ui/components/state-pill";
import { Link } from "@tanstack/react-router";
import type { ComponentType, ReactNode, SVGProps } from "react";
import {
	CheckStateIcon,
	getCheckState,
} from "#/components/checks/check-state-icon";
import { CopyBadge } from "#/components/shared/copy-badge";
import { formatRelativeTime } from "#/lib/format-relative-time";
import type {
	WorkflowRun,
	WorkflowRunArtifact,
	WorkflowRunJob,
} from "#/lib/github.types";
import { useNow } from "#/lib/use-now";

export function WorkflowRunSummary({
	run,
	jobs,
	artifacts,
	isJobsLoading,
}: {
	run: WorkflowRun;
	jobs: WorkflowRunJob[];
	artifacts: WorkflowRunArtifact[];
	isJobsLoading: boolean;
}) {
	const triggerTime = run.runStartedAt ?? run.createdAt;
	const isRunLive = run.status !== "completed";
	const staticDurationMs = isRunLive ? null : getCompletedDurationMs(run, jobs);

	return (
		<div className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-lg bg-surface-1 px-4 py-3 text-sm">
			<div className="flex min-w-0 flex-1 flex-col gap-1">
				<span className="text-xs text-muted-foreground">
					Triggered via {run.event} <RelativeTime dateStr={triggerTime} />
				</span>
				<div className="flex min-w-0 items-center gap-2">
					{run.triggeringActor ? (
						<>
							<img
								src={run.triggeringActor.avatarUrl}
								alt={run.triggeringActor.login}
								className="size-4 shrink-0 rounded-full border border-border"
							/>
							<span className="shrink-0 font-medium">
								{run.triggeringActor.login}
							</span>
						</>
					) : (
						<span className="shrink-0 text-muted-foreground">
							Unknown actor
						</span>
					)}
					{run.pullRequests.length > 0 && run.pullRequests[0] ? (
						<>
							<span className="shrink-0 text-muted-foreground">
								opened #{run.pullRequests[0].number}
							</span>
							<CopyBadge value={run.pullRequests[0].headRef} canTruncate />
						</>
					) : run.headBranch ? (
						<CopyBadge value={run.headBranch} canTruncate />
					) : null}
				</div>
			</div>

			<InfoCell
				label="Status"
				icon={AlertCircleIcon}
				value={<StatusPill run={run} />}
			/>
			<InfoCell
				label="Total duration"
				icon={ClockIcon}
				value={
					isRunLive ? (
						<LiveTotalDuration run={run} />
					) : staticDurationMs == null && isJobsLoading ? (
						<Skeleton className="h-4 w-12" />
					) : (
						formatDuration(staticDurationMs)
					)
				}
			/>
			<InfoCell
				label="Artifacts"
				icon={PackageIcon}
				value={
					artifacts.length > 0 ? (
						<Link
							to="."
							hash="artifacts"
							className="font-medium hover:underline"
						>
							{artifacts.length}
						</Link>
					) : (
						<span className="text-muted-foreground">0</span>
					)
				}
			/>
		</div>
	);
}

function RelativeTime({ dateStr }: { dateStr: string }) {
	const now = useNow();
	return <>{formatRelativeTime(dateStr, now)}</>;
}

function LiveTotalDuration({ run }: { run: WorkflowRun }) {
	const now = useNow();
	const start = run.runStartedAt ?? run.createdAt;
	if (!start) return <>—</>;
	const startMs = new Date(start).getTime();
	if (Number.isNaN(startMs)) return <>—</>;
	return <>{formatDuration(Math.max(0, now - startMs))}</>;
}

type IconComponent = ComponentType<
	SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number }
>;

function InfoCell({
	label,
	icon: Icon,
	value,
}: {
	label: string;
	icon: IconComponent;
	value: ReactNode;
}) {
	return (
		<div className="flex flex-col gap-1">
			<span className="flex items-center gap-1.5 text-xs text-muted-foreground">
				<Icon size={13} strokeWidth={2} />
				{label}
			</span>
			<span className="text-xs font-medium tabular-nums">{value}</span>
		</div>
	);
}

function StatusPill({ run }: { run: WorkflowRun }) {
	const state = getCheckState(run);
	const tone: StatePillTone =
		state === "success" ? "open" : state === "failure" ? "closed" : "muted";
	return (
		<StatePill tone={tone} className="-mx-2">
			<CheckStateIcon state={state} />
			{formatStatus(run)}
		</StatePill>
	);
}

function formatStatus(run: WorkflowRun): string {
	if (run.status === "completed") {
		const c = run.conclusion;
		if (c === "success") return "Success";
		if (c === "failure") return "Failure";
		if (c === "cancelled") return "Cancelled";
		if (c === "skipped") return "Skipped";
		if (c === "timed_out") return "Timed out";
		if (c === "action_required") return "Action required";
		if (c === "neutral") return "Neutral";
		return c ?? "Completed";
	}
	if (run.status === "in_progress") return "In progress";
	if (run.status === "queued") return "Queued";
	if (run.status === "waiting") return "Waiting";
	if (run.status === "pending") return "Pending";
	if (run.status === "requested") return "Requested";
	return run.status;
}

function getCompletedDurationMs(
	run: WorkflowRun,
	jobs: WorkflowRunJob[],
): number | null {
	const start = run.runStartedAt ?? run.createdAt;
	if (!start) return null;
	const startMs = new Date(start).getTime();
	if (Number.isNaN(startMs)) return null;

	const jobEndTimes = jobs
		.map((j) =>
			j.completedAt ? new Date(j.completedAt).getTime() : Number.NaN,
		)
		.filter((t) => !Number.isNaN(t));
	const endMs =
		jobEndTimes.length > 0
			? Math.max(...jobEndTimes)
			: new Date(run.updatedAt).getTime();
	if (Number.isNaN(endMs)) return null;
	return Math.max(0, endMs - startMs);
}

function formatDuration(ms: number | null): string {
	if (ms == null) return "—";
	const totalSeconds = Math.floor(ms / 1000);
	if (totalSeconds < 60) return `${totalSeconds}s`;
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	if (minutes < 60) return `${minutes}m ${seconds}s`;
	const hours = Math.floor(minutes / 60);
	return `${hours}h ${minutes % 60}m`;
}
