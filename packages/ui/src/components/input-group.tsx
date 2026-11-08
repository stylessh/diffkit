"use client";

import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "../lib/utils";
import { buttonVariants } from "./button";
import { Input } from "./input";
import { Textarea } from "./textarea";

function InputGroup({
	className,
	unstyled,
	...props
}: React.ComponentProps<"div"> & { unstyled?: boolean }) {
	return (
		<div
			data-slot="input-group"
			className={cn(
				"group/input-group flex h-8 w-full min-w-0 max-w-full items-stretch overflow-hidden text-[13px]",
				"has-[data-slot=textarea]:h-auto has-[data-slot=textarea]:min-h-0 has-[data-slot=textarea]:flex-col",
				"has-[data-slot=textarea]:items-stretch",
				!unstyled &&
					"rounded-md bg-transparent shadow-field focus-within:outline-1 focus-within:-outline-offset-1 focus-within:outline-ring",
				className,
			)}
			{...props}
		/>
	);
}

const inputGroupAddonVariants = cva(
	"text-muted-foreground flex h-8 min-h-0 shrink-0 items-center justify-center gap-1.5 text-[13px] font-medium select-none [&>svg]:pointer-events-none [&>svg:not([class*='size-'])]:size-4",
	{
		variants: {
			align: {
				"inline-start": "order-first pl-2.5 pr-1.5",
				"inline-end": "order-last pl-1.5 pr-2.5",
				"block-start":
					"order-first w-full items-stretch border-rule border-b-[0.5px] px-3 py-2",
				"block-end":
					"order-last w-full items-center justify-between border-rule border-t-[0.5px] px-3 py-2",
			},
		},
		defaultVariants: {
			align: "inline-start",
		},
	},
);

function focusControlInGroup(
	e: React.MouseEvent<HTMLDivElement> | React.SyntheticEvent<HTMLDivElement>,
) {
	if (
		(e.target as HTMLElement).closest("button, a, select, [data-slot=checkbox]")
	) {
		return;
	}
	const group = (e.currentTarget as HTMLElement).closest(
		'[data-slot="input-group"]',
	);
	const control = group?.querySelector<HTMLElement>(
		'[data-slot="input"],[data-slot="textarea"]',
	);
	control?.focus();
}

const InputGroupAddon = function InputGroupAddon({
	className,
	align = "inline-start",
	onClick,
	ref,
	...props
}: React.ComponentProps<"div"> &
	VariantProps<typeof inputGroupAddonVariants> & {
		ref?: React.Ref<HTMLDivElement>;
	}) {
	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: click forwards focus to the text field, matching shadcn input-group
		<div
			ref={ref}
			role="presentation"
			data-slot="input-group-addon"
			data-align={align}
			className={cn(inputGroupAddonVariants({ align }), className)}
			onClick={(e) => {
				focusControlInGroup(e);
				onClick?.(e);
			}}
			{...props}
		/>
	);
};
InputGroupAddon.displayName = "InputGroupAddon";

const inputGroupButtonVariants = cva("", {
	variants: {
		size: {
			xs: "h-6 min-h-6 gap-1 rounded-md px-2 text-xs [&>svg]:size-3.5",
			sm: "h-8 min-h-8 gap-1.5 rounded-md px-2.5",
			"icon-xs": "size-6 min-h-6 min-w-6 rounded-md p-0 [&>svg]:size-3.5",
			"icon-sm": "size-8 min-h-8 min-w-8 rounded-md p-0",
		},
	},
	defaultVariants: {
		size: "icon-xs",
	},
});

const InputGroupButton = function InputGroupButton({
	type = "button",
	variant = "ghost",
	size = "icon-xs",
	className,
	ref,
	...props
}: React.ComponentProps<"button"> &
	VariantProps<typeof inputGroupButtonVariants> & {
		variant?: NonNullable<VariantProps<typeof buttonVariants>["variant"]>;
	} & { ref?: React.Ref<HTMLButtonElement> }) {
	return (
		<button
			ref={ref}
			type={type}
			data-slot="input-group-button"
			className={cn(
				buttonVariants({ variant }),
				inputGroupButtonVariants({ size }),
				variant === "ghost" || variant === "link" ? "!shadow-none" : null,
				"shrink-0",
				className,
			)}
			{...props}
		/>
	);
};
InputGroupButton.displayName = "InputGroupButton";

function InputGroupText({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span
			data-slot="input-group-text"
			className={cn("text-sm text-foreground ", className)}
			{...props}
		/>
	);
}

const InputGroupInput = function InputGroupInput({
	className,
	ref,
	...props
}: React.ComponentProps<"input"> & {
	ref?: React.Ref<HTMLInputElement>;
}) {
	return (
		<Input
			ref={ref}
			className={cn(
				"h-9 min-h-0 min-w-0 flex-1 rounded-none border-0 bg-transparent pl-1 pr-0.5 py-0",
				"!shadow-none focus-visible:ring-0",
				className,
			)}
			{...props}
		/>
	);
};
InputGroupInput.displayName = "InputGroupInput";

const InputGroupTextarea = function InputGroupTextarea({
	className,
	ref,
	...props
}: React.ComponentProps<"textarea"> & {
	ref?: React.Ref<HTMLTextAreaElement>;
}) {
	return (
		<Textarea
			ref={ref}
			className={cn(
				"min-h-16 w-full flex-1 resize-y rounded-none border-0 bg-transparent",
				"!shadow-none",
				"px-3 py-2",
				"focus-visible:ring-0",
				className,
			)}
			{...props}
		/>
	);
};
InputGroupTextarea.displayName = "InputGroupTextarea";

export {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
	InputGroupText,
	InputGroupTextarea,
	inputGroupAddonVariants,
	inputGroupButtonVariants,
};
