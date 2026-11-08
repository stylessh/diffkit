"use client";

import type * as React from "react";

import { cn } from "../lib/utils";
import { Label } from "./label";

function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="field-group"
			className={cn("flex flex-col gap-4", className)}
			{...props}
		/>
	);
}

function Field({
	className,
	orientation = "vertical",
	...props
}: React.ComponentProps<"div"> & { orientation?: "vertical" | "horizontal" }) {
	return (
		<div
			data-slot="field"
			data-orientation={orientation}
			className={cn(
				"flex min-w-0 gap-2",
				orientation === "horizontal"
					? "items-center justify-between"
					: "flex-col",
				"data-[invalid=true]:[&_label]:text-form-error-foreground",
				className,
			)}
			{...props}
		/>
	);
}

function FieldLabel({
	className,
	...props
}: React.ComponentProps<typeof Label>) {
	return (
		<Label
			data-slot="field-label"
			className={cn("text-sm font-medium", className)}
			{...props}
		/>
	);
}

function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
	return (
		<p
			data-slot="field-description"
			className={cn("text-muted-foreground text-sm", className)}
			{...props}
		/>
	);
}

function getErrorMessage(error: unknown) {
	if (typeof error === "string") return error;
	if (error && typeof error === "object" && "message" in error) {
		const message = (error as { message?: unknown }).message;
		if (typeof message === "string") return message;
	}
	return null;
}

function FieldError({
	className,
	errors,
	...props
}: React.ComponentProps<"div"> & { errors?: unknown[] }) {
	const messages = Array.from(
		new Set(
			(errors ?? [])
				.map(getErrorMessage)
				.filter((message): message is string => Boolean(message)),
		),
	);

	if (messages.length === 0) return null;

	return (
		<div
			data-slot="field-error"
			className={cn("text-form-error-foreground text-sm", className)}
			{...props}
		>
			{messages.map((message) => (
				<p key={message}>{message}</p>
			))}
		</div>
	);
}

export { Field, FieldDescription, FieldError, FieldGroup, FieldLabel };
