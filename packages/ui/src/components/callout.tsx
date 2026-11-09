import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "../lib/utils";

const calloutVariants = cva(
	// With an action, the banner hugs an h-7 button with a 6px inset, so its radius
	// is the button's md plus that inset: radius-md + 6px = radius-xl (both from --radius).
	"flex min-h-11 items-center justify-between gap-3 rounded-lg px-3 py-2 text-[13px] text-text-strong has-[[data-slot=callout-action]]:min-h-10 has-[[data-slot=callout-action]]:rounded-xl has-[[data-slot=callout-action]]:py-1.5 has-[[data-slot=callout-action]]:pr-1.5 [&_svg]:shrink-0",
	{
		variants: {
			variant: {
				default: "bg-pill-neutral",
				info: "bg-indigo/8 [&_svg]:text-indigo",
				warning: "bg-pill-warning [&_svg]:text-pill-warning-text",
				success: "bg-pill-ok [&_svg]:text-pill-ok-text",
				destructive: "bg-pill-blocked [&_svg]:text-pill-blocked-text",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

function Callout({
	className,
	variant,
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof calloutVariants>) {
	return (
		<div
			className={cn(calloutVariants({ variant }), className)}
			data-slot="callout"
			{...props}
		/>
	);
}

function CalloutContent({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn("flex min-w-0 items-center gap-2", className)}
			data-slot="callout-content"
			{...props}
		/>
	);
}

function CalloutAction({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn("shrink-0", className)}
			data-slot="callout-action"
			{...props}
		/>
	);
}

export { Callout, CalloutContent, CalloutAction, calloutVariants };
