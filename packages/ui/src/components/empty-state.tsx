import type * as React from "react";

import { cn } from "../lib/utils";

function EmptyState({
	className,
	illustration,
	title,
	description,
	children,
}: {
	className?: string;
	illustration: React.ReactNode;
	title: React.ReactNode;
	description?: React.ReactNode;
	children?: React.ReactNode;
}) {
	return (
		<div
			data-slot="empty-state"
			className={cn(
				"flex flex-col items-center gap-3 rounded-xl bg-group px-6 py-10 text-center shadow-ring",
				className,
			)}
		>
			{illustration}
			<div className="flex flex-col gap-1">
				<p className="text-sm font-medium text-foreground">{title}</p>
				{description != null ? (
					<p className="max-w-sm text-xs text-muted-foreground">
						{description}
					</p>
				) : null}
			</div>
			{children}
		</div>
	);
}

export { EmptyState };
