"use client";

import { CloseIcon } from "@diffkit/icons";
import {
	type DragEventHandler,
	type ReactNode,
	useLayoutEffect,
	useRef,
} from "react";
import { scrollHorizontalChildIntoView } from "../lib/horizontal-scroll-fade-insets";
import { cn } from "../lib/utils";
import { HorizontalScrollFade } from "./horizontal-scroll-fade";

export function TabStrip({
	activeId,
	ariaLabel,
	children,
	className,
	leading,
	trailing,
}: {
	activeId?: string;
	ariaLabel: string;
	children: ReactNode;
	className?: string;
	leading?: ReactNode;
	trailing?: ReactNode;
}) {
	const scrollRef = useRef<HTMLDivElement>(null);
	useLayoutEffect(() => {
		if (!activeId || !scrollRef.current) return;
		const escapedId =
			typeof CSS !== "undefined" && typeof CSS.escape === "function"
				? CSS.escape(activeId)
				: activeId.replaceAll('"', '\\"');
		const active = scrollRef.current.querySelector<HTMLElement>(
			`[data-tab-strip-id="${escapedId}"]`,
		);
		if (active) scrollHorizontalChildIntoView(scrollRef.current, active);
	}, [activeId]);

	return (
		<div
			className={cn(
				"flex h-8 min-w-0 shrink-0 items-stretch border-b border-border/70 bg-surface-1",
				className,
			)}
		>
			{leading}
			<HorizontalScrollFade
				className="min-w-0 flex-1"
				scrollClassName="h-full"
				contentClassName="h-full items-stretch"
				hideScrollbar
				scrollRef={scrollRef}
			>
				<div
					aria-label={ariaLabel}
					className="flex h-full items-stretch"
					role="tablist"
				>
					{children}
				</div>
			</HorizontalScrollFade>
			{trailing}
		</div>
	);
}

export function TabStripTab({
	active,
	ariaLabel,
	children,
	className,
	closeLabel,
	draggable,
	id,
	onClick,
	onClose,
	onDragEnd,
	onDragOver,
	onDragStart,
	onDrop,
	status,
	variant = "edge",
}: {
	active: boolean;
	ariaLabel?: string;
	children: ReactNode;
	className?: string;
	closeLabel?: string;
	draggable?: boolean;
	id: string;
	onClick: () => void;
	onClose?: () => void;
	onDragEnd?: DragEventHandler<HTMLButtonElement>;
	onDragOver?: DragEventHandler<HTMLButtonElement>;
	onDragStart?: DragEventHandler<HTMLButtonElement>;
	onDrop?: DragEventHandler<HTMLButtonElement>;
	status?: ReactNode;
	variant?: "edge" | "rounded";
}) {
	return (
		<div
			className={cn(
				"group/tab relative flex h-full min-w-0 shrink-0 items-stretch",
				variant === "edge" && "border-r-[0.5px] border-rule",
				variant === "rounded" && "my-0.5 ml-0.5 h-7 rounded-md border-r-0",
				active && variant === "edge" && "bg-background",
				active &&
					variant === "rounded" &&
					"bg-tab-selected shadow-tab-selected",
				className,
			)}
			data-tab-strip-id={id}
		>
			<button
				aria-label={ariaLabel}
				aria-selected={active}
				className={cn(
					"flex min-w-0 max-w-52 items-center gap-1.5 px-2.5 text-xs text-muted-foreground outline-none hover:bg-ghost-hover hover:text-foreground focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-ring",
					variant === "rounded" && "rounded-md",
					active && "text-foreground",
					onClose && "pr-7",
				)}
				draggable={draggable}
				onClick={onClick}
				onDragEnd={onDragEnd}
				onDragOver={onDragOver}
				onDragStart={onDragStart}
				onDrop={onDrop}
				role="tab"
				type="button"
			>
				<span className="inline-flex min-w-0 items-center gap-1.5 truncate">
					{children}
				</span>
				{status}
			</button>
			{onClose ? (
				<button
					aria-label={closeLabel ?? "Close tab"}
					className="absolute top-1/2 right-1 flex size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground opacity-100 outline-none hover:bg-ghost-hover hover:text-foreground focus-visible:outline-1 focus-visible:outline-ring md:opacity-0 md:group-hover/tab:opacity-100 md:group-focus-within/tab:opacity-100"
					onClick={(event) => {
						event.stopPropagation();
						onClose();
					}}
					title={closeLabel ?? "Close tab"}
					type="button"
				>
					<CloseIcon aria-hidden size={12} />
				</button>
			) : null}
		</div>
	);
}
