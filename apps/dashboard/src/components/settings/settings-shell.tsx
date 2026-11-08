import type * as React from "react";

export function SettingsShell({
	navLabel,
	nav,
	children,
}: {
	navLabel: string;
	nav: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<div className="mx-auto grid w-full max-w-4xl gap-6 px-4 py-6 lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-10 lg:px-6 lg:py-8">
			<nav
				aria-label={navLabel}
				className="no-scrollbar -mx-1 flex h-fit gap-1 overflow-x-auto px-1 lg:sticky lg:top-0 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0"
			>
				{nav}
			</nav>
			<div className="flex min-w-0 flex-col gap-8">{children}</div>
		</div>
	);
}

export function SettingsHeading({
	title,
	description,
	actions,
}: {
	title: string;
	description?: string;
	actions?: React.ReactNode;
}) {
	return (
		<div className="flex items-start justify-between gap-4">
			<div className="flex min-w-0 flex-col gap-1">
				<h2 className="text-lg font-semibold tracking-tight text-foreground">
					{title}
				</h2>
				{description ? (
					<p className="text-[13px] text-pretty text-muted-foreground">
						{description}
					</p>
				) : null}
			</div>
			{actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
		</div>
	);
}
