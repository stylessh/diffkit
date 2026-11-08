import { cn } from "@diffkit/ui/lib/utils";
import type * as React from "react";

/**
 * The repository pages' small parts, measured off the Linear reference's
 * repo overview and code view (1440px, both themes).
 */

/** A raised 28px pill: the toolbar's branch, Code and filter buttons. */
export const pillButtonClassName =
	"inline-flex h-7 max-w-full min-w-0 shrink-0 items-center gap-1.5 rounded-full bg-button px-2.5 text-xs font-medium whitespace-nowrap text-text-header shadow-button transition-colors hover:bg-button-hover hover:text-foreground disabled:pointer-events-none disabled:opacity-50 aria-expanded:text-foreground [&_svg]:shrink-0";

/** A 28px ghost pill: "14 branches", "History", row actions with a label. */
export const ghostPillClassName =
	"inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2 text-xs font-medium whitespace-nowrap text-muted-foreground transition-colors hover:bg-ghost-hover hover:text-foreground [&_svg]:shrink-0";

/** A pill tab inside a page (branch views, README / License): selected via aria-selected or aria-pressed. */
export const pillTabClassName =
	"inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-button px-[10.5px] text-xs font-medium whitespace-nowrap text-muted-foreground shadow-button transition-colors hover:bg-button-hover hover:text-foreground aria-selected:bg-tab-selected aria-selected:text-foreground aria-selected:shadow-tab-selected aria-pressed:bg-tab-selected aria-pressed:text-foreground aria-pressed:shadow-tab-selected [&_svg]:shrink-0";

/** A round 28px ghost icon button for row and card actions. */
export const iconButtonClassName =
	"flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-ghost-hover hover:text-foreground disabled:pointer-events-none disabled:opacity-40 aria-disabled:pointer-events-none aria-disabled:opacity-30";

/** The rows inside a repo card: 36px, a hairline between, 16px in, 9px apart. */
export const cardRowClassName =
	"flex h-9 w-full min-w-0 items-center gap-[9px] border-t-[0.5px] border-card-border px-4 text-left transition-colors first:border-t-0 hover:bg-item-hover";

/**
 * A card on the page: the card fill under the card ring and its soft drop,
 * 8px corners so 36px rows sit flush inside.
 */
export function RepoCard({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="repo-card"
			className={cn(
				"min-w-0 overflow-hidden rounded-lg bg-surface-0 shadow-card",
				className,
			)}
			{...props}
		/>
	);
}

/** A card's 44px head row: the commit that last touched what's listed. */
export function RepoCardHead({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="repo-card-head"
			className={cn(
				"flex h-11 min-w-0 items-center gap-[9px] border-b-[0.5px] border-card-border px-4 text-[13px]",
				className,
			)}
			{...props}
		/>
	);
}

/** A key box, as menus show shortcuts: 11px in a 17px hairline square. */
export function KeyHint({
	className,
	children,
}: {
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<kbd
			className={cn(
				"flex h-[17px] min-w-[18.5px] items-center justify-center rounded-[4px] border-[0.5px] border-popover-border px-1 font-sans text-[11px] font-[450] text-muted-foreground",
				className,
			)}
		>
			{children}
		</kbd>
	);
}

/** A property in the repo panel: its name in a muted 112px column, then the value. */
export function LabeledRow({
	label,
	children,
}: {
	label: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<div className="flex min-h-7 min-w-0 items-center text-[13px]">
			<span className="w-28 shrink-0 font-[450] text-muted-foreground">
				{label}
			</span>
			<div className="flex min-w-0 flex-1 items-center gap-2 font-medium text-text-header [&_svg]:shrink-0">
				{children}
			</div>
		</div>
	);
}

/** A small hairline badge: "Latest", "Default", "Public". */
export function HairlineBadge({
	className,
	...props
}: React.ComponentProps<"span">) {
	return (
		<span
			className={cn(
				"inline-flex h-4 shrink-0 items-center rounded-[5px] border-[0.5px] border-chip-border px-1 text-[11px] leading-4 font-medium whitespace-nowrap text-muted-foreground",
				className,
			)}
			{...props}
		/>
	);
}

/** A calm, centred empty or error state for a repo list. */
export function RepoEmptyState({
	icon,
	title,
	children,
	action,
	className,
}: {
	icon?: React.ReactNode;
	title: React.ReactNode;
	children?: React.ReactNode;
	action?: React.ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"flex flex-col items-center gap-1.5 px-4 py-16 text-center",
				className,
			)}
		>
			{icon ? (
				<span className="mb-2 flex text-icon-faint [&_svg]:size-5">{icon}</span>
			) : null}
			<p className="text-[13px] font-medium text-text-header">{title}</p>
			{children ? (
				<p className="max-w-sm text-[13px] text-pretty text-muted-foreground">
					{children}
				</p>
			) : null}
			{action ? <div className="mt-3 flex">{action}</div> : null}
		</div>
	);
}

/** The muted author avatar used in repo rows: 18px with a hairline ring. */
export function RepoAvatar({
	src,
	alt = "",
	size = 18,
	className,
}: {
	src: string;
	alt?: string;
	size?: number;
	className?: string;
}) {
	return (
		<img
			src={src}
			alt={alt}
			loading="lazy"
			width={size}
			height={size}
			style={{ width: size, height: size }}
			className={cn(
				"shrink-0 rounded-full ring-[0.5px] ring-chip-border",
				className,
			)}
		/>
	);
}

/** A release's diamond, as Linear draws milestones; the latest one in the open color. */
export function ReleaseGlyph({
	latest = false,
	size = 14,
	className,
}: {
	latest?: boolean;
	size?: number;
	className?: string;
}) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 14 14"
			fill="none"
			aria-hidden="true"
			className={cn(
				"shrink-0",
				latest ? "text-state-open" : "text-icon-faint",
				className,
			)}
		>
			<path
				d="M7 1.5 12.5 7 7 12.5 1.5 7Z"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinejoin="round"
			/>
		</svg>
	);
}
