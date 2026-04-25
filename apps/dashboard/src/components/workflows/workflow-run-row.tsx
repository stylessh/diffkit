import { GitBranchIcon } from "@diffkit/icons";
import { cn } from "@diffkit/ui/lib/utils";
import { Link, useRouter } from "@tanstack/react-router";
import { memo, useEffect, useMemo, useState } from "react";
import {
	CheckStateIcon,
	getCheckState,
} from "#/components/checks/check-state-icon";
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

	return (
		<Link
			to="/$owner/$repo/actions/runs/$runId"
			params={linkParams}
			preload={false}
			onMouseEnter={preloadDetail}
			onFocus={preloadDetail}
			onTouchStart={preloadDetail}
			className="group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-1"
		>
			<div className="mt-[3px] shrink-0">
				<CheckStateIcon state={state} />
			</div>
			<div className="flex min-w-0 flex-1 flex-col gap-1">
				<p className="truncate text-sm font-medium">{run.displayTitle}</p>
				<p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
					<span className="font-medium">{workflowName}</span>
					<span>·</span>
					<span className="tabular-nums">#{run.runNumber}</span>
					{run.headBranch ? (
						<>
							<span>·</span>
							<span className="inline-flex items-center gap-1">
								<GitBranchIcon size={12} strokeWidth={2} />
								<span className="truncate font-mono">{run.headBranch}</span>
							</span>
						</>
					) : null}
					<span>·</span>
					<span>{run.event}</span>
					{run.actor ? (
						<>
							<span>·</span>
							<img
								src={run.actor.avatarUrl}
								alt={run.actor.login}
								className="size-3.5 rounded-full border border-border"
							/>
							<span className="truncate">{run.actor.login}</span>
						</>
					) : null}
					<span>·</span>
					<span>{formatRelativeTime(run.updatedAt)}</span>
				</p>
			</div>
			<RunDuration
				startedAt={run.runStartedAt ?? run.createdAt}
				completedAt={isLive ? null : run.updatedAt}
				isLive={isLive}
			/>
		</Link>
	);
});

/** Renders the duration — subscribes to a 1s tick only when the run is live. */
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
		<div className="mt-[3px] hidden shrink-0 items-center gap-1.5 md:flex">
			{isLive ? (
				<span className="inline-flex size-1.5 animate-pulse rounded-full bg-yellow-500" />
			) : null}
			<span
				className={cn(
					"text-xs tabular-nums text-muted-foreground",
					isLive && "text-foreground",
				)}
			>
				{duration}
			</span>
		</div>
	);
});
