import {
	ChevronLeftIcon,
	ChevronRightIcon,
	MoreHorizontalIcon,
} from "@diffkit/icons";
import { Slot } from "@radix-ui/react-slot";
import type * as React from "react";

import {
	segmentedTriggerBaseClassName,
	segmentedTriggerSelectedClassName,
} from "../lib/segmented-control-classes";
import { cn } from "../lib/utils";

/** Row of independent 28px pills (Linear tabs), no shared track. */
const paginationTrackClassName =
	"m-0 inline-flex min-w-0 w-fit shrink-0 flex-row items-center gap-1";

const paginationGroupClassName = cn(paginationTrackClassName, "list-none");

const paginationTriggerClassName = cn(
	segmentedTriggerBaseClassName,
	"h-7 min-w-7 px-2 py-0",
	// Active thumb swaps instantly — background transitions leave the old page
	// looking selected (foreground text) without its rounded capsule.
	"transition-none",
);

function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
	return (
		<nav
			aria-label="pagination"
			data-slot="pagination"
			className={cn("mx-auto flex w-full justify-center", className)}
			{...props}
		/>
	);
}

function PaginationContent({
	className,
	...props
}: React.ComponentProps<"ul">) {
	return (
		<ul
			data-slot="pagination-content"
			className={cn(paginationGroupClassName, className)}
			{...props}
		/>
	);
}

function PaginationItem({ className, ...props }: React.ComponentProps<"li">) {
	return (
		<li
			data-slot="pagination-item"
			className={cn("flex", className)}
			{...props}
		/>
	);
}

type PaginationLinkProps = React.ComponentProps<"button"> & {
	isActive?: boolean;
	asChild?: boolean;
};

function PaginationLink({
	className,
	isActive,
	asChild = false,
	disabled,
	...props
}: PaginationLinkProps) {
	const Comp = asChild ? Slot : "button";

	return (
		<Comp
			type={asChild ? undefined : "button"}
			aria-current={isActive ? "page" : undefined}
			data-slot="pagination-link"
			data-active={isActive ? "true" : undefined}
			disabled={disabled}
			className={cn(
				paginationTriggerClassName,
				isActive
					? cn(segmentedTriggerSelectedClassName, "relative z-10")
					: null,
				className,
			)}
			{...props}
		/>
	);
}

function PaginationPrevious({
	className,
	...props
}: React.ComponentProps<typeof PaginationLink>) {
	return (
		<PaginationLink
			aria-label="Go to previous page"
			className={cn("px-1.5", className)}
			{...props}
		>
			<ChevronLeftIcon size={14} />
			<span className="sr-only">Previous</span>
		</PaginationLink>
	);
}

function PaginationNext({
	className,
	...props
}: React.ComponentProps<typeof PaginationLink>) {
	return (
		<PaginationLink
			aria-label="Go to next page"
			className={cn("px-1.5", className)}
			{...props}
		>
			<ChevronRightIcon size={14} />
			<span className="sr-only">Next</span>
		</PaginationLink>
	);
}

function PaginationEllipsis({
	className,
	...props
}: React.ComponentProps<"span">) {
	return (
		<span
			aria-hidden
			data-slot="pagination-ellipsis"
			className={cn(
				paginationTriggerClassName,
				"pointer-events-none min-w-7 text-muted-foreground",
				className,
			)}
			{...props}
		>
			<MoreHorizontalIcon size={14} />
			<span className="sr-only">More pages</span>
		</span>
	);
}

export type { PaginationLinkProps };
export {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
};
