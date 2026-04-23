import {
	ChevronDownIcon,
	ChevronRightIcon,
	ExternalLinkIcon,
	RefreshCwIcon,
	XIcon,
} from "@diffkit/icons";
import { Spinner } from "@diffkit/ui/components/spinner";
import { cn } from "@diffkit/ui/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Handle,
	type Node,
	type NodeProps,
	NodeResizeControl,
	Position,
} from "@xyflow/react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	CheckStateIcon,
	getCheckState,
} from "#/components/checks/check-state-icon";
import {
	githubQueryKeys,
	githubWorkflowJobLogsQueryOptions,
} from "#/lib/github.query";
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
					<a
						href={`/${owner}/${repo}/actions/runs/${runId}/jobs/${data.jobId}`}
						aria-label="Open job page"
						className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
					>
						<ExternalLinkIcon size={13} strokeWidth={2} />
					</a>
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
				<LogBody
					entries={entries}
					totalLineCount={totalLineCount}
					isLoading={logsQuery.isLoading}
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

function LogBody({
	entries,
	totalLineCount,
	isLoading,
	notAvailable,
	hasLogs,
	isStepLive,
}: {
	entries: LogEntry[];
	totalLineCount: number;
	isLoading: boolean;
	notAvailable: boolean;
	hasLogs: boolean;
	isStepLive: boolean;
}) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

	const toggleGroup = useCallback((id: string) => {
		setCollapsed((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: intentionally re-scrolls when line count changes
	useEffect(() => {
		if (!isStepLive) return;
		const el = scrollRef.current;
		if (!el) return;
		el.scrollTop = el.scrollHeight;
	}, [isStepLive, totalLineCount]);

	const lineNoWidth = useMemo(
		() => `${Math.max(2, String(totalLineCount).length)}ch`,
		[totalLineCount],
	);

	if (isLoading && !hasLogs) {
		return (
			<div className="flex flex-1 items-center justify-center text-muted-foreground text-xs">
				<Spinner className="mr-2 size-3.5" />
				Loading logs…
			</div>
		);
	}

	if (notAvailable) {
		return (
			<div className="flex flex-1 items-center justify-center px-4 text-center text-muted-foreground text-xs">
				Logs are not available yet. They become available once the job starts or
				after completion.
			</div>
		);
	}

	if (!hasLogs) {
		return (
			<div className="flex flex-1 items-center justify-center px-4 text-center text-muted-foreground text-xs">
				No log output for this step yet.
			</div>
		);
	}

	const counter = { value: 0 };
	return (
		<div
			ref={scrollRef}
			className="nowheel flex-1 overflow-auto bg-background px-3 py-2 font-mono text-[11px] leading-5"
		>
			<EntryList
				entries={entries}
				depth={0}
				counter={counter}
				collapsed={collapsed}
				onToggle={toggleGroup}
				lineNoWidth={lineNoWidth}
			/>
		</div>
	);
}

type Counter = { value: number };

function EntryList({
	entries,
	depth,
	counter,
	collapsed,
	onToggle,
	lineNoWidth,
}: {
	entries: LogEntry[];
	depth: number;
	counter: Counter;
	collapsed: Set<string>;
	onToggle: (id: string) => void;
	lineNoWidth: string;
}) {
	return (
		<>
			{entries.map((entry, idx) => {
				if (entry.kind === "line") {
					counter.value += 1;
					return (
						<LogRow
							// biome-ignore lint/suspicious/noArrayIndexKey: log lines are append-only and never reorder
							key={`l-${idx}`}
							text={entry.text}
							lineNumber={counter.value}
							depth={depth}
							lineNoWidth={lineNoWidth}
						/>
					);
				}
				counter.value += 1;
				const headerLineNumber = counter.value;
				const isOpen = !collapsed.has(entry.id);
				const header = (
					<GroupHeaderRow
						key={`gh-${entry.id}`}
						name={entry.name}
						lineNumber={headerLineNumber}
						depth={depth}
						isOpen={isOpen}
						onToggle={() => onToggle(entry.id)}
						lineNoWidth={lineNoWidth}
					/>
				);
				if (!isOpen) {
					counter.value += countEntryLines(entry.children);
					return header;
				}
				return (
					<div key={`g-${entry.id}`}>
						{header}
						<EntryList
							entries={entry.children}
							depth={depth + 1}
							counter={counter}
							collapsed={collapsed}
							onToggle={onToggle}
							lineNoWidth={lineNoWidth}
						/>
					</div>
				);
			})}
		</>
	);
}

type LogLevel = "error" | "warning" | "notice" | "debug" | null;

type ParsedLogLine = {
	level: LogLevel;
	body: string;
};

const LEVEL_BRACKET_RE = /^##\[(error|warning|notice|debug)\](.*)$/;
const LEVEL_WF_CMD_RE = /^::(error|warning|notice|debug)(?:\s[^:]*)?::(.*)$/;

function parseLogLine(text: string): ParsedLogLine {
	const bm = text.match(LEVEL_BRACKET_RE);
	if (bm) {
		return { level: bm[1] as LogLevel, body: bm[2] ?? "" };
	}
	const wm = text.match(LEVEL_WF_CMD_RE);
	if (wm) {
		return { level: wm[1] as LogLevel, body: wm[2] ?? "" };
	}
	return { level: null, body: text };
}

const LEVEL_LABELS: Record<Exclude<LogLevel, null>, string> = {
	error: "Error:",
	warning: "Warning:",
	notice: "Notice:",
	debug: "Debug:",
};

const LEVEL_ROW_BG: Record<Exclude<LogLevel, null>, string> = {
	error: "bg-red-500/10",
	warning: "bg-amber-500/10",
	notice: "bg-blue-500/10",
	debug: "bg-muted/40",
};

const LEVEL_LINE_NO: Record<Exclude<LogLevel, null>, string> = {
	error: "text-red-500",
	warning: "text-amber-500",
	notice: "text-blue-500",
	debug: "text-muted-foreground",
};

const LEVEL_LABEL_TEXT: Record<Exclude<LogLevel, null>, string> = {
	error: "text-red-500 dark:text-red-400",
	warning: "text-amber-600 dark:text-amber-400",
	notice: "text-blue-600 dark:text-blue-400",
	debug: "text-muted-foreground",
};

const LogRow = memo(function LogRow({
	text,
	lineNumber,
	depth,
	lineNoWidth,
}: {
	text: string;
	lineNumber: number;
	depth: number;
	lineNoWidth: string;
}) {
	const { level, body } = parseLogLine(text);
	const levelClass = level ? LEVEL_ROW_BG[level] : "";
	const lineNoClass = level ? LEVEL_LINE_NO[level] : "text-muted-foreground/50";
	return (
		<div className={cn("-mx-3 flex gap-2 px-3", levelClass)}>
			<span
				className={cn("shrink-0 select-none tabular-nums", lineNoClass)}
				style={{ width: lineNoWidth }}
			>
				{lineNumber}
			</span>
			<span
				className="min-w-0 flex-1 whitespace-pre-wrap break-all"
				style={depth > 0 ? { paddingLeft: `${depth}ch` } : undefined}
			>
				{level ? (
					<>
						<span className={cn("font-semibold", LEVEL_LABEL_TEXT[level])}>
							{LEVEL_LABELS[level]}
						</span>
						{body ? ` ${body}` : ""}
					</>
				) : (
					body
				)}
			</span>
		</div>
	);
});

function GroupHeaderRow({
	name,
	lineNumber,
	depth,
	isOpen,
	onToggle,
	lineNoWidth,
}: {
	name: string;
	lineNumber: number;
	depth: number;
	isOpen: boolean;
	onToggle: () => void;
	lineNoWidth: string;
}) {
	return (
		<div className="-mx-3 flex gap-2 px-3 hover:bg-muted/40">
			<span
				className="shrink-0 select-none tabular-nums text-muted-foreground/50"
				style={{ width: lineNoWidth }}
			>
				{lineNumber}
			</span>
			<button
				type="button"
				onClick={onToggle}
				className="flex min-w-0 flex-1 items-start gap-1 text-left"
				style={depth > 0 ? { paddingLeft: `${depth}ch` } : undefined}
				aria-expanded={isOpen}
			>
				<span className="mt-[3px] shrink-0 text-muted-foreground">
					{isOpen ? (
						<ChevronDownIcon size={10} strokeWidth={2.5} />
					) : (
						<ChevronRightIcon size={10} strokeWidth={2.5} />
					)}
				</span>
				<span className="min-w-0 whitespace-pre-wrap break-all font-medium">
					{name}
				</span>
			</button>
		</div>
	);
}
