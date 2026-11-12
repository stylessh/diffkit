import {
	ClockIcon,
	CodeIcon,
	GitCommitIcon,
	GitMergeIcon,
	LayersIcon,
	UserMultiple02Icon,
} from "@diffkit/icons";
import { Chip } from "@diffkit/ui/components/chip";
import { PanelRow, PanelSection } from "@diffkit/ui/components/detail-layout";
import { cn } from "@diffkit/ui/lib/utils";
import type { ReactNode } from "react";
import { formatCount, formatShortDate } from "./map-format";
import type { LoadedProductMap } from "./product-map-data";
import { litOutsideOwners, type Spotlight } from "./spotlight";

export function StatRow({
	icon,
	value,
	label,
}: {
	icon: ReactNode;
	value: string | number;
	label: string;
}) {
	return (
		<PanelRow muted icon={icon}>
			<span className="text-text-header tabular-nums">{value}</span>
			{label}
		</PanelRow>
	);
}

export function MapPanel({
	map,
	spotlight,
}: {
	map: LoadedProductMap;
	spotlight: Spotlight;
}) {
	const { repo } = map;
	const owners = [...new Set(map.outside.map((system) => system.owner))];
	const lit = litOutsideOwners(spotlight, map);

	return (
		<>
			<p className="mb-7 text-pretty text-[13px] text-foreground leading-5">
				{repo.description}
			</p>
			<PanelSection label="Stats">
				<StatRow
					icon={<LayersIcon size={14} strokeWidth={2} />}
					value={map.areas.length}
					label="areas"
				/>
				<StatRow
					icon={<CodeIcon size={14} strokeWidth={2} />}
					value={formatCount(repo.totals.loc)}
					label="lines"
				/>
				<StatRow
					icon={<GitCommitIcon size={14} strokeWidth={2} />}
					value={repo.totals.commits}
					label="commits"
				/>
				<StatRow
					icon={<GitMergeIcon size={14} strokeWidth={2} />}
					value={repo.totals.mergedPulls}
					label="merged pull requests"
				/>
				<StatRow
					icon={<UserMultiple02Icon size={14} strokeWidth={2} />}
					value={repo.totals.contributors}
					label="people"
				/>
			</PanelSection>
			<PanelSection label="Talks to">
				<div className="flex flex-wrap gap-1.5 py-0.5">
					{owners.map((owner) => (
						<Chip
							key={owner}
							title={map.outside
								.filter((system) => system.owner === owner)
								.map((system) => system.name)
								.join(", ")}
							className={cn(
								"transition-colors duration-150",
								lit.has(owner) &&
									"text-foreground outline-1 outline-indigo outline-solid",
							)}
						>
							{owner}
						</Chip>
					))}
				</div>
			</PanelSection>
			<PanelSection label="Snapshot">
				<PanelRow muted icon={<ClockIcon size={14} strokeWidth={2} />}>
					<span className="font-mono text-[12px] text-text-header">
						{repo.commit}
					</span>
					{formatShortDate(repo.analysedAt)}
				</PanelRow>
			</PanelSection>
		</>
	);
}
