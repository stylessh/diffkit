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
	// Measured off Linear's Reviews list: caret centred 18px in, the icon's
	// 16px box at 34px, the title at 60px; 36px tall, 8px corners.
	return (
		<div
			data-slot="group-header"
			className={cn(
				"flex h-9 items-center rounded-lg bg-group pr-2",
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
					className="ml-1.5 flex size-6 shrink-0 items-center justify-center rounded-md text-icon-faint transition-colors hover:bg-ghost-hover hover:text-muted-foreground"
				>
					<svg
						width="16"
						height="16"
						viewBox="0 0 16 16"
						fill="currentColor"
						aria-hidden="true"
						className={cn(
							"transition-transform duration-150",
							open && "rotate-90",
						)}
					>
						<path d="M6.752 10.624c-.333.194-.752-.046-.752-.432V5.808c0-.386.419-.626.752-.432l3.758 2.192a.5.5 0 0 1 0 .864l-3.758 2.192Z" />
					</svg>
				</button>
			) : (
				<span aria-hidden className="ml-1.5 size-6 shrink-0" />
			)}
			<span className="ml-1 flex w-4 shrink-0 justify-center text-muted-foreground [&_svg]:size-3.5">
				{icon}
			</span>
			<h2 className="ml-2.5 min-w-0 truncate text-[13px] font-medium text-text-strong">
				{title}
			</h2>
			{count !== undefined ? (
				<span className="ml-2 text-[13px] font-[450] tabular-nums text-muted-foreground">
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
