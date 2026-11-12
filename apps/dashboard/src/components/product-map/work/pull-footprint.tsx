import { PanelPill, PanelSection } from "@diffkit/ui/components/detail-layout";
import { cn } from "@diffkit/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { areaIcon } from "../map-icons";
import { loadProductMap } from "../product-map-data";
import { formatShare, loadProductWork, type WorkPart } from "./work-data";

const PANEL_PREVIEW = 4;

export function ShareBar({
	share,
	className,
}: {
	share: number;
	className?: string;
}) {
	return (
		<span
			className={cn(
				"flex shrink-0 items-center gap-2 font-[450] text-muted-foreground text-xs tabular-nums",
				className,
			)}
		>
			<span
				aria-hidden
				className="h-1 w-12 overflow-hidden rounded-full bg-foreground/10"
			>
				<span
					style={{ width: `${Math.max(4, share * 100)}%` }}
					className="block h-full rounded-full bg-foreground/60"
				/>
			</span>
			<span className="w-9 text-right">{formatShare(share)}</span>
		</span>
	);
}

type FootprintListState = "preview" | "all";

/**
 * The product areas one pull request changes, largest share first. Sits in the
 * pull request's side panel and renders nothing for a repository with no map.
 */
export function PullProductAreas({
	owner,
	repo,
	pullNumber,
}: {
	owner: string;
	repo: string;
	pullNumber: number;
}) {
	const [listState, setListState] = useState<FootprintListState>("preview");
	const map = loadProductMap(owner, repo);
	const parts = loadProductWork(owner, repo)?.pulls.get(pullNumber)?.parts;
	if (!(map && parts)) return null;
	const shown: WorkPart[] =
		listState === "all" ? parts : parts.slice(0, PANEL_PREVIEW);

	return (
		<PanelSection label="Product areas">
			{shown.map((part) => {
				const area = map.areaById.get(part.area);
				if (!area) return null;
				const Icon = areaIcon(area.icon);
				return (
					<PanelPill
						key={part.area}
						asChild
						icon={<Icon size={14} strokeWidth={2} />}
						className="w-[calc(100%+12px)]"
					>
						<Link
							to="/$owner/$repo/map"
							params={{ owner, repo }}
							search={{ area: part.area }}
						>
							<span className="min-w-0 flex-1 truncate">{area.name}</span>
							<ShareBar share={part.share} />
						</Link>
					</PanelPill>
				);
			})}
			{listState === "preview" && parts.length > PANEL_PREVIEW ? (
				<PanelPill asChild muted>
					<button type="button" onClick={() => setListState("all")}>
						{parts.length - PANEL_PREVIEW} more
					</button>
				</PanelPill>
			) : null}
		</PanelSection>
	);
}
