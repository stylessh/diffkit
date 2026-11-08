import { Slot } from "@radix-ui/react-slot";
import type * as React from "react";

import { cn } from "../lib/utils";

function ViewTabs({
	className,
	children,
	actions,
	label,
	...props
}: React.ComponentProps<"div"> & {
	actions?: React.ReactNode;
	label: string;
}) {
	return (
		<div
			data-slot="view-tabs"
			className={cn(
				"flex min-h-11 shrink-0 items-center gap-2 py-1.5 pr-[15px] pl-[7px]",
				className,
			)}
			{...props}
		>
			<nav
				aria-label={label}
				className="no-scrollbar -m-1.5 flex min-w-0 items-center gap-[7px] overflow-x-auto p-1.5"
			>
				{children}
			</nav>
			{actions ? (
				<div className="ml-auto flex shrink-0 items-center gap-1.5 text-muted-foreground">
					{actions}
				</div>
			) : null}
		</div>
	);
}

function ViewTab({
	className,
	active,
	asChild = false,
	...props
}: React.ComponentProps<"button"> & {
	active?: boolean;
	asChild?: boolean;
}) {
	const Comp = asChild ? Slot : "button";
	return (
		<Comp
			data-slot="view-tab"
			aria-current={active ? "page" : undefined}
			className={cn(
				"inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md bg-button px-[10.5px] text-xs font-medium whitespace-nowrap text-muted-foreground shadow-button transition-colors hover:bg-button-hover hover:text-foreground [&_svg]:shrink-0",
				"aria-[current=page]:bg-tab-selected aria-[current=page]:text-foreground aria-[current=page]:shadow-tab-selected",
				className,
			)}
			{...props}
		/>
	);
}

function ViewTabCount({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span
			data-slot="view-tab-count"
			className={cn("font-[450] tabular-nums text-muted-foreground", className)}
			{...props}
		/>
	);
}

export { ViewTab, ViewTabCount, ViewTabs };
