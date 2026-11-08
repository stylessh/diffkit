import { Slot, Slottable } from "@radix-ui/react-slot";
import type * as React from "react";

import { cn } from "../lib/utils";

/**
 * A detail page's body, after Linear's issue and diff pages: a content column
 * of at most 780px (688px of text with 46px either side), centred in what the
 * properties panel leaves; the panel takes about a third of the pane and
 * stays pinned while the content scrolls. Under 1024px the panel follows the
 * content.
 */
function DetailLayout({
	className,
	children,
	panel,
	panelLabel = "Properties",
	...props
}: React.ComponentProps<"div"> & {
	panel: React.ReactNode;
	/** Accessible name for the panel landmark. */
	panelLabel?: string;
}) {
	return (
		<div
			data-slot="detail-layout"
			className={cn("min-h-0 flex-1 overflow-y-auto", className)}
			{...props}
		>
			<div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,34%)]">
				<div className="mx-auto flex w-full max-w-[780px] min-w-0 flex-col gap-8 px-4 pt-6 pb-16 md:px-[46px]">
					{children}
				</div>
				<aside
					aria-label={panelLabel}
					className="min-w-0 self-start px-4 pt-2 pb-10 md:px-[46px] lg:sticky lg:top-0 lg:max-h-[calc(100dvh-4rem)] lg:overflow-y-auto lg:overscroll-contain lg:pt-3.5 lg:pr-3 lg:pl-0 lg:[scrollbar-width:none]"
				>
					<div className="flex max-w-80 flex-col">{panel}</div>
				</aside>
			</div>
		</div>
	);
}

/** A section of the properties panel: a muted 13px label, an optional action, then its rows. */
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
			data-slot="panel-section"
			className={cn("mb-7", className)}
			{...props}
		>
			<div className="mb-1.5 flex h-6 items-center gap-2 text-[13px] font-[450] text-muted-foreground">
				<h3 className="min-w-0 truncate">{label}</h3>
				{action ? <span className="ml-auto flex">{action}</span> : null}
			</div>
			<div className="flex flex-col gap-1">{children}</div>
		</section>
	);
}

/**
 * The ghost pill a panel value sits in, as Linear's issue panel draws them:
 * it hugs its content, hangs 6px past the text on both sides and lights on
 * hover (or while its menu is open). Render a button or a trigger with
 * `asChild` when clicking it changes the value.
 */
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
			data-slot="panel-pill"
			className={cn(
				"-mx-1.5 flex h-7 w-fit max-w-[calc(100%+12px)] min-w-0 items-center gap-2 truncate rounded-full px-1.5 text-left text-[13px] font-medium transition-colors",
				"group-hover/row:bg-item-hover hover:bg-item-hover aria-expanded:bg-item-hover data-[state=open]:bg-item-hover",
				muted ? "text-muted-foreground" : "text-text-header",
				className,
			)}
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

/**
 * A row in a panel section: the pill, then (for values with their own page)
 * the round › that shows on hover, and anything that sits after it.
 */
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
	/** A `PanelGoButton` that opens the value's own page. */
	go?: React.ReactNode;
	after?: React.ReactNode;
}) {
	return (
		<div
			data-slot="panel-row"
			className={cn(
				"group/row flex w-fit max-w-full items-center gap-2.5",
				className,
			)}
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

/**
 * The round › beside a panel item, shown on hover: a 28px circle 4px after
 * the pill, fainter than the pill, with a 4x7.5 chevron. Pass a link with
 * `asChild`.
 */
function PanelGoButton({
	className,
	asChild = false,
	children,
	...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
	const Comp = asChild ? Slot : "button";
	return (
		<Comp
			data-slot="panel-go-button"
			className={cn(
				"flex size-7 shrink-0 items-center justify-center rounded-full bg-go-fill text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100 hover:bg-ghost-hover hover:text-text-header focus-visible:opacity-100",
				className,
			)}
			{...props}
		>
			<Slottable>{children}</Slottable>
			<svg
				width="8"
				height="8"
				viewBox="0 0 8 8"
				fill="none"
				aria-hidden="true"
			>
				<path
					d="M2.6.85 5.4 4 2.6 7.15"
					stroke="currentColor"
					strokeWidth="1.25"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
		</Comp>
	);
}

/**
 * A panel section's +: on a row of its own under the section's items, a
 * 24px muted round button whose glyph centres on the 14px icon column above.
 */
function PanelAddButton({
	className,
	...props
}: React.ComponentProps<"button">) {
	return (
		<button
			type="button"
			data-slot="panel-add-button"
			className={cn(
				"-ml-[5px] flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-ghost-hover hover:text-text-header aria-expanded:bg-ghost-hover data-[state=open]:bg-ghost-hover",
				className,
			)}
			{...props}
		>
			<svg
				width="14"
				height="14"
				viewBox="0 0 16 16"
				fill="none"
				aria-hidden="true"
			>
				<path
					d="M8 3v10M3 8h10"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
				/>
			</svg>
		</button>
	);
}

/** A labelled property: a muted 96px label column, then the value. */
function PropertyRow({
	className,
	label,
	children,
	...props
}: Omit<React.ComponentProps<"div">, "title"> & { label: React.ReactNode }) {
	return (
		<div
			data-slot="property-row"
			className={cn("flex min-h-9 items-center gap-2 text-[13px]", className)}
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

/** Green and red line counts in tabular figures, as diffs show them. */
function LineCounts({
	className,
	additions,
	deletions,
	...props
}: React.ComponentProps<"span"> & { additions: number; deletions: number }) {
	return (
		<span
			data-slot="line-counts"
			className={cn("flex shrink-0 gap-1.5 font-[450] tabular-nums", className)}
			{...props}
		>
			{additions > 0 ? <span className="text-added">+{additions}</span> : null}
			{deletions > 0 ? (
				<span className="text-removed">-{deletions}</span>
			) : null}
		</span>
	);
}

/** A branch or ref as a badge: the mono face on a faint tint, truncating. */
function BranchBadge({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span
			data-slot="branch-badge"
			className={cn(
				"inline-block h-5 max-w-full min-w-0 truncate rounded-[5px] bg-pill-neutral px-1.5 align-middle font-mono text-[11.5px] leading-5 font-[450] text-text-header",
				className,
			)}
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
