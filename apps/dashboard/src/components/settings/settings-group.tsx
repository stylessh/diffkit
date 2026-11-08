import { cn } from "@diffkit/ui/lib/utils";
import type * as React from "react";

export { SectionRow as SettingsRow } from "@diffkit/ui/components/section-card";

export function SettingsGroup({
	title,
	description,
	actions,
	className,
	children,
}: {
	title?: React.ReactNode;
	description?: React.ReactNode;
	actions?: React.ReactNode;
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<section
			className={cn(
				"overflow-hidden rounded-lg bg-card shadow-card",
				className,
			)}
		>
			{title ? (
				<div className="flex items-center justify-between gap-3 border-b-[0.5px] border-rule bg-group/60 px-4 py-3">
					<div className="min-w-0">
						<h3 className="text-sm font-medium text-foreground">{title}</h3>
						{description ? (
							<p className="mt-0.5 text-xs text-pretty text-muted-foreground">
								{description}
							</p>
						) : null}
					</div>
					{actions ? (
						<div className="flex shrink-0 items-center gap-2">{actions}</div>
					) : null}
				</div>
			) : null}
			<div className="divide-y-[0.5px] divide-rule">{children}</div>
		</section>
	);
}

export function SettingsListRow({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"flex min-h-11 flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2",
				className,
			)}
			{...props}
		/>
	);
}

export function SettingsEmptyRow({ children }: { children: React.ReactNode }) {
	return (
		<p className="px-4 py-6 text-center text-[13px] text-muted-foreground">
			{children}
		</p>
	);
}
