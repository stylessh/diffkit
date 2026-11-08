import { ChevronRightIcon } from "@diffkit/icons";
import type * as React from "react";

import { cn } from "../lib/utils";

/**
 * A list group's banner, after Linear's: 36px, rounded, the group fill, a
 * caret that folds the group, its icon, name and count. Make it sticky from
 * the caller when its rows scroll under it.
 */
function GroupHeader({
	className,
	icon,
	title,
	count,
	open = true,
	onToggle,
	actions,
	...props
}: Omit<React.ComponentProps<"div">, "title"> & {
	icon?: React.ReactNode;
	title: React.ReactNode;
	count?: React.ReactNode;
	open?: boolean;
	/** Folds or unfolds the group; omit for a group that can't fold. */
	onToggle?: () => void;
	actions?: React.ReactNode;
}) {
	return (
		<div
			data-slot="group-header"
			className={cn(
				"flex h-9 items-center gap-2 rounded-lg bg-group pr-2 pl-2.5",
				className,
			)}
			{...props}
		>
			{onToggle ? (
				<button
					type="button"
					onClick={onToggle}
					aria-expanded={open}
					aria-label={`${open ? "Collapse" : "Expand"} ${typeof title === "string" ? title : "group"}`}
					className="-ml-1 flex size-6 shrink-0 items-center justify-center rounded-md text-icon-faint transition-colors hover:bg-ghost-hover hover:text-muted-foreground"
				>
					<ChevronRightIcon
						size={12}
						strokeWidth={2.5}
						className={cn(
							"transition-transform duration-150",
							open && "rotate-90",
						)}
					/>
				</button>
			) : null}
			{icon ? (
				<span className="flex shrink-0 text-muted-foreground [&_svg]:size-3.5">
					{icon}
				</span>
			) : null}
			<h2 className="min-w-0 truncate text-[13px] font-medium text-text-strong">
				{title}
			</h2>
			{count !== undefined ? (
				<span className="text-[13px] font-[450] tabular-nums text-muted-foreground">
					{count}
				</span>
			) : null}
			{actions ? (
				<div className="ml-auto flex shrink-0 items-center gap-1">
					{actions}
				</div>
			) : null}
		</div>
	);
}

export { GroupHeader };
