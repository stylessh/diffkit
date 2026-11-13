import { FileIcon, GitMergeIcon } from "@diffkit/icons";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@diffkit/ui/components/hover-card";
import type { ReactNode } from "react";
import type { AreaActivity } from "#/lib/product-map/activity";
import { plural } from "./map-format";
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
	live,
	relation,
	side = "left",
	children,
}: {
	area: ProductArea;
	live: AreaActivity | undefined;
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
				{live ? (
					<div className="flex items-center gap-4 whitespace-nowrap font-[450] text-muted-foreground text-xs tabular-nums">
						<span className="flex items-center gap-1.5">
							<FileIcon size={12} strokeWidth={2} />
							{plural(live.files, "file")}
						</span>
						<span className="flex items-center gap-1.5">
							<GitMergeIcon size={12} strokeWidth={2} />
							{live.mergedLast30} merged in 30 days
						</span>
					</div>
				) : null}
			</HoverCardContent>
		</HoverCard>
	);
}
