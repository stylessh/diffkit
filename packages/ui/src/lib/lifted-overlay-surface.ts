import { cn } from "./utils";

/*
 * Floating-surface recipes shared by every overlay. Linear's overlays are a flat
 * popover-colored fill held by a hairline 0.5px ring and a low-alpha drop, both
 * folded into one token (`shadow-popover`), with 8–12px corners.
 */

/** Modal surface shared by Dialog, AlertDialog, and Command-K. */
export const liftedDialogSurfaceClassName = cn(
	"bg-dialog text-popover-foreground shadow-popover",
);

/** Standard floating panels (menus, popovers, select content, hover cards). */
export const liftedPopoverSurfaceClassName = cn(
	"border-0 bg-popover text-popover-foreground shadow-popover",
);

/** Nested submenu / sub-popover — same recipe, stacks on its parent. */
export const liftedPopoverNestedSurfaceClassName =
	liftedPopoverSurfaceClassName;

/** Tooltip hint — small, popover-colored. */
export const liftedTooltipSurfaceClassName = cn(
	"border-0 bg-tooltip text-text-header shadow-popover",
);
