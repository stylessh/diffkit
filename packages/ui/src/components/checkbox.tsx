"use client";

import { CheckIcon } from "@diffkit/icons";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import type * as React from "react";

import { cn } from "../lib/utils";

function Checkbox({
	className,
	...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
	return (
		<CheckboxPrimitive.Root
			data-slot="checkbox"
			className={cn(
				"peer shadow-field data-[state=checked]:bg-indigo data-[state=checked]:text-indigo-foreground data-[state=checked]:shadow-none focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-ring aria-invalid:outline-1 aria-invalid:-outline-offset-1 aria-invalid:outline-destructive size-4 shrink-0 rounded-[4px] transition-[background-color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-50",
				className,
			)}
			{...props}
		>
			<CheckboxPrimitive.Indicator
				data-slot="checkbox-indicator"
				className="flex items-center justify-center text-current transition-none"
			>
				<CheckIcon className="size-3.5" />
			</CheckboxPrimitive.Indicator>
		</CheckboxPrimitive.Root>
	);
}

export { Checkbox };
