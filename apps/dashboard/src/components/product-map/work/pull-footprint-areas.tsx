import { AlertCircleIcon } from "@diffkit/icons";
import {
	PanelPill,
	PanelRow,
	PanelSection,
} from "@diffkit/ui/components/detail-layout";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
	type GitHubQueryScope,
	githubPullProductAreasQueryOptions,
} from "#/lib/github.query";
import { areaIcon } from "../map-icons";
import { ShareBar } from "./share-bar";

const PANEL_PREVIEW = 4;

type FootprintListState = "preview" | "all";

/** The product areas one pull request changes, largest share first. */
export function PullFootprintAreas({
	owner,
	repo,
	pullNumber,
	scope,
}: {
	owner: string;
	repo: string;
	pullNumber: number;
	scope: GitHubQueryScope;
}) {
	const [listState, setListState] = useState<FootprintListState>("preview");
	const { data } = useQuery(
		githubPullProductAreasQueryOptions(scope, { owner, repo, pullNumber }),
	);
	if (!data || data.areas.length + data.unmappedFiles === 0) return null;
	const { areas, unmappedFiles } = data;
	const shown = listState === "all" ? areas : areas.slice(0, PANEL_PREVIEW);

	return (
		<PanelSection label="Product areas">
			{shown.map((area) => {
				const Icon = areaIcon(area.icon);
				return (
					<PanelPill
						key={area.id}
						asChild
						icon={<Icon size={14} strokeWidth={2} />}
						className="w-[calc(100%+12px)]"
					>
						<Link
							to="/$owner/$repo/map"
							params={{ owner, repo }}
							search={{ area: area.id }}
						>
							<span className="min-w-0 flex-1 truncate">{area.name}</span>
							<ShareBar share={area.share} />
						</Link>
					</PanelPill>
				);
			})}
			{listState === "preview" && areas.length > PANEL_PREVIEW ? (
				<PanelPill asChild muted>
					<button type="button" onClick={() => setListState("all")}>
						{areas.length - PANEL_PREVIEW} more
					</button>
				</PanelPill>
			) : null}
			{unmappedFiles > 0 ? (
				<PanelRow
					muted
					icon={
						<AlertCircleIcon
							size={14}
							strokeWidth={2}
							className="text-warning"
						/>
					}
					title="These files match no area's paths yet. Update the product map so they are counted."
				>
					<span className="text-text-header tabular-nums">{unmappedFiles}</span>
					{unmappedFiles === 1 ? "file" : "files"} outside the map
				</PanelRow>
			) : null}
		</PanelSection>
	);
}
