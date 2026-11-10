import { LayoutAlignBottomIcon } from "@diffkit/icons";
import { Slot, Slottable } from "@radix-ui/react-slot";
import * as React from "react";
import { cn } from "../lib/utils";
import { Drawer, DrawerContent, DrawerTitle } from "./drawer";
import {
	MobileActionBar,
	MobileActionButton,
	MobileActionGroup,
} from "./mobile-action-bar";
import { ScrollFade } from "./scroll-fade";

// Below md the page is one scroller and the panel moves into a drawer opened
// from the floating action bar, so the content column's scroller stands down:
// no overflow of its own and no edge mask.
const COLUMN_SCROLLER =
	"max-md:overflow-visible max-md:[mask-image:none]! max-md:[-webkit-mask-image:none]! md:min-h-0";

function DetailLayout({
	className,
	children,
	panel,
	panelLabel = "Properties",
	toolbar,
	mobileActions,
	...props
}: React.ComponentProps<"div"> & {
	panel: React.ReactNode;
	panelLabel?: string;
	toolbar?: React.ReactNode;
	/** The page's main call to action on phones, beside the Details pill. */
	mobileActions?: React.ReactNode;
}) {
	const [panelOpen, setPanelOpen] = React.useState(false);
	return (
		<div
			className={cn(
				"flex min-h-0 flex-1 flex-col max-md:overflow-y-auto md:grid md:grid-cols-[minmax(0,1fr)_16rem] md:grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_21rem]",
				className,
			)}
			data-slot="detail-layout"
			{...props}
		>
			{toolbar ? (
				<div className="z-10 shrink-0 bg-main max-md:sticky max-md:top-0 md:col-start-1 md:row-start-1">
					{toolbar}
				</div>
			) : null}
			<ScrollFade
				className={cn("min-w-0 md:col-start-1 md:row-start-2", COLUMN_SCROLLER)}
				fade={32}
				orientation="vertical"
			>
				<div className="mx-auto flex w-full min-w-0 max-w-[780px] flex-col gap-8 px-4 pt-14 pb-20 sm:px-[46px] md:px-8 md:pb-16 lg:px-[46px]">
					{children}
				</div>
			</ScrollFade>
			<aside
				aria-label={panelLabel}
				className="hidden min-w-0 border-header-rule md:col-start-2 md:row-span-2 md:row-start-1 md:flex md:min-h-0 md:flex-col md:border-l"
			>
				<ScrollFade
					className={cn(
						"flex flex-1 flex-col px-5 pb-10 lg:px-6",
						toolbar ? "pt-25" : "pt-14",
					)}
					fade={32}
					orientation="vertical"
				>
					{panel}
				</ScrollFade>
			</aside>
			<MobileActionBar label="Page actions">
				<MobileActionGroup>
					<MobileActionButton
						icon={<LayoutAlignBottomIcon size={15} strokeWidth={2} />}
						onClick={() => setPanelOpen(true)}
					>
						Details
					</MobileActionButton>
				</MobileActionGroup>
				{mobileActions}
			</MobileActionBar>
			<Drawer open={panelOpen} onOpenChange={setPanelOpen}>
				<DrawerContent>
					<DrawerTitle className="sr-only">{panelLabel}</DrawerTitle>
					<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-2 pb-6">
						{panel}
					</div>
				</DrawerContent>
			</Drawer>
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
