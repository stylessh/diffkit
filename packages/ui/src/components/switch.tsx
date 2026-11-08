"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";
import type * as React from "react";

import { cn } from "../lib/utils";

function Switch({
	className,
	...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
	return (
		<SwitchPrimitive.Root
			data-slot="switch"
			className={cn(
				"peer relative inline-flex h-3.5 w-[22px] shrink-0 items-center rounded-full transition-colors outline-none after:absolute after:-inset-1 after:content-[''] focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-ring focus-visible:outline-offset-2 data-[state=checked]:bg-indigo data-[state=unchecked]:bg-pill-neutral data-[state=unchecked]:shadow-chip disabled:cursor-not-allowed disabled:opacity-50",
				className,
			)}
			{...props}
		>
			<SwitchPrimitive.Thumb
				data-slot="switch-thumb"
				className={cn(
					"pointer-events-none block size-[11px] rounded-full bg-white shadow-sm ring-0 transition-transform data-[state=checked]:translate-x-[9.5px] data-[state=unchecked]:translate-x-[1.5px]",
				)}
			/>
		</SwitchPrimitive.Root>
	);
}

export { Switch };
