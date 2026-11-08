import type * as React from "react";

import { cn } from "../lib/utils";
import { Label } from "./label";

function SectionCard({
	title,
	description,
	className,
	children,
}: {
	title?: React.ReactNode;
	description?: React.ReactNode;
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<section
			data-slot="section-card"
			className={cn(
				"overflow-hidden rounded-lg bg-card shadow-card",
				className,
			)}
		>
			{title != null ? (
				<div className="border-b-[0.5px] border-rule bg-group/60 px-4 py-3">
					<h3 className="text-sm font-medium text-foreground">{title}</h3>
					{description != null ? (
						<p className="mt-0.5 text-xs text-pretty text-muted-foreground">
							{description}
						</p>
					) : null}
				</div>
			) : null}
			<div className="divide-y-[0.5px] divide-rule pb-1.5">{children}</div>
		</section>
	);
}

function SectionRow({
	label,
	description,
	htmlFor,
	control,
	stacked,
	className,
}: {
	label: React.ReactNode;
	description?: React.ReactNode;
	htmlFor?: string;
	control: React.ReactNode;
	stacked?: boolean;
	className?: string;
}) {
	const labelEl = htmlFor ? (
		<Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
			{label}
		</Label>
	) : (
		<span className="text-sm font-medium text-foreground">{label}</span>
	);
	if (stacked) {
		return (
			<div
				className={cn(
					"flex flex-col gap-1.5 px-4 py-3.5 first:pt-3 last:pb-4 md:gap-3",
					className,
				)}
			>
				<div className="space-y-0.5">
					{labelEl}
					{description ? (
						<p className="text-xs text-pretty text-muted-foreground">
							{description}
						</p>
					) : null}
				</div>
				<div className="min-w-0 w-full">{control}</div>
			</div>
		);
	}
	return (
		<div
			className={cn(
				"flex flex-col items-stretch gap-3 px-4 py-3 first:pt-3 last:pb-4 md:flex-row md:items-center md:justify-between md:gap-4",
				// Mobile: Switch stays in a row; selects, inputs, and other wide controls stack.
				"max-md:has-[[data-slot=switch]]:flex-row max-md:has-[[data-slot=switch]]:items-center max-md:has-[[data-slot=switch]]:justify-between",
				className,
			)}
		>
			<div className="flex min-w-0 w-full flex-col gap-1 md:min-w-[10rem] md:flex-1 md:gap-0.5">
				{labelEl}
				{description ? (
					<p className="text-xs text-pretty text-muted-foreground">
						{description}
					</p>
				) : null}
			</div>
			<div
				className={cn(
					"flex min-w-0 w-full items-center justify-start md:max-w-[60%] md:flex-1 md:justify-end md:self-center",
					"max-md:has-[[data-slot=switch]]:w-auto",
					"max-md:[&_[data-slot=select-trigger]]:w-full",
				)}
			>
				{control}
			</div>
		</div>
	);
}

export { SectionCard, SectionRow };
