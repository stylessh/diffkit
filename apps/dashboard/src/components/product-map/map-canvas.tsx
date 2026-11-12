import { cn } from "@diffkit/ui/lib/utils";
import {
	type CSSProperties,
	memo,
	type PointerEvent,
	useCallback,
	useMemo,
	useRef,
} from "react";
import { lensLabel, lensValue } from "./map-format";
import { areaIcon } from "./map-icons";
import { MapWires } from "./map-wires";
import type { LoadedProductMap } from "./product-map-data";
import type { MapLens, ProductArea } from "./product-map-types";
import {
	type Spotlight,
	spotlightLinks,
	type TileRole,
	tileRole,
} from "./spotlight";

const roleClassName: Record<TileRole, string> = {
	plain: "",
	self: "text-foreground outline-[1.5px] outline-indigo outline-solid",
	related: "text-foreground",
	dim: "bg-main text-muted-foreground/45 shadow-none [&_svg]:opacity-45",
};

const MapTile = memo(function MapTile({
	area,
	role,
	lens,
	heat,
	register,
	onOpen,
	onSpotlight,
}: {
	area: ProductArea;
	role: TileRole;
	lens: MapLens;
	heat: number;
	register: (id: string, element: HTMLElement | null) => void;
	onOpen: (id: string, origin: HTMLElement) => void;
	onSpotlight: (id: string) => void;
}) {
	const Icon = areaIcon(area.icon);
	const metric = lensLabel(area, lens);
	const handlePointerEnter = (event: PointerEvent<HTMLButtonElement>) => {
		if (event.pointerType === "mouse") onSpotlight(area.id);
	};

	return (
		<button
			type="button"
			ref={(element) => register(area.id, element)}
			data-area={area.id}
			data-role={role}
			onClick={(event) => onOpen(area.id, event.currentTarget)}
			onPointerEnter={handlePointerEnter}
			onFocus={() => onSpotlight(area.id)}
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
	onSpotlight,
	onClearSpotlight,
	onOpen,
}: {
	map: LoadedProductMap;
	lens: MapLens;
	spotlight: Spotlight;
	onSpotlight: (id: string) => void;
	onClearSpotlight: () => void;
	onOpen: (id: string, origin: HTMLElement) => void;
}) {
	const containerRef = useRef<HTMLDivElement>(null);
	const nodes = useRef(new Map<string, HTMLElement>());
	const register = useCallback((id: string, element: HTMLElement | null) => {
		if (element) nodes.current.set(id, element);
		else nodes.current.delete(id);
	}, []);
	const links = useMemo(() => spotlightLinks(spotlight, map), [spotlight, map]);
	const peak = useMemo(
		() => Math.max(1, ...map.areas.map((area) => lensValue(area, lens))),
		[map, lens],
	);

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: the spotlight must survive the gaps between tiles, so the canvas, not each tile, decides when the pointer has left
		<div
			ref={containerRef}
			className="relative"
			onPointerLeave={onClearSpotlight}
			onBlur={(event) => {
				if (!event.currentTarget.contains(event.relatedTarget))
					onClearSpotlight();
			}}
		>
			<MapWires containerRef={containerRef} nodes={nodes} links={links} />
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
											lens={lens}
											heat={lensValue(area, lens) / peak}
											register={register}
											onOpen={onOpen}
											onSpotlight={onSpotlight}
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
