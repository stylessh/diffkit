"use client";

import { SearchIcon } from "@diffkit/icons";
import { Command as CommandPrimitive } from "cmdk";
import type * as React from "react";

import { cn } from "../lib/utils";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "./dialog";
import { KeyboardShortcutKeys } from "./keyboard-shortcut-keys";

function Command({
	className,
	...props
}: React.ComponentProps<typeof CommandPrimitive>) {
	return (
		<CommandPrimitive
			className={cn(
				"flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground",
				className,
			)}
			data-slot="command"
			{...props}
		/>
	);
}

function CommandDialog({
	title = "Command Palette",
	description = "Search for a command to run...",
	children,
	...props
}: React.ComponentProps<typeof Dialog> & {
	title?: string;
	description?: string;
}) {
	return (
		<Dialog {...props}>
			<DialogHeader className="sr-only">
				<DialogTitle>{title}</DialogTitle>
				<DialogDescription>{description}</DialogDescription>
			</DialogHeader>
			<DialogContent className="top-[20%] translate-y-0 overflow-hidden p-0 sm:max-w-2xl">
				<Command className="**:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-items]]:flex [&_[cmdk-group-items]]:flex-col [&_[cmdk-group-items]]:gap-0.5 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:h-9 [&_[cmdk-item]]:px-2 [&_[cmdk-item]_svg:not([class*='size-'])]:h-5 [&_[cmdk-item]_svg:not([class*='size-'])]:w-5">
					{children}
				</Command>
			</DialogContent>
		</Dialog>
	);
}

function CommandInput({
	className,
	...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
	return (
		<div
			className="flex h-9 items-center gap-2 border-popover-border border-b-[0.5px] px-3"
			data-slot="command-input-wrapper"
		>
			<SearchIcon className="size-4 shrink-0 opacity-50" />
			<CommandPrimitive.Input
				className={cn(
					"flex h-10 w-full rounded-md bg-transparent py-3 font-[450] text-[13px] outline-hidden placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
					className,
				)}
				data-slot="command-input"
				{...props}
			/>
		</div>
	);
}

/** The bare cmdk input, for a palette that lays out its own field. */
function CommandBareInput(
	props: React.ComponentProps<typeof CommandPrimitive.Input>,
) {
	return <CommandPrimitive.Input data-slot="command-input" {...props} />;
}

function CommandList({
	className,
	...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
	return (
		<CommandPrimitive.List
			className={cn(
				"max-h-[400px] scroll-py-1 overflow-y-auto overflow-x-hidden pb-1",
				className,
			)}
			data-slot="command-list"
			{...props}
		/>
	);
}

function CommandEmpty({
	...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
	return (
		<CommandPrimitive.Empty
			className="py-6 text-center text-sm"
			data-slot="command-empty"
			{...props}
		/>
	);
}

function CommandGroup({
	className,
	...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
	return (
		<CommandPrimitive.Group
			className={cn(
				"overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:text-xs",
				className,
			)}
			data-slot="command-group"
			{...props}
		/>
	);
}

function CommandSeparator({
	className,
	...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
	return (
		<CommandPrimitive.Separator
			className={cn("-mx-1 h-px bg-popover-border", className)}
			data-slot="command-separator"
			{...props}
		/>
	);
}

function CommandItem({
	className,
	...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
	return (
		<CommandPrimitive.Item
			className={cn(
				"relative flex h-8 cursor-default select-none items-center gap-2 rounded-lg px-2 font-[450] text-[13px] text-text-header outline-hidden data-[disabled=true]:pointer-events-none data-[selected=true]:bg-menu-hover data-[selected=true]:text-foreground data-[disabled=true]:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0",
				className,
			)}
			data-slot="command-item"
			{...props}
		/>
	);
}

function CommandShortcut({
	className,
	keys,
	children,
	...props
}: React.ComponentProps<"span"> & {
	keys?: string[];
}) {
	const content = keys ? <KeyboardShortcutKeys keys={keys} /> : children;

	return (
		<span
			className={cn(
				"ml-auto flex items-center gap-1 text-[11px] text-muted-foreground",
				className,
			)}
			data-slot="command-shortcut"
			{...props}
		>
			{content}
		</span>
	);
}

export {
	Command,
	CommandBareInput,
	CommandDialog,
	CommandInput,
	CommandList,
	CommandEmpty,
	CommandGroup,
	CommandItem,
	CommandShortcut,
	CommandSeparator,
};
