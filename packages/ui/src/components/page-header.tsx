import { Slot } from "@radix-ui/react-slot";
import type * as React from "react";

import { cn } from "../lib/utils";

/**
 * A page's first row, as Linear draws it: 44px, a hairline under it, what
 * you're looking at on the left (a title or a breadcrumb, 13px medium) and
 * its actions on the right.
 */
function PageHeader({
	className,
	children,
	actions,
	...props
}: Omit<React.ComponentProps<"header">, "title"> & {
	actions?: React.ReactNode;
}) {
	return (
		<header
			data-slot="page-header"
			className={cn(
				"flex h-11 shrink-0 items-center gap-2 border-b-[0.5px] border-header-rule pr-2 pl-5 max-md:pl-3",
				className,
			)}
			{...props}
		>
			<div className="flex min-w-0 flex-1 items-center text-[13px] font-medium text-text-header">
				{children}
			</div>
			{actions ? (
				<div className="flex shrink-0 items-center gap-1 text-muted-foreground">
					{actions}
				</div>
			) : null}
		</header>
	);
}

/** A link back up the breadcrumb (pass a router link with `asChild`), then the › after it. */
function PageHeaderCrumb({
	className,
	asChild = false,
	...props
}: React.ComponentProps<"a"> & { asChild?: boolean }) {
	const Comp = asChild ? Slot : "a";
	// The crumb and its › live in one wrapper, so `className` (e.g. a
	// responsive `hidden`) applies to both.
	return (
		<span className={cn("flex min-w-0 shrink items-center", className)}>
			<Comp
				data-slot="page-header-crumb"
				className="flex min-w-0 shrink items-center gap-1.5 truncate rounded-md transition-colors hover:text-foreground [&_svg]:shrink-0"
				{...props}
			/>
			<span aria-hidden className="mx-2 shrink-0 text-muted-foreground">
				›
			</span>
		</span>
	);
}

/**
 * The page's own name at the end of the breadcrumb: the page's h1, unless the
 * page has its own big title (a detail page) — then pass `asChild` with a span.
 */
function PageHeaderTitle({
	className,
	asChild = false,
	...props
}: React.ComponentProps<"h1"> & { asChild?: boolean }) {
	const Comp = asChild ? Slot : "h1";
	return (
		<Comp
			data-slot="page-header-title"
			className={cn(
				"flex min-w-0 items-center gap-1.5 truncate text-[13px] font-medium text-text-header [&_svg]:shrink-0",
				className,
			)}
			{...props}
		/>
	);
}

/** A muted count after the title. */
function PageHeaderCount({
	className,
	...props
}: React.ComponentProps<"span">) {
	return (
		<span
			data-slot="page-header-count"
			className={cn(
				"ml-2 shrink-0 text-[13px] font-[450] tabular-nums text-muted-foreground",
				className,
			)}
			{...props}
		/>
	);
}

/** A round 28px icon button for the header and tab rows; `raised` gives it the pill fill and ring. */
function PageIconButton({
	className,
	raised = false,
	asChild = false,
	...props
}: React.ComponentProps<"button"> & { raised?: boolean; asChild?: boolean }) {
	const Comp = asChild ? Slot : "button";
	return (
		<Comp
			data-slot="page-icon-button"
			className={cn(
				"flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
				raised
					? "bg-button shadow-button hover:bg-button-hover"
					: "hover:bg-ghost-hover",
				className,
			)}
			{...props}
		/>
	);
}

export {
	PageHeader,
	PageHeaderCount,
	PageHeaderCrumb,
	PageHeaderTitle,
	PageIconButton,
};
