import { ExternalLinkIcon, RefreshCwIcon, XIcon } from "@diffkit/icons";
import { Spinner } from "@diffkit/ui/components/spinner";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	Handle,
	type Node,
	type NodeProps,
	NodeResizeControl,
	Position,
} from "@xyflow/react";
import { useMemo, useState } from "react";
import {
	CheckStateIcon,
	getCheckState,
} from "#/components/checks/check-state-icon";
import { githubWorkflowJobLogsQueryOptions } from "#/lib/github.query";
import { getStepHashId } from "../step-hash";
import { useManualRefresh } from "../use-manual-refresh";
import {
	NODE_HANDLE_CLASS,
	STEP_LOG_HEIGHT,
	STEP_LOG_WIDTH,
} from "./constants";
import { useGraphConfig } from "./graph-config-context";
import { useIsNodeHovered } from "./hover-context";
import {
	countEntryLines,
	extractStepLog,
	type LogEntry,
} from "./parse-step-log";
import { StepLogContent, stepLogFetchStatus } from "./step-log-content";
import { getStepLogNodeId, useStepLogActions } from "./step-log-context";
import type { StepLogNodeData } from "./types";

export function StepLogNode({
	data,
}: NodeProps<Node<StepLogNodeData, "stepLog">>) {
	const { scope, owner, repo, runId } = useGraphConfig();
	const { close } = useStepLogActions();
	const isJobLive = data.jobStatus !== "completed";
	const isStepLive = data.stepStatus !== "completed";

	const logsQuery = useQuery({
		...githubWorkflowJobLogsQueryOptions(scope, {
			owner,
			repo,
			jobId: data.jobId,
		}),
		refetchInterval: isJobLive ? 4000 : false,
	});

	const entries = useMemo<LogEntry[]>(() => {
		const raw = logsQuery.data?.logs;
		if (!raw) return [];
		const parsed = extractStepLog(raw, data.stepName, {
			startedAt: data.stepStartedAt,
			completedAt: data.stepCompletedAt,
		});
		return parsed.entries;
	}, [logsQuery.data, data.stepName, data.stepStartedAt, data.stepCompletedAt]);

	const totalLineCount = useMemo(() => countEntryLines(entries), [entries]);
	const state = getCheckState({
		status: data.stepStatus,
		conclusion: data.stepConclusion,
	});

	const nodeId = getStepLogNodeId(data.jobId, data.stepNumber);
	const isHovered = useIsNodeHovered(nodeId);
	const { refresh, isRefreshing } = useManualRefresh(logsQuery.refetch);

	const [size, setSize] = useState({
		width: STEP_LOG_WIDTH,
		height: STEP_LOG_HEIGHT,
	});

	return (
		<>
			<Handle
				type="target"
				position={Position.Left}
				className={NODE_HANDLE_CLASS}
			/>
			<div
				className="relative flex cursor-grab flex-col overflow-hidden rounded-xl border-[0.5px] bg-background shadow-md active:cursor-grabbing"
				style={{ width: size.width, height: size.height }}
			>
				<NodeResizeControl
					position="bottom-right"
					minWidth={360}
					minHeight={200}
					onResize={(_e, params) =>
						setSize({ width: params.width, height: params.height })
					}
					style={{
						background: "transparent",
						border: "none",
						width: 16,
						height: 16,
						opacity: isHovered ? 1 : 0,
						transition: "opacity 150ms",
					}}
				>
					<svg
						width="14"
						height="14"
						viewBox="0 0 14 14"
						fill="none"
						className="pointer-events-none absolute right-0.5 bottom-0.5 text-muted-foreground"
						aria-hidden="true"
					>
						<path
							d="M13 5L5 13M13 9L9 13"
							stroke="currentColor"
							strokeWidth="1.5"
							strokeLinecap="round"
						/>
					</svg>
				</NodeResizeControl>
				<div className="flex shrink-0 items-center gap-2 border-b-[0.5px] px-3 py-2">
					<CheckStateIcon state={state} />
					<span className="min-w-0 flex-1 truncate font-medium text-sm">
						{data.stepName}
					</span>
					{isStepLive ? (
						<span className="shrink-0 rounded-full bg-pill-warning px-2 py-0.5 font-medium text-[10px] text-pill-warning-text">
							Live
						</span>
					) : null}
					<Link
						to="/$owner/$repo/actions/runs/$runId/job/$jobId"
						params={{
							owner,
							repo,
							runId: String(runId),
							jobId: String(data.jobId),
						}}
						hash={getStepHashId(data.stepName, data.stepNumber)}
						aria-label="Open job page"
						className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
					>
						<ExternalLinkIcon size={13} strokeWidth={2} />
					</Link>
					<button
						type="button"
						onClick={refresh}
						disabled={isRefreshing}
						className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
						aria-label="Refresh logs"
					>
						{isRefreshing ? (
							<Spinner className="size-3.5" />
						) : (
							<RefreshCwIcon size={13} strokeWidth={2} />
						)}
					</button>
					<button
						type="button"
						onClick={() => close(nodeId)}
						className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
						aria-label="Close logs"
					>
						<XIcon size={13} strokeWidth={2} />
					</button>
				</div>
				<StepLogContent
					entries={entries}
					totalLineCount={totalLineCount}
					fetchStatus={stepLogFetchStatus(logsQuery)}
					isStepLive={isStepLive}
				/>
			</div>
			<Handle
				type="source"
				position={Position.Right}
				className={NODE_HANDLE_CLASS}
			/>
		</>
	);
}
