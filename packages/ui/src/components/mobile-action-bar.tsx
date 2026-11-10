import type { ComponentProps, ReactNode } from "react";
import { liftedPopoverSurfaceClassName } from "../lib/lifted-overlay-surface";
import { cn } from "../lib/utils";

/**
 * A phone screen's quick actions, floating just above the bottom nav where a
 * thumb reaches them. Secondary actions share a `MobileActionGroup` pill at the
 * left; the screen's main call to action stands apart at the right. Each action
 * opens a drawer from the bottom.
 *
 * Sits inside the main pane (which is `relative`); the screen's scroller needs
 * `MOBILE_ACTION_BAR_CLEARANCE` at its end so its last content clears the bar.
 */
export function MobileActionBar({
	label,
	children,
}: {
	label: string;
	children: ReactNode;
}) {
	return (
		<div
			role="toolbar"
			aria-label={label}
			className="pointer-events-none absolute inset-x-3 bottom-3 z-30 flex items-center gap-2 md:hidden [&>*]:pointer-events-auto"
		>
			{children}
		</div>
	);
}

export function MobileActionGroup({
	className,
	children,
}: {
	className?: string;
	children: ReactNode;
}) {
	return (
		<div
			className={cn(
				liftedPopoverSurfaceClassName,
				"flex h-11 min-w-0 items-center gap-0.5 rounded-xl px-1",
				className,
			)}
		>
			{children}
		</div>
	);
}

export function MobileActionButton({
	icon,
	count,
	active = false,
	className,
	children,
	...props
}: ComponentProps<"button"> & {
	icon: ReactNode;
	count?: number;
	/** The action holds a value right now, e.g. a filter is applied. */
	active?: boolean;
}) {
	return (
		<button
			type="button"
			className={cn(
				"flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors active:bg-ghost-hover [&_svg]:shrink-0",
				active ? "bg-item-hover text-foreground" : "text-text-header",
				className,
			)}
			{...props}
		>
			{icon}
			{children}
			{count != null && count > 0 ? (
				<span className="font-[450] tabular-nums text-muted-foreground">
					{count}
				</span>
			) : null}
		</button>
	);
}

/** Sizes a screen's main call to action to stand beside the group pill. */
export const mobilePrimaryActionClassName =
	"ml-auto h-11 rounded-xl px-4 text-[13px] shadow-[var(--glass-solid),var(--ln-popover-shadow)]";

export const MOBILE_ACTION_BAR_CLEARANCE = "max-md:pb-16";
