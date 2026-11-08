import { cn } from "./utils";

export const liftedDialogSurfaceClassName = cn(
	"bg-dialog text-popover-foreground shadow-popover",
);

export const liftedPopoverSurfaceClassName = cn(
	"border-0 bg-popover text-popover-foreground shadow-popover",
);

export const liftedPopoverNestedSurfaceClassName =
	liftedPopoverSurfaceClassName;

export const liftedTooltipSurfaceClassName = cn(
	"border-0 bg-tooltip text-text-header shadow-tooltip",
);
