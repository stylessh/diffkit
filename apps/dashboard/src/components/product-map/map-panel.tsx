import {
	AlertCircleIcon,
	FileIcon,
	GitMergeIcon,
	LayersIcon,
	UserMultiple02Icon,
} from "@diffkit/icons";
import { Button } from "@diffkit/ui/components/button";
import { Chip } from "@diffkit/ui/components/chip";
import { PanelRow, PanelSection } from "@diffkit/ui/components/detail-layout";
import { cn } from "@diffkit/ui/lib/utils";
import type { ReactNode } from "react";
import { formatCount, noun } from "./map-format";
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
	const owners = [...new Set(map.outside.map((system) => system.owner))];
	const lit = litOutsideOwners(spotlight, map);
	const totals = map.activity?.totals;

	return (
		<>
			{map.description ? (
				<p className="mb-7 text-pretty text-[13px] text-foreground leading-5">
					{map.description}
				</p>
			) : null}
			<PanelSection label="Stats">
				<StatRow
					icon={<LayersIcon size={14} strokeWidth={2} />}
					value={map.areas.length}
					label="areas"
				/>
				{totals ? (
					<>
						<StatRow
							icon={<FileIcon size={14} strokeWidth={2} />}
							value={formatCount(totals.files)}
							label={noun(totals.files, "file")}
						/>
						<StatRow
							icon={<GitMergeIcon size={14} strokeWidth={2} />}
							value={totals.mergedPulls}
							label={noun(totals.mergedPulls, "merged pull request")}
						/>
						<StatRow
							icon={<UserMultiple02Icon size={14} strokeWidth={2} />}
							value={totals.people}
							label={totals.people === 1 ? "person" : "people"}
						/>
						{totals.unmappedFiles > 0 ? (
							<StatRow
								icon={<AlertCircleIcon size={14} strokeWidth={2} />}
								value={totals.unmappedFiles}
								label={`${noun(totals.unmappedFiles, "file")} outside the map`}
							/>
						) : null}
					</>
				) : null}
			</PanelSection>
			{owners.length > 0 ? (
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
			) : null}
			{map.activity?.limits.pullsTruncated ? (
				<p className="text-pretty text-muted-foreground text-xs leading-[1.5]">
					Counts the most recently updated pull requests only.
				</p>
			) : null}
			{map.activity?.limits.treeTruncated ? (
				<p className="text-pretty text-muted-foreground text-xs leading-[1.5]">
					This repository has more files than GitHub lists at once, so file
					counts and sizes are partial.
				</p>
			) : null}
			{map.retryActivity ? (
				<div className="flex flex-col items-start gap-2">
					<p className="text-pretty text-muted-foreground text-xs leading-[1.5]">
						GitHub did not answer, so the numbers are missing.
					</p>
					<Button size="xs" variant="outline" onClick={map.retryActivity}>
						Try again
					</Button>
				</div>
			) : null}
		</>
	);
}
