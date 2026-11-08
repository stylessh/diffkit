import { cn } from "./utils";

/*
 * Linear's pill tabs / segmented toggles: each option is its own 28px pill — a raised
 * fill with a 0.5px ring and a two-layer drop — and the selected one sits a step down
 * (`bg-tab-selected`) with a ring only.
 */

/** Row that holds the pills. */
export const segmentedInsetClassName =
	"m-0 inline-flex min-w-0 w-fit shrink-0 flex-row items-center gap-1.5";

/** Default pill (inactive). */
export const segmentedTriggerBaseClassName = cn(
	"inline-flex h-7 items-center justify-center gap-1.5 rounded-full px-[10.5px] text-xs font-medium whitespace-nowrap transition-[color,background-color,box-shadow]",
	"bg-button text-muted-foreground shadow-button hover:bg-button-hover hover:text-foreground",
	"focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-ring",
	"disabled:pointer-events-none disabled:opacity-50",
	"[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
);

/** Radix tabs — the selected pill. */
export const segmentedTriggerRadixActiveClassName = cn(
	"data-[state=active]:bg-tab-selected data-[state=active]:text-foreground data-[state=active]:shadow-tab-selected",
	"data-[state=active]:hover:bg-tab-selected",
);

/** Plain segmented toggles (`aria-pressed`). */
export const segmentedTriggerSelectedClassName = cn(
	"bg-tab-selected text-foreground shadow-tab-selected hover:bg-tab-selected hover:text-foreground",
);
