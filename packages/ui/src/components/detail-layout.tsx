import { Slot, Slottable } from "@radix-ui/react-slot";
import type * as React from "react";

import { cn } from "../lib/utils";

function DetailLayout({
	className,
	children,
	panel,
	panelLabel = "Properties",
	...props
}: React.ComponentProps<"div"> & {
	panel: React.ReactNode;
	panelLabel?: string;
}) {
	return (
		<div
			className={cn("min-h-0 flex-1 overflow-y-auto", className)}
			data-slot="detail-layout"
			{...props}
		>
			<div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,34.7%)]">
				<div className="mx-auto flex w-full min-w-0 max-w-[780px] flex-col gap-8 px-4 pt-14 pb-16 md:px-[46px]">
					{children}
				</div>
				<aside
					aria-label={panelLabel}
					className="min-w-0 self-start px-4 pt-2 pb-10 md:px-[46px] lg:sticky lg:top-0 lg:-ml-2 lg:pt-[46px] lg:pr-3 lg:pl-2"
				>
					<div className="flex max-w-80 flex-col">{panel}</div>
				</aside>
			</div>
		</div>
	);
}

function PanelSection({
	className,
	label,
	action,
	children,
	...props
}: Omit<React.ComponentProps<"section">, "title"> & {
	label: React.ReactNode;
	action?: React.ReactNode;
}) {
	return (
		<section
			className={cn("mb-7", className)}
			data-slot="panel-section"
			{...props}
		>
			<div className="mb-1.5 flex h-6 items-center gap-2 font-[450] text-[13px] text-muted-foreground">
				<h3 className="min-w-0 truncate">{label}</h3>
				{action ? <span className="ml-auto flex">{action}</span> : null}
			</div>
			<div className="flex flex-col gap-1">{children}</div>
		</section>
	);
}

function PanelPill({
	className,
	icon,
	muted = false,
	asChild = false,
	children,
	...props
}: React.ComponentProps<"div"> & {
	icon?: React.ReactNode;
	muted?: boolean;
	asChild?: boolean;
}) {
	const Comp = asChild ? Slot : "div";
	return (
		<Comp
			className={cn(
				"-mx-1.5 flex h-7 w-fit min-w-0 max-w-[calc(100%+12px)] items-center gap-2 truncate rounded-md px-1.5 text-left font-medium text-[13px] transition-colors",
				// Muted text means nothing to act on, so no hover either, unless it wraps a link or trigger.
				(!muted || asChild) &&
					"hover:bg-item-hover group-hover/row:bg-item-hover aria-expanded:bg-item-hover data-[state=open]:bg-item-hover",
				muted ? "text-muted-foreground" : "text-text-header",
				className,
			)}
			data-slot="panel-pill"
			{...props}
		>
			{icon ? (
				<span className="flex size-3.5 shrink-0 items-center justify-center [&_img]:size-3.5 [&_svg]:size-3.5">
					{icon}
				</span>
			) : null}
			<Slottable>{children}</Slottable>
		</Comp>
	);
}

function PanelRow({
	className,
	icon,
	muted = false,
	go,
	after,
	children,
	...props
}: React.ComponentProps<"div"> & {
	icon?: React.ReactNode;
	muted?: boolean;
	go?: React.ReactNode;
	after?: React.ReactNode;
}) {
	return (
		<div
			className={cn(
				"group/row flex w-fit max-w-full items-center gap-2.5",
				className,
			)}
			data-slot="panel-row"
			{...props}
		>
			<PanelPill icon={icon} muted={muted}>
				{children}
			</PanelPill>
			{go}
			{after}
		</div>
	);
}

function PanelGoButton({
	className,
	asChild = false,
	children,
	...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
	const Comp = asChild ? Slot : "button";
	return (
		<Comp
			className={cn(
				"flex size-7 shrink-0 items-center justify-center rounded-md bg-go-fill text-muted-foreground opacity-0 transition-opacity hover:bg-ghost-hover hover:text-text-header focus-visible:opacity-100 group-hover/row:opacity-100",
				className,
			)}
			data-slot="panel-go-button"
			{...props}
		>
			<Slottable>{children}</Slottable>
			<svg
				aria-hidden="true"
				fill="none"
				height="8"
				viewBox="0 0 8 8"
				width="8"
			>
				<path
					d="M2.6.85 5.4 4 2.6 7.15"
					stroke="currentColor"
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth="1.25"
				/>
			</svg>
		</Comp>
	);
}

function PanelAddButton({
	className,
	...props
}: React.ComponentProps<"button">) {
	return (
		<button
			className={cn(
				"-ml-[5px] flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-ghost-hover hover:text-text-header aria-expanded:bg-ghost-hover data-[state=open]:bg-ghost-hover",
				className,
			)}
			data-slot="panel-add-button"
			type="button"
			{...props}
		>
			<svg
				aria-hidden="true"
				fill="none"
				height="14"
				viewBox="0 0 16 16"
				width="14"
			>
				<path
					d="M8 3v10M3 8h10"
					stroke="currentColor"
					strokeLinecap="round"
					strokeWidth="1.5"
				/>
			</svg>
		</button>
	);
}

function PropertyRow({
	className,
	label,
	children,
	...props
}: Omit<React.ComponentProps<"div">, "title"> & { label: React.ReactNode }) {
	return (
		<div
			className={cn("flex min-h-9 items-center gap-2 text-[13px]", className)}
			data-slot="property-row"
			{...props}
		>
			<span className="w-24 shrink-0 font-[450] text-muted-foreground">
				{label}
			</span>
			<span className="flex min-w-0 flex-1 items-center gap-1.5 font-medium text-text-header">
				{children}
			</span>
		</div>
	);
}

function LineCounts({
	className,
	additions,
	deletions,
	...props
}: React.ComponentProps<"span"> & { additions: number; deletions: number }) {
	return (
		<span
			className={cn("flex shrink-0 gap-1.5 font-[450] tabular-nums", className)}
			data-slot="line-counts"
			{...props}
		>
			<span className="text-added">+{additions}</span>
			<span className="text-removed">-{deletions}</span>
		</span>
	);
}

function BranchBadge({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span
			className={cn(
				"inline-block h-5 min-w-0 max-w-full truncate rounded-[5px] bg-pill-neutral px-1.5 align-middle font-[450] font-mono text-[11.5px] text-text-header leading-5",
				className,
			)}
			data-slot="branch-badge"
			{...props}
		/>
	);
}

export {
	BranchBadge,
	DetailLayout,
	LineCounts,
	PanelAddButton,
	PanelGoButton,
	PanelPill,
	PanelRow,
	PanelSection,
	PropertyRow,
};
