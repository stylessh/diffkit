import { PanelPill, PanelSection } from "@diffkit/ui/components/detail-layout";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { areaIcon } from "../map-icons";
import { loadProductMap } from "../product-map-data";
import { ShareBar } from "./share-bar";
import { loadProductWork, type WorkPart } from "./work-data";

const PANEL_PREVIEW = 4;

type FootprintListState = "preview" | "all";

/** The product areas one pull request changes, largest share first. */
export function PullFootprintAreas({
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
