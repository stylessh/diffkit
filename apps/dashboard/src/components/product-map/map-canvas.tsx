import { cn } from "@diffkit/ui/lib/utils";
import { type CSSProperties, memo, useMemo } from "react";
import { lensLabel, lensValue } from "./map-format";
import { areaIcon } from "./map-icons";
import type { LoadedProductMap } from "./product-map-data";
import type { MapLens, ProductArea } from "./product-map-types";
import { type Spotlight, type TileRole, tileRole } from "./spotlight";

const roleClassName: Record<TileRole, string> = {
	plain: "",
	self: "text-foreground outline-[1.5px] outline-indigo outline-solid",
	related: "text-foreground",
	dim: "z-0 bg-main text-muted-foreground/45 shadow-none [&_svg]:opacity-45",
};

const MapTile = memo(function MapTile({
	area,
	role,
	metric,
	heat,
	onOpen,
}: {
	area: ProductArea;
	role: TileRole;
	metric: string | null;
	heat: number;
	onOpen: (id: string) => void;
}) {
	const Icon = areaIcon(area.icon);

	return (
		<button
			type="button"
			data-area={area.id}
			data-role={role}
			onClick={() => onOpen(area.id)}
			style={{ "--heat": heat } as CSSProperties}
			className={cn(
				"-outline-offset-1 relative z-10 inline-flex h-8 items-center gap-2 rounded-lg bg-[color-mix(in_oklch,var(--ln-accent)_calc(var(--heat)*34%),var(--ln-button))] px-2.5 font-medium text-[13px] text-text-header shadow-button transition-colors duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-solid",
				roleClassName[role],
			)}
		>
			<Icon
				size={14}
				strokeWidth={2}
				className="shrink-0 text-muted-foreground"
			/>
			{area.name}
			{metric ? (
				<span className="font-[450] text-muted-foreground tabular-nums">
					{metric}
				</span>
			) : null}
		</button>
	);
});

export function MapCanvas({
	map,
	lens,
	spotlight,
	onOpen,
}: {
	map: LoadedProductMap;
	lens: MapLens;
	spotlight: Spotlight;
	onOpen: (id: string) => void;
}) {
	const peak = useMemo(
		() => Math.max(1, ...map.areas.map((area) => lensValue(area, lens, map))),
		[map, lens],
	);

	return (
		<div>
			{map.bands.map((band) => (
				<section
					key={band.id}
					aria-label={band.name}
					className="flex flex-col gap-4 border-header-rule border-t-[0.5px] py-7 last:pb-0"
				>
					{band.groups.map((group) => (
						<div
							key={group.id}
							className="grid gap-x-6 gap-y-2 sm:grid-cols-[9rem_minmax(0,1fr)]"
						>
							<h2 className="font-[450] text-[13px] text-muted-foreground sm:leading-8">
								{group.name}
							</h2>
							<div className="flex flex-wrap gap-2">
								{group.areas.map((id) => {
									const area = map.areaById.get(id);
									if (!area) return null;
									return (
										<MapTile
											key={id}
											area={area}
											role={tileRole(spotlight, id, map)}
											metric={lensLabel(area, lens, map)}
											heat={lensValue(area, lens, map) / peak}
											onOpen={onOpen}
										/>
									);
								})}
							</div>
						</div>
					))}
				</section>
			))}
		</div>
	);
}
