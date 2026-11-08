import type * as React from "react";

import { cn } from "../lib/utils";

export const menuRowClassName =
	"flex h-8 w-full shrink-0 items-center gap-2 rounded-lg pr-2.5 pl-[7.75px] text-left text-[13px] font-[450] text-text-header outline-none transition-colors hover:bg-menu-hover hover:text-foreground data-[active=true]:bg-menu-hover data-[active=true]:text-foreground disabled:pointer-events-none disabled:opacity-50";

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
	return (
		<kbd
			data-slot="kbd"
			className={cn(
				"flex h-[17px] min-w-[17px] shrink-0 items-center justify-center rounded-[4px] px-1 font-sans text-[11px] font-medium text-muted-foreground shadow-[inset_0_0_0_0.5px_var(--ln-popover-border)]",
				className,
			)}
			{...props}
		/>
	);
}

function MenuSearch({
	className,
	shortcut,
	...props
}: React.ComponentProps<"input"> & { shortcut?: string }) {
	return (
		<div className="flex h-9 items-center gap-2 border-b-[0.5px] border-popover-border pr-[11px] pl-[13.5px]">
			<input
				data-slot="menu-search"
				className={cn(
					"min-w-0 flex-1 bg-transparent text-[13px] font-[450] text-foreground caret-indigo outline-none placeholder:text-muted-foreground focus-visible:outline-none",
					className,
				)}
				{...props}
			/>
			{shortcut ? <Kbd className="w-[18.5px]">{shortcut}</Kbd> : null}
		</div>
	);
}

function MenuHead({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="menu-head"
			className={cn(
				"flex h-[30px] items-center px-2 text-xs font-medium text-muted-foreground",
				className,
			)}
			{...props}
		/>
	);
}

function MenuCheck({ className }: { className?: string }) {
	return (
		<svg
			width="12"
			height="12"
			viewBox="0 0 12 12"
			fill="none"
			aria-hidden="true"
			className={cn("shrink-0 text-foreground", className)}
		>
			<path
				d="M1.75 6.4 4.6 9.25l5.65-6.5"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

function MenuRowEnd({
	checked,
	shortcut,
}: {
	checked?: boolean;
	shortcut?: React.ReactNode;
}) {
	return (
		<span className="ml-auto flex shrink-0 items-center gap-[7px] pl-2">
			{checked ? <MenuCheck /> : null}
			{shortcut !== undefined && shortcut !== null ? (
				<span className="w-2 text-right font-mono text-xs text-muted-foreground">
					{shortcut}
				</span>
			) : null}
		</span>
	);
}

export { Kbd, MenuCheck, MenuHead, MenuRowEnd, MenuSearch };
