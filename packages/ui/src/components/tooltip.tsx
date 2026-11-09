"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type * as React from "react";
import { createContext, useContext } from "react";

import { cn } from "../lib/utils";

const HasTooltipProvider = createContext(false);

/**
 * Tooltips under one provider form a group: the first waits `delayDuration`,
 * then moving to another trigger within `skipDelayDuration` opens it at once.
 */
function TooltipProvider({
	delayDuration = 600,
	skipDelayDuration = 400,
	...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
	return (
		<HasTooltipProvider.Provider value={true}>
			<TooltipPrimitive.Provider
				data-slot="tooltip-provider"
				delayDuration={delayDuration}
				skipDelayDuration={skipDelayDuration}
				{...props}
			/>
		</HasTooltipProvider.Provider>
	);
}

function Tooltip({
	...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
	const root = <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
	if (useContext(HasTooltipProvider)) {
		return root;
	}
	return <TooltipProvider>{root}</TooltipProvider>;
}

function TooltipTrigger({
	...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
	return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
	className,
	sideOffset = 5,
	children,
	keys,
	...props
}: React.ComponentProps<typeof TooltipPrimitive.Content> & {
	keys?: readonly string[];
}) {
	return (
		<TooltipPrimitive.Portal>
			<TooltipPrimitive.Content
				className={cn(
					"data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1 z-50 flex min-h-7 w-fit max-w-xs items-center gap-2 text-balance rounded-lg bg-tooltip px-2 py-1.5 font-medium text-[11px] text-text-header leading-tight shadow-tooltip data-[state=delayed-open]:animate-in",
					className,
				)}
				data-slot="tooltip-content"
				sideOffset={sideOffset}
				{...props}
			>
				{children}
				{keys?.length ? (
					<span className="flex gap-1">
						{keys.map((key) => (
							<kbd
								className="flex h-[17px] min-w-[17px] items-center justify-center rounded-[4px] px-1 font-medium font-sans text-[11px] text-muted-foreground shadow-key"
								key={key}
							>
								{key}
							</kbd>
						))}
					</span>
				) : null}
			</TooltipPrimitive.Content>
		</TooltipPrimitive.Portal>
	);
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
