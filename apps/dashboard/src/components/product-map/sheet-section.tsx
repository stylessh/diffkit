import type { ReactNode } from "react";

export function SheetSection({
	title,
	aside,
	children,
}: {
	title: string;
	aside?: ReactNode;
	children: ReactNode;
}) {
	return (
		<section className="flex flex-col gap-3">
			<div className="flex items-baseline justify-between gap-3">
				<h3 className="font-medium text-[13px] text-text-header">{title}</h3>
				{aside ? (
					<span className="text-muted-foreground text-xs">{aside}</span>
				) : null}
			</div>
			{children}
		</section>
	);
}
