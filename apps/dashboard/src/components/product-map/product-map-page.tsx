import {
	ChevronLeftIcon,
	ChevronRightIcon,
	LayersIcon,
	PlayIcon,
	SearchIcon,
} from "@diffkit/icons";
import { Button } from "@diffkit/ui/components/button";
import { EmptyState } from "@diffkit/ui/components/empty-state";
import { KeyboardShortcutKeys } from "@diffkit/ui/components/keyboard-shortcut-keys";
import {
	PageHeader,
	PageHeaderCrumb,
	PageHeaderTitle,
	PageIconButton,
} from "@diffkit/ui/components/page-header";
import { SegmentedToggle } from "@diffkit/ui/components/segmented-toggle";
import { isEditableKeyboardEvent } from "@diffkit/ui/lib/editable-keyboard-target";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import {
	useCallback,
	useEffect,
	useMemo,
	useReducer,
	useRef,
	useState,
} from "react";
import { AreaSheet } from "./area-sheet";
import { MapCanvas } from "./map-canvas";
import {
	formatCount,
	formatShortDate,
	lensDescriptions,
	plural,
} from "./map-format";
import { MapRail } from "./map-rail";
import { MapSearch } from "./map-search";
import { TOUR_IDLE, TourBar, tourReducer } from "./map-tour";
import { type LoadedProductMap, loadProductMap } from "./product-map-data";
import type { MapLens } from "./product-map-types";
import { NO_SPOTLIGHT, type Spotlight } from "./spotlight";

const LENSES = ["structure", "activity", "size", "open"] as const;

const lensOptions: { value: MapLens; label: string }[] = [
	{ value: "structure", label: "Structure" },
	{ value: "activity", label: "Activity" },
	{ value: "size", label: "Size" },
	{ value: "open", label: "Open work" },
];

type ZoomOrigin = { x: number; y: number };

const CENTER: ZoomOrigin = { x: 50, y: 40 };

function MapIntro({
	map,
	lens,
	onLens,
	onTour,
	onSearch,
}: {
	map: LoadedProductMap;
	lens: MapLens;
	onLens: (lens: MapLens) => void;
	onTour: () => void;
	onSearch: () => void;
}) {
	const { repo } = map;
	return (
		<div className="flex flex-col gap-3.5 px-5 pt-6 pb-5 max-md:px-4 max-md:pt-5">
			<div className="flex max-w-[46rem] flex-col gap-2">
				<h2 className="text-balance font-semibold text-3xl text-foreground tracking-[-0.02em] max-md:text-2xl">
					{repo.pitch}
				</h2>
				<p className="text-pretty text-[15px] text-text-header leading-[1.55] max-md:text-[13px]">
					{repo.description}
				</p>
			</div>
			<div className="flex flex-wrap items-center gap-2">
				<Button
					size="sm"
					variant="accent"
					onClick={onTour}
					iconLeft={<PlayIcon />}
				>
					One-minute tour
				</Button>
				<Button size="sm" variant="outline" onClick={onSearch}>
					Jump to
					<KeyboardShortcutKeys keys={["/"]} className="max-md:hidden" />
				</Button>
				<span className="mx-1 h-4 w-px bg-card-border max-sm:hidden" />
				<SegmentedToggle
					aria-label="Colour the map by"
					value={lens}
					onValueChange={onLens}
					options={lensOptions}
				/>
				<span className="text-muted-foreground text-xs">
					{lensDescriptions[lens]}
				</span>
			</div>
			<p className="text-muted-foreground text-xs tabular-nums">
				{plural(map.areas.length, "area")} · {formatCount(repo.totals.loc)}{" "}
				lines · {plural(repo.totals.commits, "commit")} ·{" "}
				{repo.totals.mergedPulls} merged pull requests ·{" "}
				{repo.totals.contributors} people · {formatShortDate(repo.firstCommit)}{" "}
				to {formatShortDate(repo.analysedAt)} · snapshot at {repo.commit}
			</p>
		</div>
	);
}

function useMapKeys(handlers: {
	search: () => void;
	back: () => void;
	tour: () => void;
	step: (direction: 1 | -1) => void;
	enabled: boolean;
}) {
	const latest = useRef(handlers);
	latest.current = handlers;

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			const current = latest.current;
			if (!current.enabled || isEditableKeyboardEvent(event)) return;
			if (event.metaKey || event.ctrlKey || event.altKey) return;
			if (event.key === "/") {
				event.preventDefault();
				current.search();
			} else if (event.key === "Escape") current.back();
			else if (event.key === "t") current.tour();
			else if (event.key === "]" || event.key === "ArrowRight") current.step(1);
			else if (event.key === "[" || event.key === "ArrowLeft") current.step(-1);
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);
}

function ProductMapView({
	map,
	owner,
	repo,
}: {
	map: LoadedProductMap;
	owner: string;
	repo: string;
}) {
	const [areaParam, setAreaParam] = useQueryState(
		"area",
		parseAsString.withOptions({ history: "push" }),
	);
	const [lens, setLens] = useQueryState(
		"lens",
		parseAsStringLiteral(LENSES).withDefault("structure"),
	);
	const [hovered, setHovered] = useState<string | null>(null);
	const [searchOpen, setSearchOpen] = useState(false);
	const [tour, dispatchTour] = useReducer(tourReducer, TOUR_IDLE);
	const [origin, setOrigin] = useState<ZoomOrigin>(CENTER);
	const stageRef = useRef<HTMLDivElement>(null);
	const overviewRef = useRef<HTMLDivElement>(null);
	const overviewScroll = useRef(0);
	const reduceMotion = useReducedMotion();

	const area = areaParam ? (map.areaById.get(areaParam) ?? null) : null;
	const tourStop = tour.status === "idle" ? null : map.tour[tour.stop];

	const spotlight = useMemo<Spotlight>(() => {
		if (tourStop)
			return {
				kind: "stop",
				areas: tourStop.areas,
				outside: tourStop.outside ?? [],
			};
		return hovered ? { kind: "area", id: hovered } : NO_SPOTLIGHT;
	}, [tourStop, hovered]);

	const openArea = useCallback(
		(id: string, from?: HTMLElement) => {
			const stage = stageRef.current;
			if (stage && from) {
				const stageBox = stage.getBoundingClientRect();
				const tile = from.getBoundingClientRect();
				setOrigin({
					x:
						((tile.left + tile.width / 2 - stageBox.left) / stageBox.width) *
						100,
					y:
						((tile.top + tile.height / 2 - stageBox.top) / stageBox.height) *
						100,
				});
			}
			overviewScroll.current = overviewRef.current?.scrollTop ?? 0;
			dispatchTour({ type: "stop" });
			setHovered(null);
			void setAreaParam(id);
		},
		[setAreaParam],
	);

	const showOverview = useCallback(() => {
		void setAreaParam(null);
	}, [setAreaParam]);

	const stepArea = useCallback(
		(direction: 1 | -1) => {
			if (!area) return;
			const index = map.order.indexOf(area.id);
			const next =
				map.order[(index + direction + map.order.length) % map.order.length];
			void setAreaParam(next);
		},
		[area, map, setAreaParam],
	);

	const startTour = useCallback(() => {
		void setAreaParam(null);
		dispatchTour({ type: "start" });
	}, [setAreaParam]);

	useMapKeys({
		enabled: !searchOpen,
		search: () => setSearchOpen(true),
		back: () => {
			if (tour.status !== "idle") dispatchTour({ type: "stop" });
			else if (area) showOverview();
		},
		tour: () => {
			if (tour.status === "idle") startTour();
			else dispatchTour({ type: "toggle" });
		},
		step: (direction) => {
			if (tour.status === "idle") stepArea(direction);
			else if (direction === 1)
				dispatchTour({ type: "next", stops: map.tour.length });
			else dispatchTour({ type: "previous" });
		},
	});

	const firstTourArea = tourStop?.areas[0];
	useEffect(() => {
		if (!firstTourArea) return;
		overviewRef.current
			?.querySelector(`[data-area="${firstTourArea}"]`)
			?.scrollIntoView({ block: "center", behavior: "smooth" });
	}, [firstTourArea]);

	const transformOrigin = `${origin.x}% ${origin.y}%`;
	const zoom = reduceMotion ? 1 : undefined;

	return (
		<div className="flex h-full min-h-0 flex-col">
			<PageHeader
				actions={
					area ? (
						<>
							<PageIconButton
								aria-label="Previous area"
								onClick={() => stepArea(-1)}
							>
								<ChevronLeftIcon size={14} />
							</PageIconButton>
							<PageIconButton
								aria-label="Next area"
								onClick={() => stepArea(1)}
							>
								<ChevronRightIcon size={14} />
							</PageIconButton>
							<PageIconButton
								aria-label="Jump to"
								onClick={() => setSearchOpen(true)}
							>
								<SearchIcon size={14} />
							</PageIconButton>
						</>
					) : undefined
				}
			>
				<PageHeaderCrumb asChild className="max-sm:hidden">
					<Link to="/$owner/$repo" params={{ owner, repo }}>
						{owner}/{repo}
					</Link>
				</PageHeaderCrumb>
				{area ? (
					<>
						<PageHeaderCrumb asChild>
							<button type="button" onClick={showOverview}>
								<LayersIcon size={14} />
								Product map
							</button>
						</PageHeaderCrumb>
						<PageHeaderTitle>{area.name}</PageHeaderTitle>
					</>
				) : (
					<PageHeaderTitle>
						<LayersIcon size={14} />
						Product map
					</PageHeaderTitle>
				)}
			</PageHeader>

			<div ref={stageRef} className="relative min-h-0 flex-1 overflow-hidden">
				<AnimatePresence initial={false}>
					{area ? (
						<motion.div
							key="area"
							className="absolute inset-0 grid bg-main lg:grid-cols-[15.5rem_minmax(0,1fr)]"
							style={{ transformOrigin }}
							initial={{ opacity: 0, scale: zoom ?? 0.9 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={{ opacity: 0, scale: zoom ?? 0.9 }}
							transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
						>
							<div className="min-h-0 max-lg:hidden">
								<MapRail map={map} currentId={area.id} onNavigate={openArea} />
							</div>
							<div key={area.id} className="min-h-0 overflow-y-auto">
								<motion.div
									initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ duration: 0.22 }}
								>
									<AreaSheet area={area} map={map} onNavigate={openArea} />
								</motion.div>
							</div>
						</motion.div>
					) : (
						<motion.div
							key="overview"
							ref={(element) => {
								overviewRef.current = element;
								if (element) element.scrollTop = overviewScroll.current;
							}}
							className="absolute inset-0 overflow-y-auto pb-28"
							style={{ transformOrigin }}
							initial={{ opacity: 0, scale: zoom ?? 1.08 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={{ opacity: 0, scale: zoom ?? 1.14 }}
							transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
						>
							<MapIntro
								map={map}
								lens={lens}
								onLens={(next) => void setLens(next)}
								onTour={startTour}
								onSearch={() => setSearchOpen(true)}
							/>
							<MapCanvas
								map={map}
								lens={lens}
								spotlight={spotlight}
								onSpotlight={setHovered}
								onClearSpotlight={() => setHovered(null)}
								onOpen={openArea}
							/>
						</motion.div>
					)}
				</AnimatePresence>
				<TourBar state={tour} stops={map.tour} dispatch={dispatchTour} />
			</div>

			<MapSearch
				map={map}
				open={searchOpen}
				onOpenChange={setSearchOpen}
				onSelectArea={openArea}
			/>
		</div>
	);
}

export function ProductMapPage({
	owner,
	repo,
}: {
	owner: string;
	repo: string;
}) {
	const map = loadProductMap(owner, repo);
	if (!map)
		return (
			<div className="flex h-full items-center justify-center p-6">
				<EmptyState
					illustration={<LayersIcon size={28} />}
					title="No product map for this repository yet"
					description={`The experiment ships one hand-analysed map, for stylessh/diffkit. ${owner}/${repo} has not been analysed.`}
				>
					<Button asChild size="sm" variant="outline">
						<Link
							to="/$owner/$repo/map"
							params={{ owner: "stylessh", repo: "diffkit" }}
						>
							Open the DiffKit map
						</Link>
					</Button>
				</EmptyState>
			</div>
		);
	return <ProductMapView map={map} owner={owner} repo={repo} />;
}
