"use client";

import * as HoverCardPrimitive from "@radix-ui/react-hover-card";
import type * as React from "react";

import { liftedPopoverSurfaceClassName } from "../lib/lifted-overlay-surface";
import { cn } from "../lib/utils";

function HoverCard({
	openDelay = 500,
	closeDelay = 100,
	...props
}: React.ComponentProps<typeof HoverCardPrimitive.Root>) {
	return (
		<HoverCardPrimitive.Root
			data-slot="hover-card"
			openDelay={openDelay}
			closeDelay={closeDelay}
			{...props}
		/>
	);
}

function HoverCardTrigger({
	...props
}: React.ComponentProps<typeof HoverCardPrimitive.Trigger>) {
	return (
		<HoverCardPrimitive.Trigger data-slot="hover-card-trigger" {...props} />
	);
}

function HoverCardContent({
	className,
	align = "center",
	sideOffset = 6,
	...props
}: React.ComponentProps<typeof HoverCardPrimitive.Content>) {
	return (
		<HoverCardPrimitive.Portal>
			<HoverCardPrimitive.Content
				data-slot="hover-card-content"
				align={align}
				sideOffset={sideOffset}
				className={cn(
					liftedPopoverSurfaceClassName,
					// No open/close animation — hover cards appear instantly for a faster feel.
					"pointer-events-auto z-[100] w-96 rounded-lg p-0 outline-hidden",
					className,
				)}
				{...props}
			/>
		</HoverCardPrimitive.Portal>
	);
}

export { HoverCard, HoverCardContent, HoverCardTrigger };
