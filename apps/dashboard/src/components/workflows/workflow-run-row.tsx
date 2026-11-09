import {
	CalendarIcon,
	ClockIcon,
	GitBranchIcon,
	GitCommitIcon,
	GitPullRequestIcon,
	PlayIcon,
} from "@diffkit/icons";
import { Chip } from "@diffkit/ui/components/chip";
import { cn } from "@diffkit/ui/lib/utils";
import { Link, useRouter } from "@tanstack/react-router";
import { type ComponentType, memo, useEffect, useMemo, useState } from "react";
import {
	CheckStateIcon,
	getCheckState,
} from "#/components/checks/check-state-icon";
import { TagIcon } from "#/components/repo/refs/tag-icon";
import {
	listRowClassName,
	listRowHoverClassName,
	RowAvatar,
	RowNumber,
	RowStateIcon,
	RowTime,
} from "#/components/shared/list-row";
import { formatRelativeTime } from "#/lib/format-relative-time";
import type { WorkflowRun } from "#/lib/github.types";
import { preloadRouteOnce } from "#/lib/route-preload";
import { formatDuration } from "./graph/format";

export const WorkflowRunRow = memo(function WorkflowRunRow({
	run,
	owner,
	repo,
}: {
	run: WorkflowRun;
	owner: string;
	repo: string;
}) {
	const state = getCheckState(run);
	const isLive = state === "pending" || state === "waiting";
	const router = useRouter();

	const linkParams = useMemo(
		() => ({ owner, repo, runId: String(run.id) }),
		[owner, repo, run.id],
	);

	const preloadDetail = () => {
		void preloadRouteOnce(router, `/${owner}/${repo}/actions/runs/${run.id}`);
	};

	const workflowName = useMemo(
		() =>
			run.name ??
			run.path
				.split("/")
				.pop()
				?.replace(/\.ya?ml$/, "") ??
			"Workflow",
		[run.name, run.path],
	);

	const time = formatRelativeTime(run.updatedAt, undefined, {
		compact: true,
	});

	return (
		<Link
			to="/$owner/$repo/actions/runs/$runId"
			params={linkParams}
			preload={false}
			onMouseEnter={preloadDetail}
			onFocus={preloadDetail}
			onTouchStart={preloadDetail}
			aria-label={`${run.displayTitle}, ${workflowName} #${run.runNumber}`}
			className={cn(listRowClassName, listRowHoverClassName)}
		>
			<RowStateIcon>
				<CheckStateIcon state={state} />
			</RowStateIcon>
			<RowNumber number={run.runNumber} />
			<div className="flex min-w-0 flex-1 flex-col gap-1 md:flex-row md:items-center md:gap-2">
				<p
					title={run.displayTitle}
					className="text-[13px] font-medium text-foreground md:truncate"
				>
					{run.displayTitle}
				</p>
				{workflowName !== run.displayTitle ? (
					<span className="shrink-0 text-[13px] font-[450] text-muted-foreground max-md:text-xs">
						{workflowName}
					</span>
				) : null}
			</div>
			<div className="hidden min-w-0 shrink items-center gap-1 md:flex">
				{run.headBranch ? (
					<Chip className="max-w-48 shrink" title={run.headBranch}>
						<GitBranchIcon size={12} strokeWidth={2} />
						<span className="truncate font-mono">{run.headBranch}</span>
					</Chip>
				) : null}
				<EventChip event={run.event} />
				<RunDuration
					startedAt={run.runStartedAt ?? run.createdAt}
					completedAt={isLive ? null : run.updatedAt}
					isLive={isLive}
				/>
			</div>
			<span className="hidden shrink-0 items-center gap-2 md:ml-3 md:flex">
				<RowAvatar actor={run.actor} />
				<RowTime>{time}</RowTime>
			</span>
		</Link>
	);
});

type EventIcon = ComponentType<{ size?: number; strokeWidth?: number }>;

/** What started a run, as GitHub's event names map to something a person reads. */
const EVENTS: Record<string, { label: string; icon: EventIcon }> = {
	pull_request: { label: "Pull request", icon: GitPullRequestIcon },
	pull_request_target: { label: "Pull request", icon: GitPullRequestIcon },
	push: { label: "Push", icon: GitCommitIcon },
	release: { label: "Release", icon: TagIcon },
	schedule: { label: "Schedule", icon: CalendarIcon },
	workflow_dispatch: { label: "Manual", icon: PlayIcon },
};

function EventChip({ event }: { event: string }) {
	const known = EVENTS[event];
	const Icon = known?.icon ?? PlayIcon;
	const label =
		known?.label ??
		event.replace(/_/g, " ").replace(/^./, (first) => first.toUpperCase());
	return (
		<Chip className="shrink-0" title={`Triggered by ${label.toLowerCase()}`}>
			<Icon size={12} strokeWidth={2} />
			{label}
		</Chip>
	);
}

/** How long the run took, or has been running; ticks every second only while live. */
const RunDuration = memo(function RunDuration({
	startedAt,
	completedAt,
	isLive,
}: {
	startedAt: string | null;
	completedAt: string | null;
	isLive: boolean;
}) {
	const [nowTick, setNowTick] = useState(() => Date.now());

	useEffect(() => {
		if (!isLive) return;
		const id = setInterval(() => setNowTick(Date.now()), 1000);
		return () => clearInterval(id);
	}, [isLive]);

	const duration = formatDuration(
		startedAt,
		completedAt,
		isLive ? nowTick : undefined,
	);
	if (!duration) return null;

	return (
		<Chip
			className={cn("shrink-0 tabular-nums", isLive && "text-foreground")}
			title={isLive ? "Running for" : "Took"}
		>
			{isLive ? (
				<span className="flex size-3 items-center justify-center">
					<span className="size-1.5 animate-pulse rounded-full bg-check-running" />
				</span>
			) : (
				<ClockIcon size={12} strokeWidth={2} />
			)}
			{duration}
		</Chip>
	);
});
