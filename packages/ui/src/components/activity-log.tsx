"use client";

import { ChevronDownIcon } from "@diffkit/icons";
import { observeElementRect, useVirtualizer } from "@tanstack/react-virtual";
import type * as React from "react";
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import { cn } from "../lib/utils";
import { Badge } from "./badge";
import { Button } from "./button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "./collapsible";

export type ActivityLogItem = {
	detail?: React.ReactNode;
	icon: React.ReactNode;
	id: string;
	label: React.ReactNode;
	meta?: React.ReactNode;
	summary?: React.ReactNode;
	timestamp?: React.ReactNode;
	tone?: "default" | "destructive";
};

export type ActivityLogProps = {
	ariaLabel: string;
	busy?: boolean;
	className?: string;
	empty?: React.ReactNode;
	followLatest?: boolean;
	headerActions?: React.ReactNode;
	items: readonly ActivityLogItem[];
	leadingContent?: React.ReactNode;
	live?: boolean;
	liveLabel?: string;
	onLoadEarlier?: () => void;
	showLoadEarlier?: boolean;
	title?: React.ReactNode;
	trailingContent?: React.ReactNode;
};

const TAIL_THRESHOLD_PX = 32;
const VIRTUALIZATION_THRESHOLD = 40;

/**
 * A compact, dynamically measured activity stream. Only the visible rows and
 * a small overscan window are mounted, even when the retained input is large.
 */
export function ActivityLog({
	ariaLabel,
	busy = false,
	className,
	empty = "No activity yet.",
	followLatest = false,
	headerActions,
	items,
	leadingContent,
	live = false,
	liveLabel = "Streaming",
	onLoadEarlier,
	showLoadEarlier = false,
	title = "Activity",
	trailingContent,
}: ActivityLogProps) {
	const viewportRef = useRef<HTMLDivElement>(null);
	const previousCountRef = useRef(items.length);
	const followingRef = useRef(true);
	const [showJumpToLatest, setShowJumpToLatest] = useState(false);
	const itemKeys = useMemo(() => items.map((item) => item.id), [items]);
	const getItemKey = useCallback(
		(index: number) => itemKeys[index] ?? index,
		[itemKeys],
	);
	const virtualizer = useVirtualizer({
		count: items.length,
		estimateSize: () => 42,
		getItemKey,
		getScrollElement: () => viewportRef.current,
		initialRect: { height: 600, width: 0 },
		measureElement: (element) => element.getBoundingClientRect().height || 42,
		observeElementRect: (instance, callback) =>
			observeElementRect(instance, (rect) =>
				callback({
					height: rect.height || 600,
					width: rect.width,
				}),
			),
		overscan: 8,
	});
	const virtualItems = virtualizer.getVirtualItems();

	const scrollToLatest = useCallback(
		(behavior: ScrollBehavior = "smooth") => {
			if (items.length === 0) return;
			followingRef.current = true;
			setShowJumpToLatest(false);
			virtualizer.scrollToIndex(items.length - 1, {
				align: "end",
				behavior,
			});
		},
		[items.length, virtualizer],
	);

	useLayoutEffect(() => {
		if (!followLatest || items.length === 0) return;
		if (previousCountRef.current === 0 || followingRef.current) {
			scrollToLatest("auto");
		} else if (items.length > previousCountRef.current) {
			setShowJumpToLatest(true);
		}
		previousCountRef.current = items.length;
	}, [followLatest, items.length, scrollToLatest]);

	useEffect(() => {
		previousCountRef.current = items.length;
	}, [items.length]);

	function handleScroll() {
		if (!followLatest) return;
		const viewport = viewportRef.current;
		if (!viewport) return;
		const atTail =
			viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <=
			TAIL_THRESHOLD_PX;
		followingRef.current = atTail;
		if (atTail) setShowJumpToLatest(false);
	}

	return (
		<section
			aria-busy={busy}
			aria-label={ariaLabel}
			className={cn(
				"relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg bg-card shadow-card",
				className,
			)}
		>
			<header className="flex min-h-9 shrink-0 items-center justify-between gap-3 border-b border-border/60 px-3 py-1.5">
				<div className="flex min-w-0 items-center gap-2">
					<h2 className="truncate text-xs font-medium text-foreground">
						{title}
					</h2>
					{items.length > 0 ? (
						<span className="text-[11px] tabular-nums text-muted-foreground">
							{items.length}
						</span>
					) : null}
				</div>
				<div className="flex shrink-0 items-center gap-1.5">
					{headerActions}
					{live ? (
						<Badge size="sm" variant="default" role="status">
							<span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
							{liveLabel}
						</Badge>
					) : null}
				</div>
			</header>

			{leadingContent}
			{items.length === 0 && !showLoadEarlier ? (
				<div className="px-3 py-3 text-xs text-muted-foreground">{empty}</div>
			) : (
				<div
					ref={viewportRef}
					onScroll={handleScroll}
					className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain"
				>
					{showLoadEarlier ? (
						<Button
							className="h-8 w-full justify-start rounded-none px-3 text-[11px] text-muted-foreground"
							onClick={onLoadEarlier}
							size="sm"
							type="button"
							variant="ghost"
						>
							Show earlier activity
						</Button>
					) : null}
					{items.length <= VIRTUALIZATION_THRESHOLD ? (
						<ul className="m-0 list-none p-0">
							{items.map((item, index) => (
								<ActivityListItem
									count={items.length}
									index={index}
									item={item}
									key={item.id}
								/>
							))}
						</ul>
					) : (
						<ul
							className="relative m-0 w-full list-none p-0"
							style={{ height: `${virtualizer.getTotalSize()}px` }}
						>
							{virtualItems.map((virtualRow) => {
								const item = items[virtualRow.index];
								if (!item) return null;
								return (
									<ActivityListItem
										className="absolute top-0 left-0 w-full"
										count={items.length}
										index={virtualRow.index}
										item={item}
										key={virtualRow.key}
										ref={virtualizer.measureElement}
										style={{
											transform: `translateY(${virtualRow.start}px)`,
										}}
									/>
								);
							})}
						</ul>
					)}
				</div>
			)}
			{trailingContent}
			{showJumpToLatest ? (
				<Button
					className="absolute right-3 bottom-3 h-8 gap-1.5 rounded-full bg-button px-3 shadow-button hover:bg-button-hover"
					onClick={() => scrollToLatest()}
					size="sm"
					type="button"
					variant="secondary"
				>
					<ChevronDownIcon aria-hidden size={13} strokeWidth={2} />
					Jump to latest
				</Button>
			) : null}
		</section>
	);
}

function ActivityListItem({
	className,
	count,
	index,
	item,
	...props
}: Omit<React.ComponentProps<"li">, "children"> & {
	count: number;
	index: number;
	item: ActivityLogItem;
}) {
	return (
		<li
			aria-posinset={index + 1}
			aria-setsize={count}
			className={cn("border-b border-border/50 last:border-b-0", className)}
			data-index={index}
			{...props}
		>
			<ActivityRow item={item} />
		</li>
	);
}

function ActivityRow({ item }: { item: ActivityLogItem }) {
	const row = (
		<div className="grid min-h-10 w-full grid-cols-[1rem_minmax(0,1fr)_max-content] items-center gap-x-2.5 px-3 py-2 text-left">
			<span className="flex size-4 items-center justify-center text-muted-foreground">
				{item.icon}
			</span>
			<span className="flex min-w-0 items-baseline gap-2">
				<span
					className={cn(
						"shrink-0 text-xs font-medium",
						item.tone === "destructive"
							? "text-destructive"
							: "text-foreground",
					)}
				>
					{item.label}
				</span>
				{item.summary ? (
					<span className="min-w-0 truncate font-mono text-[11px] text-muted-foreground">
						{item.summary}
					</span>
				) : null}
			</span>
			<span className="flex shrink-0 items-center gap-2 text-[11px] tabular-nums text-muted-foreground">
				{item.meta}
				{item.timestamp}
				{item.detail ? (
					<ChevronDownIcon
						aria-hidden
						className="transition-transform group-data-[state=open]:rotate-180"
						size={13}
						strokeWidth={2}
					/>
				) : null}
			</span>
		</div>
	);

	if (!item.detail) return row;
	return (
		<Collapsible>
			<CollapsibleTrigger className="group block w-full transition-colors hover:bg-muted/40 focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-ring focus-visible:ring-inset">
				{row}
			</CollapsibleTrigger>
			<CollapsibleContent className="border-t border-border/40 bg-background/35 px-3 py-2.5 text-xs text-foreground">
				{item.detail}
			</CollapsibleContent>
		</Collapsible>
	);
}
