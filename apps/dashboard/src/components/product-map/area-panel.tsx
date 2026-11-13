import { CircleCheckIcon, ClockIcon, FileIcon } from "@diffkit/icons";
import { PanelPill, PanelSection } from "@diffkit/ui/components/detail-layout";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@diffkit/ui/components/tooltip";
import { cn } from "@diffkit/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Skeleton } from "skullet/react";

import { AreaHoverCard, relationTo } from "./area-hover-card";
import { formatShortDate, noun, plural } from "./map-format";
import { areaIcon } from "./map-icons";
import { StatRow } from "./map-panel";
import { isCounting, type LoadedProductMap } from "./product-map-data";
import { sampleArea, sampleProductMap } from "./product-map-samples";
import type { ProductArea } from "./product-map-types";
import { type TileRole, tileRole } from "./spotlight";
import { PersonAvatar } from "./work-row";

const LINK_PREVIEW = 5;

const dotClassName: Record<TileRole, string> = {
	plain: "bg-card-border",
	dim: "bg-card-border",
	related: "bg-muted-foreground",
	self: "bg-indigo",
};

function MiniMap({
	map,
	current,
	onNavigate,
}: {
	map: LoadedProductMap;
	current: ProductArea;
	onNavigate: (id: string) => void;
}) {
	return (
		<nav aria-label="Product areas" className="mb-7 flex flex-col gap-1">
			{map.bands.flatMap((band) =>
				band.groups.map((group) => (
					<div key={group.id} className="-ml-1 flex flex-wrap">
						{group.areas.map((id) => {
							const area = map.areaById.get(id);
							if (!area) return null;
							const role = tileRole({ kind: "area", id: current.id }, id, map);
							return (
								<AreaHoverCard
									key={id}
									area={area}
									live={map.activity?.areas[area.id]}
									relation={relationTo(area, current)}
								>
									<button
										type="button"
										aria-label={area.name}
										aria-current={role === "self" ? "page" : undefined}
										onClick={() => onNavigate(id)}
										className="group/dot flex size-5 items-center justify-center rounded-md hover:bg-item-hover"
									>
										<span
											className={cn(
												"size-2.5 rounded-[3px] transition-colors group-hover/dot:bg-foreground",
												dotClassName[role],
											)}
										/>
									</button>
								</AreaHoverCard>
							);
						})}
					</div>
				)),
			)}
		</nav>
	);
}

type LinkListState = "preview" | "all";

function AreaLinks({
	label,
	ids,
	current,
	map,
	onNavigate,
}: {
	label: string;
	ids: string[];
	current: ProductArea;
	map: LoadedProductMap;
	onNavigate: (id: string) => void;
}) {
	const [listState, setListState] = useState<LinkListState>("preview");
	if (ids.length === 0) return null;
	const shown = listState === "all" ? ids : ids.slice(0, LINK_PREVIEW);
	return (
		<PanelSection label={label}>
			{shown.map((id) => {
				const area = map.areaById.get(id);
				if (!area) return null;
				const Icon = areaIcon(area.icon);
				return (
					<AreaHoverCard
						key={id}
						area={area}
						live={map.activity?.areas[area.id]}
						relation={relationTo(area, current)}
					>
						<PanelPill asChild icon={<Icon size={14} strokeWidth={2} />}>
							<button type="button" onClick={() => onNavigate(id)}>
								{area.name}
							</button>
						</PanelPill>
					</AreaHoverCard>
				);
			})}
			{listState === "preview" && ids.length > LINK_PREVIEW ? (
				<PanelPill asChild muted>
					<button type="button" onClick={() => setListState("all")}>
						{ids.length - LINK_PREVIEW} more
					</button>
				</PanelPill>
			) : null}
		</PanelSection>
	);
}

export function AreaPanel({
	area,
	map,
	onNavigate,
}: {
	area: ProductArea;
	map: LoadedProductMap;
	onNavigate: (id: string) => void;
}) {
	// While GitHub is counted, the sample's numbers hold the rows' places.
	const counting = isCounting(map);
	const counted = counting
		? sampleProductMap(map.repo.owner, map.repo.name)
		: map;
	const live =
		counted.activity?.areas[counting ? sampleArea(counted).id : area.id];
	return (
		<>
			<MiniMap map={map} current={area} onNavigate={onNavigate} />
			<AreaLinks
				key={`builds-on-${area.id}`}
				label="Builds on"
				ids={area.dependsOn}
				current={area}
				map={map}
				onNavigate={onNavigate}
			/>
			<AreaLinks
				key={`used-by-${area.id}`}
				label="Used by"
				ids={area.usedBy}
				current={area}
				map={map}
				onNavigate={onNavigate}
			/>
			<Skeleton loading={counting} label="Counting on GitHub">
				{live ? (
					<>
						<PanelSection label="Stats">
							<StatRow
								icon={<FileIcon size={14} strokeWidth={2} />}
								value={live.files}
								label={noun(live.files, "file")}
							/>
							<StatRow
								icon={<CircleCheckIcon size={14} strokeWidth={2} />}
								value={live.testFiles}
								label={noun(live.testFiles, "test file")}
							/>
							{live.lastMerged ? (
								<StatRow
									icon={<ClockIcon size={14} strokeWidth={2} />}
									value={formatShortDate(live.lastMerged)}
									label="last merge"
								/>
							) : null}
						</PanelSection>
						{live.people.length > 0 ? (
							<PanelSection label="People">
								<div className="flex min-h-7 flex-wrap items-center gap-y-1 pl-1.5">
									{live.people.map(({ login, pulls }) => (
										<Tooltip key={login}>
											<TooltipTrigger asChild>
												<Link
													to="/$owner"
													params={{ owner: login }}
													aria-label={`${login}, ${plural(pulls, "pull request")} here`}
													className="-ml-1.5 flex rounded-full bg-main p-[1.5px]"
												>
													<PersonAvatar
														login={login}
														avatarUrl={
															counted.activity?.people[login]?.avatarUrl ?? null
														}
													/>
												</Link>
											</TooltipTrigger>
											<TooltipContent className="flex-col items-start gap-0.5">
												<span>{login}</span>
												<span className="font-[450] text-muted-foreground">
													{plural(pulls, "pull request")} here
												</span>
											</TooltipContent>
										</Tooltip>
									))}
								</div>
							</PanelSection>
						) : null}
					</>
				) : null}
			</Skeleton>
		</>
	);
}
