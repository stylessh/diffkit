"use client";

import * as SheetPrimitive from "@radix-ui/react-dialog";
import type * as React from "react";

import { cn } from "../lib/utils";

function SideSheet(props: React.ComponentProps<typeof SheetPrimitive.Root>) {
	return <SheetPrimitive.Root data-slot="side-sheet" {...props} />;
}

function SideSheetContent({
	className,
	children,
	title,
	...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & { title: string }) {
	return (
		<SheetPrimitive.Portal>
			<SheetPrimitive.Overlay
				data-slot="side-sheet-overlay"
				className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-scrim"
			/>
			<SheetPrimitive.Content
				data-slot="side-sheet-content"
				aria-describedby={undefined}
				className={cn(
					"data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left fixed inset-y-0 left-0 z-50 flex w-[300px] max-w-[85vw] flex-col bg-shell shadow-popover outline-none data-[state=closed]:duration-200 data-[state=open]:duration-200",
					className,
				)}
				{...props}
			>
				<SheetPrimitive.Title className="sr-only">{title}</SheetPrimitive.Title>
				{children}
			</SheetPrimitive.Content>
		</SheetPrimitive.Portal>
	);
}

export { SideSheet, SideSheetContent };
