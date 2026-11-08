import { cn } from "@diffkit/ui/lib/utils";
import type * as React from "react";

export const pillButtonClassName =
	"inline-flex h-7 max-w-full min-w-0 shrink-0 items-center gap-1.5 rounded-md bg-button px-2.5 text-xs font-medium whitespace-nowrap text-text-header shadow-button transition-colors hover:bg-button-hover hover:text-foreground disabled:pointer-events-none disabled:opacity-50 aria-expanded:text-foreground [&_svg]:shrink-0";

export const ghostPillClassName =
	"inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-medium whitespace-nowrap text-muted-foreground transition-colors hover:bg-ghost-hover hover:text-foreground [&_svg]:shrink-0";

export const pillTabClassName =
	"inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md bg-button px-[10.5px] text-xs font-medium whitespace-nowrap text-muted-foreground shadow-button transition-colors hover:bg-button-hover hover:text-foreground aria-selected:bg-tab-selected aria-selected:text-foreground aria-selected:shadow-tab-selected aria-pressed:bg-tab-selected aria-pressed:text-foreground aria-pressed:shadow-tab-selected [&_svg]:shrink-0";

export const iconButtonClassName =
	"flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-ghost-hover hover:text-foreground disabled:pointer-events-none disabled:opacity-40 aria-disabled:pointer-events-none aria-disabled:opacity-30";

export const cardRowClassName =
	"flex h-9 w-full min-w-0 items-center gap-[9px] border-t-[0.5px] border-card-border px-4 text-left transition-colors first:border-t-0 hover:bg-item-hover";

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
