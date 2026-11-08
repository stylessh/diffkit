"use client";

import { XIcon } from "@diffkit/icons";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import type * as React from "react";
import { useSyncExternalStore } from "react";
import { Drawer as DrawerPrimitive } from "vaul";

import { liftedDialogSurfaceClassName } from "../lib/lifted-overlay-surface";
import { cn } from "../lib/utils";

// ---------------------------------------------------------------------------
// Mobile detection (shared across all dialog instances)
// ---------------------------------------------------------------------------

const MD_QUERY = "(min-width: 768px)";
const subscribe = (cb: () => void) => {
	const mql = window.matchMedia(MD_QUERY);
	mql.addEventListener("change", cb);
	return () => mql.removeEventListener("change", cb);
};
const getSnapshot = () => window.matchMedia(MD_QUERY).matches;
const getServerSnapshot = () => true;

function useIsDesktop() {
	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// ---------------------------------------------------------------------------
// Dialog — renders as Vaul Drawer on mobile, Radix Dialog on desktop
// ---------------------------------------------------------------------------

function Dialog({
	...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
	const isDesktop = useIsDesktop();

	if (!isDesktop) {
		return (
			<DrawerPrimitive.Root
				data-slot="dialog"
				open={props.open}
				defaultOpen={props.defaultOpen}
				onOpenChange={props.onOpenChange}
				modal={props.modal}
			>
				{props.children}
			</DrawerPrimitive.Root>
		);
	}

	return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({
	...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
	const isDesktop = useIsDesktop();

	if (!isDesktop) {
		return <DrawerPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
	}

	return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({
	...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
	return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({
	...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
	const isDesktop = useIsDesktop();

	if (!isDesktop) {
		return <DrawerPrimitive.Close data-slot="dialog-close" {...props} />;
	}

	return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
	className,
	...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
	return (
		<DialogPrimitive.Overlay
			data-slot="dialog-overlay"
			className={cn(
				"data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-dialog-backdrop",
				className,
			)}
			{...props}
		/>
	);
}

function DialogContent({
	className,
	children,
	showCloseButton = true,
	...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
	/** Render the corner close (×) button. Defaults to true; the mobile drawer has none. */
	showCloseButton?: boolean;
}) {
	const isDesktop = useIsDesktop();

	if (!isDesktop) {
		return (
			<DrawerPrimitive.Portal data-slot="dialog-portal">
				<DrawerPrimitive.Overlay
					data-slot="dialog-overlay"
					className="fixed inset-0 z-50 bg-dialog-backdrop"
				/>
				<DrawerPrimitive.Content
					data-slot="dialog-content"
					className={cn(
						liftedDialogSurfaceClassName,
						"fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-xl",
					)}
				>
					<div className="mx-auto mt-3 mb-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/25" />
					<div className="flex-1 overflow-auto">{children}</div>
				</DrawerPrimitive.Content>
			</DrawerPrimitive.Portal>
		);
	}

	return (
		<DialogPortal data-slot="dialog-portal">
			<DialogOverlay />
			<DialogPrimitive.Content
				data-slot="dialog-content"
				className={cn(
					liftedDialogSurfaceClassName,
					"data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 overflow-hidden rounded-xl duration-200 sm:max-w-lg",
					className,
				)}
				{...props}
			>
				{children}
				{showCloseButton ? (
					<DialogPrimitive.Close className="ring-offset-background focus:ring-ring absolute top-3.5 right-3.5 rounded-md p-1.5 text-muted-foreground/80 outline-hidden transition-colors hover:bg-accent hover:text-foreground focus:ring-2 focus:ring-offset-2 disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4">
						<XIcon />
						<span className="sr-only">Close</span>
					</DialogPrimitive.Close>
				) : null}
			</DialogPrimitive.Content>
		</DialogPortal>
	);
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="dialog-header"
			className={cn("flex flex-col gap-2 text-left", className)}
			{...props}
		/>
	);
}

/** Scrollable middle section between `DialogHeader` and `DialogFooter`. */
function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="dialog-body"
			className={cn(
				"flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-y-contain",
				className,
			)}
			{...props}
		/>
	);
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="dialog-footer"
			className={cn(
				"flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
				className,
			)}
			{...props}
		/>
	);
}

function DialogTitle({
	className,
	...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
	const isDesktop = useIsDesktop();

	if (!isDesktop) {
		return (
			<DrawerPrimitive.Title
				data-slot="dialog-title"
				className={cn("text-[15px] font-semibold tracking-tight", className)}
				{...props}
			/>
		);
	}

	return (
		<DialogPrimitive.Title
			data-slot="dialog-title"
			className={cn("text-[15px] font-semibold tracking-tight", className)}
			{...props}
		/>
	);
}

function DialogDescription({
	className,
	...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
	const isDesktop = useIsDesktop();

	if (!isDesktop) {
		return (
			<DrawerPrimitive.Description
				data-slot="dialog-description"
				className={cn("text-muted-foreground text-[13px]/5", className)}
				{...props}
			/>
		);
	}

	return (
		<DialogPrimitive.Description
			data-slot="dialog-description"
			className={cn("text-muted-foreground text-[13px]/5", className)}
			{...props}
		/>
	);
}

export {
	Dialog,
	DialogBody,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogOverlay,
	DialogPortal,
	DialogTitle,
	DialogTrigger,
};
