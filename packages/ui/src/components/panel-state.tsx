import type * as React from "react";

import { cn } from "../lib/utils";
import { Alert, AlertDescription } from "./alert";
import { EmptyState } from "./empty-state";

export function PanelState({
	className,
	description,
	illustration,
	title,
	children,
}: {
	children?: React.ReactNode;
	className?: string;
	description?: React.ReactNode;
	illustration: React.ReactNode;
	title: React.ReactNode;
}) {
	return (
		<div
			className={cn(
				"flex min-h-0 flex-1 items-center justify-center p-4",
				className,
			)}
		>
			<EmptyState
				className="w-full max-w-sm border-0 bg-transparent"
				description={description}
				illustration={illustration}
				title={title}
			>
				{children}
			</EmptyState>
		</div>
	);
}

export function PanelNotice({
	children,
	className,
	variant = "default",
}: {
	children: React.ReactNode;
	className?: string;
	variant?: "default" | "destructive";
}) {
	return (
		<Alert className={cn("m-2 shrink-0 py-2", className)} variant={variant}>
			<AlertDescription className="text-xs">{children}</AlertDescription>
		</Alert>
	);
}
