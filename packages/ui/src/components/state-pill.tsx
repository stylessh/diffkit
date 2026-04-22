import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "../lib/utils";

const statePillVariants = cva(
	"inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap shrink-0",
	{
		variants: {
			tone: {
				open: "bg-green-500/10 text-green-500",
				closed: "bg-red-500/10 text-red-500",
				merged: "bg-purple-500/10 text-purple-500",
				muted: "bg-muted text-muted-foreground",
				secondary: "bg-secondary text-secondary-foreground",
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
