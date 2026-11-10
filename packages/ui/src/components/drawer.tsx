"use client";

import type * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";

import { cn } from "../lib/utils";

function Drawer({
	...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) {
	return <DrawerPrimitive.Root data-slot="drawer" {...props} />;
}

function DrawerTrigger({
	...props
}: React.ComponentProps<typeof DrawerPrimitive.Trigger>) {
	return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}

function DrawerClose({
	...props
}: React.ComponentProps<typeof DrawerPrimitive.Close>) {
	return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />;
}

function DrawerPortal({
	...props
}: React.ComponentProps<typeof DrawerPrimitive.Portal>) {
	return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />;
}

function DrawerOverlay({
	className,
	...props
}: React.ComponentProps<typeof DrawerPrimitive.Overlay>) {
	return (
		<DrawerPrimitive.Overlay
			data-slot="drawer-overlay"
			className={cn("fixed inset-0 z-50 bg-sheet-backdrop", className)}
			{...props}
		/>
	);
}

function DrawerContent({
	className,
	children,
	...props
}: React.ComponentProps<typeof DrawerPrimitive.Content>) {
	return (
		<DrawerPortal>
			<DrawerOverlay />
			<DrawerPrimitive.Content
				data-slot="drawer-content"
				className={cn(
					"fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-xl bg-popover text-popover-foreground shadow-popover",
					className,
				)}
				{...props}
			>
				<div className="mx-auto mt-3 mb-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/25" />
				{children}
			</DrawerPrimitive.Content>
		</DrawerPortal>
	);
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="drawer-header"
			className={cn("flex flex-col gap-1.5 px-4 pb-2", className)}
			{...props}
		/>
	);
}

function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="drawer-footer"
			className={cn("mt-auto flex flex-col gap-2 p-4", className)}
			{...props}
		/>
	);
}

function DrawerTitle({
	className,
	...props
}: React.ComponentProps<typeof DrawerPrimitive.Title>) {
	return (
		<DrawerPrimitive.Title
			data-slot="drawer-title"
			className={cn("text-foreground font-semibold", className)}
			{...props}
		/>
	);
}

function DrawerDescription({
	className,
	...props
}: React.ComponentProps<typeof DrawerPrimitive.Description>) {
	return (
		<DrawerPrimitive.Description
			data-slot="drawer-description"
			className={cn("text-muted-foreground text-sm", className)}
			{...props}
		/>
	);
}

/**
 * Drawer content that handles its own taps, such as a file tree. A touch that
 * starts here never reaches vaul's drag start, which captures the pointer on
 * the event target: for a tree inside a shadow root that is the host, and iOS
 * then sends the tap to the host instead of the row. The handle and header
 * still drag the drawer.
 */
function DrawerNoDrag({
	className,
	onPointerDown,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			data-vaul-no-drag
			data-slot="drawer-no-drag"
			className={cn("flex min-h-0 flex-1 flex-col", className)}
			onPointerDown={(event) => {
				onPointerDown?.(event);
				event.stopPropagation();
			}}
			{...props}
		/>
	);
}

export {
	Drawer,
	DrawerNoDrag,
	DrawerTrigger,
	DrawerClose,
	DrawerPortal,
	DrawerOverlay,
	DrawerContent,
	DrawerHeader,
	DrawerFooter,
	DrawerTitle,
	DrawerDescription,
};
