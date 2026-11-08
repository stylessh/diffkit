"use client";

import { ChevronDownIcon } from "@diffkit/icons";
import {
	MessageScroller as MessageScrollerPrimitive,
	useMessageScroller,
	useMessageScrollerScrollable,
	useMessageScrollerVisibility,
} from "@shadcn/react/message-scroller";
import type * as React from "react";

import { cn } from "../lib/utils";
import { Button } from "./button";

function MessageScrollerProvider(
	props: React.ComponentProps<typeof MessageScrollerPrimitive.Provider>,
) {
	return <MessageScrollerPrimitive.Provider {...props} />;
}

function MessageScroller({
	className,
	...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Root>) {
	return (
		<MessageScrollerPrimitive.Root
			data-slot="message-scroller"
			className={cn(
				"group/message-scroller relative flex size-full min-h-0 flex-col overflow-hidden",
				className,
			)}
			{...props}
		/>
	);
}

function MessageScrollerViewport({
	className,
	...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Viewport>) {
	return (
		<MessageScrollerPrimitive.Viewport
			data-slot="message-scroller-viewport"
			className={cn(
				"size-full min-h-0 min-w-0 overflow-y-auto overscroll-contain [scrollbar-gutter:stable] [contain:content] data-autoscrolling:[scrollbar-width:none] data-autoscrolling:[&::-webkit-scrollbar]:hidden",
				className,
			)}
			{...props}
		/>
	);
}

function MessageScrollerContent({
	className,
	...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Content>) {
	return (
		<MessageScrollerPrimitive.Content
			data-slot="message-scroller-content"
			className={cn("flex h-max min-h-full flex-col gap-7", className)}
			{...props}
		/>
	);
}

function MessageScrollerItem({
	className,
	scrollAnchor = false,
	...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Item>) {
	return (
		<MessageScrollerPrimitive.Item
			data-slot="message-scroller-item"
			scrollAnchor={scrollAnchor}
			className={cn(
				"min-w-0 shrink-0 [contain-intrinsic-size:auto_10rem] [content-visibility:auto]",
				className,
			)}
			{...props}
		/>
	);
}

function MessageScrollerButton({
	direction = "end",
	className,
	children,
	render,
	...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Button>) {
	return (
		<MessageScrollerPrimitive.Button
			data-slot="message-scroller-button"
			data-direction={direction}
			direction={direction}
			className={cn(
				"absolute inset-s-1/2 z-20 -translate-x-1/2 transition-[translate,scale,opacity] duration-200 data-[active=false]:pointer-events-none data-[active=false]:scale-95 data-[active=false]:opacity-0 data-[active=true]:translate-y-0 data-[active=true]:scale-100 data-[active=true]:opacity-100 data-[direction=end]:bottom-4 data-[direction=end]:data-[active=false]:translate-y-full data-[direction=start]:top-4 data-[direction=start]:data-[active=false]:-translate-y-full data-[direction=start]:[&_svg]:rotate-180 rtl:translate-x-1/2",
				className,
			)}
			render={
				render ?? (
					<Button
						variant="secondary"
						size="icon"
						className="size-8 rounded-full bg-button shadow-button hover:bg-button-hover"
					/>
				)
			}
			{...props}
		>
			{children ?? (
				<>
					<ChevronDownIcon size={15} strokeWidth={2} />
					<span className="sr-only">
						{direction === "end" ? "Scroll to latest" : "Scroll to start"}
					</span>
				</>
			)}
		</MessageScrollerPrimitive.Button>
	);
}

export {
	MessageScroller,
	MessageScrollerButton,
	MessageScrollerContent,
	MessageScrollerItem,
	MessageScrollerProvider,
	MessageScrollerViewport,
	useMessageScroller,
	useMessageScrollerScrollable,
	useMessageScrollerVisibility,
};
