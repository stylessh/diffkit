import { CodeIcon, GitCommitIcon } from "@diffkit/icons";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@diffkit/ui/components/hover-card";
import type { ReactNode } from "react";
import { formatCount, plural } from "./map-format";
import { areaIcon } from "./map-icons";
import type { ProductArea } from "./product-map-types";

/** How `area` relates to the area whose page is open, in the reader's words. */
export function relationTo(area: ProductArea, current: ProductArea) {
	if (area.id === current.id) return "You are here";
	if (current.dependsOn.includes(area.id))
		return `${current.name} builds on this`;
	if (current.usedBy.includes(area.id)) return `Uses ${current.name}`;
	return null;
}

export function AreaHoverCard({
	area,
	relation,
	side = "left",
	children,
}: {
	area: ProductArea;
	relation: string | null;
	side?: "left" | "bottom";
	children: ReactNode;
}) {
	const Icon = areaIcon(area.icon);
	return (
		<HoverCard openDelay={120} closeDelay={60}>
			<HoverCardTrigger asChild>{children}</HoverCardTrigger>
			<HoverCardContent
				side={side}
				align="start"
				className="flex w-72 flex-col gap-2.5 p-3.5"
			>
				<div className="flex items-center gap-2.5">
					<span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-group text-muted-foreground">
						<Icon size={14} strokeWidth={2} />
					</span>
					<div className="flex min-w-0 flex-col">
						<span className="truncate font-medium text-[13px] text-foreground">
							{area.name}
						</span>
						{relation ? (
							<span className="truncate font-[450] text-indigo text-xs">
								{relation}
							</span>
						) : null}
					</div>
				</div>
				<p className="text-pretty text-muted-foreground text-xs leading-[1.5]">
					{area.tagline}
				</p>
				<div className="flex items-center gap-4 whitespace-nowrap font-[450] text-muted-foreground text-xs tabular-nums">
					<span className="flex items-center gap-1.5">
						<CodeIcon size={12} strokeWidth={2} />
						{formatCount(area.stats.loc)} lines
					</span>
					<span className="flex items-center gap-1.5">
						<GitCommitIcon size={12} strokeWidth={2} />
						{plural(area.stats.commitsLast30, "commit")} in 30 days
					</span>
				</div>
			</HoverCardContent>
		</HoverCard>
	);
}
