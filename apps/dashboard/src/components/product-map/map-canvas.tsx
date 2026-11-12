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
import type {
	MapBand,
	MapLens,
	OutsideSystem,
	ProductArea,
} from "./product-map-types";
import {
	outsideNodeId,
	outsideRole,
	type Spotlight,
	spotlightLinks,
	type TileRole,
	tileRole,
} from "./spotlight";

const roleClassName: Record<TileRole, string> = {
	plain: "",
	self: "z-20 outline-[1.5px] outline-indigo outline-solid",
	uses: "z-20 outline-1 outline-indigo outline-solid",
	"used-by": "z-20",
	lit: "z-20 outline-[1.5px] outline-indigo outline-solid",
	dim: "opacity-35",
};

const roleBadge: Partial<Record<TileRole, string>> = {
	uses: "uses",
	"used-by": "used by",
};

export function Sparkline({
	values,
	label,
	className,
}: {
	values: number[];
	label: string;
	className?: string;
}) {
	const peak = Math.max(1, ...values);
	return (
		<svg
			role="img"
			aria-label={label}
			className={className}
			preserveAspectRatio="none"
			viewBox={`0 0 ${values.length} 1`}
		>
			{values.map((value, week) => {
				const height = value === 0 ? 0.06 : Math.max(0.14, value / peak);
				return (
					<rect
						// biome-ignore lint/suspicious/noArrayIndexKey: the week index is the bar's identity
						key={week}
						x={week + 0.15}
						y={1 - height}
						width={0.7}
						height={height}
						fill="currentColor"
						opacity={value === 0 ? 0.35 : 1}
					/>
				);
			})}
		</svg>
	);
}

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
	const badge = roleBadge[role];
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
				"group/tile relative flex min-h-[5.75rem] flex-1 flex-col gap-1 rounded-lg bg-[color-mix(in_oklch,var(--ln-accent)_calc(var(--heat)*38%),var(--card))] p-2.5 text-left shadow-card -outline-offset-1 transition-[opacity,transform] duration-150 hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-solid active:translate-y-0",
				roleClassName[role],
			)}
		>
			<span className="flex min-w-0 items-start gap-1.5">
				<Icon
					size={14}
					strokeWidth={2}
					className="mt-[3px] shrink-0 text-muted-foreground"
				/>
				<span className="line-clamp-2 font-medium text-[13px] text-foreground leading-5">
					{area.name}
				</span>
			</span>
			<span className="line-clamp-2 text-pretty text-muted-foreground text-xs">
				{area.tagline}
			</span>
			<span className="mt-auto flex items-end justify-between gap-2 pt-1">
				<Sparkline
					values={area.stats.weekly}
					label={`${area.stats.commits} commits since the repository began`}
					className="h-3.5 w-20 shrink-0 text-muted-foreground/70"
				/>
				{metric ? (
					<span className="truncate text-[11px] text-text-header tabular-nums">
						{metric}
					</span>
				) : null}
			</span>
			{badge ? (
				<span className="absolute -top-2 right-2 rounded-full bg-foreground px-1.5 py-px font-medium text-[10px] text-background leading-4">
					{badge}
				</span>
			) : null}
		</button>
	);
});

function OutsideStrip({
	systems,
	spotlight,
	map,
	register,
}: {
	systems: OutsideSystem[];
	spotlight: Spotlight;
	map: LoadedProductMap;
	register: (id: string, element: HTMLElement | null) => void;
}) {
	const owners = [...new Set(systems.map((system) => system.owner))];
	return (
		<section className="grid gap-x-6 gap-y-3 border-rule border-t-[0.5px] bg-group px-5 py-4 max-md:px-4 md:grid-cols-[9.5rem_minmax(0,1fr)]">
			<header>
				<h2 className="font-medium text-[13px] text-text-header">
					Outside DiffKit
				</h2>
				<p className="mt-0.5 text-pretty text-muted-foreground text-xs">
					Systems it talks to but does not own.
				</p>
			</header>
			<div className="flex flex-wrap gap-x-6 gap-y-3">
				{owners.map((owner) => (
					<div key={owner} className="min-w-0">
						<h3 className="mb-1.5 text-muted-foreground text-xs">{owner}</h3>
						<div className="flex flex-wrap gap-1.5">
							{systems
								.filter((system) => system.owner === owner)
								.map((system) => {
									const role = outsideRole(spotlight, system.id, map);
									return (
										<span
											key={system.id}
											ref={(element) =>
												register(outsideNodeId(system.id), element)
											}
											title={system.role}
											className={cn(
												"inline-flex h-7 items-center rounded-md border-[0.5px] border-card-border border-dashed px-2 font-[450] text-text-header text-xs transition-[opacity,border-color] duration-150",
												role === "lit" &&
													"border-indigo border-solid text-foreground",
												role === "dim" && "opacity-35",
											)}
										>
											{system.name}
										</span>
									);
								})}
						</div>
					</div>
				))}
			</div>
		</section>
	);
}

function GroupRail({
	label,
	continues,
}: {
	label: string | null;
	continues: boolean;
}) {
	return (
		<span className="flex h-4 items-center gap-2 text-muted-foreground text-xs">
			{label ? <span className="whitespace-nowrap">{label}</span> : null}
			<span
				className={cn("h-px flex-1 bg-card-border", continues && "-mr-2")}
			/>
		</span>
	);
}

function BandSection({
	band,
	depth,
	children,
}: {
	band: MapBand;
	depth: number;
	children: React.ReactNode;
}) {
	return (
		<section
			style={{
				backgroundColor: `color-mix(in oklch, var(--ln-group) ${depth * 30}%, transparent)`,
			}}
			className="grid gap-x-6 gap-y-3 border-rule border-t-[0.5px] px-5 py-4 first:border-t-0 max-md:px-4 md:grid-cols-[9.5rem_minmax(0,1fr)]"
		>
			<header>
				<h2 className="font-medium text-[13px] text-text-header">
					{band.name}
				</h2>
				<p className="mt-0.5 text-pretty text-muted-foreground text-xs">
					{band.caption}
				</p>
			</header>
			<div className="grid min-w-0 grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-x-2 gap-y-3 max-sm:grid-cols-2">
				{children}
			</div>
		</section>
	);
}

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
			{map.bands.map((band, depth) => (
				<BandSection key={band.id} band={band} depth={depth}>
					{band.groups.flatMap((group) =>
						group.areas.map((id, index) => {
							const area = map.areaById.get(id);
							if (!area) return null;
							return (
								<div key={id} className="flex min-w-0 flex-col gap-1.5">
									<GroupRail
										label={index === 0 ? group.name : null}
										continues={index < group.areas.length - 1}
									/>
									<MapTile
										area={area}
										role={tileRole(spotlight, id, map)}
										lens={lens}
										heat={lensValue(area, lens) / peak}
										register={register}
										onOpen={onOpen}
										onSpotlight={onSpotlight}
									/>
								</div>
							);
						}),
					)}
				</BandSection>
			))}
			<OutsideStrip
				systems={map.outside}
				spotlight={spotlight}
				map={map}
				register={register}
			/>
		</div>
	);
}
