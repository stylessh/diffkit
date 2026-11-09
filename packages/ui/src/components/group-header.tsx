import { ChevronRightIcon } from "@diffkit/icons";
import type * as React from "react";

import { cn } from "../lib/utils";

function GroupHeader({
	className,
	icon,
	title,
	label,
	count,
	open = true,
	onToggle,
	actions,
	...props
}: Omit<React.ComponentProps<"div">, "title"> & {
	icon?: React.ReactNode;
	title: React.ReactNode;
	label?: string;
	count?: React.ReactNode;
	open?: boolean;
	onToggle?: () => void;
	actions?: React.ReactNode;
}) {
	return (
		<div
			className={cn(
				"flex h-9 items-center rounded-lg bg-group pr-2",
				className,
			)}
			data-slot="group-header"
			{...props}
		>
			{onToggle ? (
				<button
					aria-expanded={open}
					aria-label={`${open ? "Collapse" : "Expand"} ${label ?? (typeof title === "string" ? title : "group")}`}
					className="ml-1.5 flex size-6 shrink-0 items-center justify-center rounded-md text-icon-faint transition-colors hover:bg-ghost-hover hover:text-muted-foreground"
					onClick={onToggle}
					type="button"
				>
					<ChevronRightIcon
						className={cn(
							"transition-transform duration-150",
							open && "rotate-90",
						)}
						size={14}
						strokeWidth={2.5}
					/>
				</button>
			) : (
				<span aria-hidden className="ml-1.5 size-6 shrink-0" />
			)}
			<span className="ml-1 flex w-4 shrink-0 justify-center text-muted-foreground [&_svg]:size-3.5">
				{icon}
			</span>
			<h2
				aria-label={label}
				className="ml-2.5 min-w-0 truncate font-medium text-[13px] text-text-strong"
			>
				{title}
			</h2>
			{count !== undefined ? (
				<span className="ml-2 font-[450] text-[13px] text-muted-foreground tabular-nums">
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
