import { CircleCheckIcon, ClockIcon, CodeIcon, FileIcon } from "@diffkit/icons";
import { PanelPill, PanelSection } from "@diffkit/ui/components/detail-layout";
import { cn } from "@diffkit/ui/lib/utils";
import { useState } from "react";
import { PersonAvatar } from "./area-activity";
import { formatCount, formatShortDate } from "./map-format";
import { areaIcon } from "./map-icons";
import { StatRow } from "./map-panel";
import type { LoadedProductMap } from "./product-map-data";
import type { ProductArea } from "./product-map-types";
import { type TileRole, tileRole } from "./spotlight";

const LINK_PREVIEW = 5;

const dotClassName: Record<TileRole, string> = {
	plain: "bg-card-border",
	dim: "bg-card-border",
	related: "bg-muted-foreground",
	self: "bg-indigo",
};

function MiniMap({
	map,
	currentId,
	onNavigate,
}: {
	map: LoadedProductMap;
	currentId: string;
	onNavigate: (id: string) => void;
}) {
	return (
		<nav aria-label="Product areas" className="mb-7 flex flex-col gap-1">
			{map.bands.flatMap((band) =>
				band.groups.map((group) => (
					<div key={group.id} className="-ml-1 flex flex-wrap">
						{group.areas.map((id) => {
							const role = tileRole({ kind: "area", id: currentId }, id, map);
							const name = map.areaById.get(id)?.name ?? id;
							return (
								<button
									key={id}
									type="button"
									title={name}
									aria-label={name}
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
	map,
	onNavigate,
}: {
	label: string;
	ids: string[];
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
					<PanelPill key={id} asChild icon={<Icon size={14} strokeWidth={2} />}>
						<button type="button" onClick={() => onNavigate(id)}>
							{area.name}
						</button>
					</PanelPill>
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
	const { stats } = area;
	return (
		<>
			<MiniMap map={map} currentId={area.id} onNavigate={onNavigate} />
			<AreaLinks
				key={`builds-on-${area.id}`}
				label="Builds on"
				ids={area.dependsOn}
				map={map}
				onNavigate={onNavigate}
			/>
			<AreaLinks
				key={`used-by-${area.id}`}
				label="Used by"
				ids={area.usedBy}
				map={map}
				onNavigate={onNavigate}
			/>
			<PanelSection label="Stats">
				<StatRow
					icon={<CodeIcon size={14} strokeWidth={2} />}
					value={formatCount(stats.loc)}
					label="lines"
				/>
				<StatRow
					icon={<FileIcon size={14} strokeWidth={2} />}
					value={stats.files}
					label="files"
				/>
				<StatRow
					icon={<CircleCheckIcon size={14} strokeWidth={2} />}
					value={stats.testFiles}
					label="test files"
				/>
				<StatRow
					icon={<ClockIcon size={14} strokeWidth={2} />}
					value={formatShortDate(stats.lastTouched)}
					label="last change"
				/>
			</PanelSection>
			<PanelSection label="People">
				<div className="flex min-h-7 flex-wrap items-center gap-y-1 pl-1.5">
					{area.people.map(({ login }) => (
						<span
							key={login}
							className="-ml-1.5 flex rounded-full bg-main p-[1.5px]"
						>
							<PersonAvatar
								login={login}
								bot={map.people[login]?.bot ?? false}
							/>
						</span>
					))}
				</div>
			</PanelSection>
		</>
	);
}
