import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "../lib/utils";

const statePillVariants = cva(
	"inline-flex h-5 items-center gap-1 rounded-full px-2 text-xs leading-none font-medium whitespace-nowrap shrink-0 [&_svg]:size-3 [&_svg]:shrink-0",
	{
		variants: {
			tone: {
				open: "bg-pill-ok text-pill-ok-text",
				closed: "bg-pill-blocked text-pill-blocked-text",
				merged: "bg-pill-merged text-pill-merged-text",
				muted: "bg-pill-neutral text-text-header",
				secondary: "bg-secondary text-secondary-foreground",
				warning: "bg-pill-warning text-pill-warning-text",
			},
		},
		defaultVariants: {
			tone: "muted",
		},
	},
);

export type StatePillTone = NonNullable<
	VariantProps<typeof statePillVariants>["tone"]
>;

export function StatePill({
	className,
	tone,
	...props
}: React.ComponentProps<"span"> & VariantProps<typeof statePillVariants>) {
	return (
		<span
			data-slot="state-pill"
			className={cn(statePillVariants({ tone }), className)}
			{...props}
		/>
	);
}
