import { ExternalLinkIcon, RefreshCwIcon, XIcon } from "@diffkit/icons";
import { Spinner } from "@diffkit/ui/components/spinner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import {
	githubQueryKeys,
	githubWorkflowJobLogsQueryOptions,
} from "#/lib/github.query";
import { getStepHashId } from "../step-hash";
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
import { StepLogContent } from "./step-log-content";
import { getStepLogNodeId, useStepLogActions } from "./step-log-context";
import type { StepLogNodeData } from "./types";

export function StepLogNode({
	data,
}: NodeProps<Node<StepLogNodeData, "stepLog">>) {
	const { scope, owner, repo, runId } = useGraphConfig();
	const { close } = useStepLogActions();
	const queryClient = useQueryClient();
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
	const notAvailable = logsQuery.data?.notAvailable === true;
	const hasLogs = entries.length > 0;
	const isHovered = useIsNodeHovered(nodeId);

	const handleRefresh = () => {
		void queryClient.invalidateQueries({
			queryKey: githubQueryKeys.actions.workflowJobLogs(scope, {
				owner,
				repo,
				jobId: data.jobId,
			}),
		});
	};

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
				className="relative flex cursor-grab flex-col overflow-hidden rounded-xl border bg-background shadow-md active:cursor-grabbing"
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
				<div className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
					<CheckStateIcon state={state} />
					<span className="min-w-0 flex-1 truncate font-medium text-sm">
						{data.stepName}
					</span>
					{isStepLive ? (
						<span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 font-medium text-[10px] text-amber-600 uppercase tracking-wide dark:text-amber-400">
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
						onClick={handleRefresh}
						disabled={logsQuery.isFetching}
						className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
						aria-label="Refresh logs"
					>
						{logsQuery.isFetching ? (
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
					isLoading={logsQuery.isLoading}
					isError={logsQuery.isError}
					notAvailable={notAvailable}
					hasLogs={hasLogs}
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
