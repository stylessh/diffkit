import { ChevronDownIcon, ChevronRightIcon } from "@diffkit/icons";
import { Spinner } from "@diffkit/ui/components/spinner";
import { cn } from "@diffkit/ui/lib/utils";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { countEntryLines, type LogEntry } from "./parse-step-log";

function collectGroupIds(entries: LogEntry[], out: Set<string>): void {
	for (const entry of entries) {
		if (entry.kind === "group") {
			out.add(entry.id);
			collectGroupIds(entry.children, out);
		}
	}
}

export function StepLogContent({
	entries,
	totalLineCount,
	isLoading,
	isError = false,
	notAvailable,
	hasLogs,
	isStepLive,
	scrollable = true,
}: {
	entries: LogEntry[];
	totalLineCount: number;
	isLoading: boolean;
	isError?: boolean;
	notAvailable: boolean;
	hasLogs: boolean;
	isStepLive: boolean;
	scrollable?: boolean;
}) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const [collapsed, setCollapsed] = useState<Set<string>>(() => {
		const ids = new Set<string>();
		collectGroupIds(entries, ids);
		return ids;
	});
	const seenGroupIdsRef = useRef<Set<string>>(collapsed);

	useEffect(() => {
		const ids = new Set<string>();
		collectGroupIds(entries, ids);
		const newIds: string[] = [];
		for (const id of ids) {
			if (!seenGroupIdsRef.current.has(id)) {
				newIds.push(id);
				seenGroupIdsRef.current.add(id);
			}
		}
		if (newIds.length === 0) return;
		setCollapsed((prev) => {
			const next = new Set(prev);
			for (const id of newIds) next.add(id);
			return next;
		});
	}, [entries]);

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
		if (!isStepLive || !scrollable) return;
		const el = scrollRef.current;
		if (!el) return;
		el.scrollTop = el.scrollHeight;
	}, [isStepLive, scrollable, totalLineCount]);

	const lineNoWidth = useMemo(
		() => `${Math.max(2, String(totalLineCount).length)}ch`,
		[totalLineCount],
	);

	const statusClass = scrollable
		? "flex flex-1 items-center justify-center text-muted-foreground text-xs"
		: "flex items-center justify-center px-4 py-8 text-muted-foreground text-xs";

	if (isLoading && !hasLogs) {
		return (
			<div className={statusClass}>
				<Spinner className="mr-2 size-3.5" />
				Loading logs…
			</div>
		);
	}

	if (isError && !hasLogs) {
		return (
			<div className={cn(statusClass, "text-center")}>
				Failed to load logs. Try refreshing.
			</div>
		);
	}

	if (notAvailable) {
		return (
			<div className={cn(statusClass, "text-center")}>
				Logs are not available yet. They become available once the job starts or
				after completion.
			</div>
		);
	}

	if (!hasLogs) {
		return (
			<div className={cn(statusClass, "text-center")}>
				No log output for this step yet.
			</div>
		);
	}

	const counter = { value: 0 };
	return (
		<div
			ref={scrollRef}
			className={cn(
				"bg-background px-3 py-2 font-mono text-[11px] leading-5",
				scrollable && "nowheel flex-1 overflow-auto",
			)}
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
