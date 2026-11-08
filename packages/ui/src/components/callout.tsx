import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "../lib/utils";

const calloutVariants = cva(
	"flex min-h-11 items-center justify-between gap-3 rounded-lg px-3 py-2 text-[13px] text-text-strong [&_svg]:shrink-0",
	{
		variants: {
			variant: {
				default: "bg-group",
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
			data-slot="callout"
			className={cn(calloutVariants({ variant }), className)}
			{...props}
		/>
	);
}

function CalloutContent({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="callout-content"
			className={cn("flex min-w-0 items-center gap-2", className)}
			{...props}
		/>
	);
}

function CalloutAction({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="callout-action"
			className={cn("shrink-0", className)}
			{...props}
		/>
	);
}

export { Callout, CalloutContent, CalloutAction, calloutVariants };
