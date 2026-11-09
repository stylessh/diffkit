import { Slot, Slottable } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "../lib/utils";

const buttonVariants = cva(
	[
		"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-[13px] font-medium transition-[color,background-color,box-shadow]",
		"disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
		"[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
		"outline-none focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-ring",
		"aria-invalid:outline-1 aria-invalid:-outline-offset-1 aria-invalid:outline-destructive",
	].join(" "),
	{
		variants: {
			variant: {
				default:
					"bg-primary text-primary-foreground shadow-solid hover:bg-primary/90",
				accent:
					"bg-indigo text-indigo-foreground shadow-solid hover:bg-indigo/90",
				destructive:
					"bg-destructive text-white shadow-solid hover:bg-destructive/90 focus-visible:outline-destructive",
				success: "bg-success text-white shadow-solid hover:bg-success/90",
				purple: "bg-merge text-white shadow-solid hover:bg-merge-hover",
				gold: "bg-warning text-neutral-950 shadow-solid hover:bg-warning/90",
				outline:
					"bg-button text-foreground shadow-button hover:bg-button-hover",
				secondary:
					"bg-secondary text-secondary-foreground hover:bg-row-selected",
				subtle: "bg-muted text-secondary-foreground hover:bg-row-selected",
				ghost: "hover:bg-ghost-hover hover:text-accent-foreground",
				link: "text-primary underline-offset-4 hover:underline",
			},
			size: {
				default: "h-8 px-3.5 py-2",
				xxs: "h-6 rounded-md gap-1.5 px-2.5",
				xs: "h-7 rounded-md gap-1.5 px-2.5",
				sm: "h-7 rounded-md gap-1.5 px-3",
				lg: "h-9 rounded-md px-5",
				icon: "size-8",
				"icon-sm": "size-6",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

type ButtonIcon = React.ReactNode;

function Button({
	children,
	className,
	variant,
	size,
	asChild = false,
	iconLeft,
	iconRight,
	disabled,
	onClickCapture,
	tabIndex,
	"aria-disabled": ariaDisabled,
	...props
}: React.ComponentProps<"button"> &
	VariantProps<typeof buttonVariants> & {
		asChild?: boolean;
		iconLeft?: ButtonIcon;
		iconRight?: ButtonIcon;
	}) {
	const Comp = asChild ? Slot : "button";

	// A slotted child (e.g. a router link) has no native `disabled`, so make it
	// inert by hand: aria-disabled, out of the tab order, and clicks swallowed.
	const disabledAsChild = asChild && disabled;
	const slottedChildren =
		disabledAsChild &&
		React.isValidElement<{
			onClickCapture?: React.MouseEventHandler;
			tabIndex?: number;
			"aria-disabled"?: React.AriaAttributes["aria-disabled"];
			"data-disabled"?: string;
		}>(children)
			? React.cloneElement(children, {
					"aria-disabled": true,
					"data-disabled": "",
					onClickCapture: undefined,
					tabIndex: -1,
				})
			: children;

	return (
		<Comp
			data-slot="button"
			data-disabled={disabledAsChild ? "" : undefined}
			aria-disabled={disabledAsChild || ariaDisabled || undefined}
			disabled={asChild ? undefined : disabled}
			tabIndex={disabledAsChild ? -1 : tabIndex}
			onClickCapture={
				disabledAsChild
					? (event: React.MouseEvent) => {
							event.preventDefault();
							event.stopPropagation();
						}
					: onClickCapture
			}
			className={cn(buttonVariants({ variant, size, className }))}
			{...props}
		>
			{iconLeft ? (
				<span
					data-slot="button-icon"
					data-side="left"
					aria-hidden="true"
					className="flex shrink-0 items-center"
				>
					{iconLeft}
				</span>
			) : null}
			<Slottable>{slottedChildren}</Slottable>
			{iconRight ? (
				<span
					data-slot="button-icon"
					data-side="right"
					aria-hidden="true"
					className="flex shrink-0 items-center"
				>
					{iconRight}
				</span>
			) : null}
		</Comp>
	);
}

export { Button, buttonVariants };
