import {
	ChevronLeftIcon,
	ChevronRightIcon,
	LayersIcon,
	PlayIcon,
	SearchIcon,
} from "@diffkit/icons";
import { Button } from "@diffkit/ui/components/button";
import { DetailLayout } from "@diffkit/ui/components/detail-layout";
import { KeyboardShortcutKeys } from "@diffkit/ui/components/keyboard-shortcut-keys";
import {
	PageHeader,
	PageHeaderCrumb,
	PageHeaderTitle,
	PageIconButton,
} from "@diffkit/ui/components/page-header";
import {
	ViewTab,
	ViewTabCount,
	ViewTabs,
} from "@diffkit/ui/components/view-tabs";
import { isEditableKeyboardEvent } from "@diffkit/ui/lib/editable-keyboard-target";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import {
	type ReactNode,
	type RefObject,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useReducer,
	useRef,
	useState,
} from "react";
import { AreaPanel } from "./area-panel";
import { AREA_SECTIONS, type AreaSection, AreaSheet } from "./area-sheet";
import { MapCanvas } from "./map-canvas";
import { lensDescriptions, openWorkCount } from "./map-format";
import { MapPanel } from "./map-panel";
import { MapSearch } from "./map-search";
import { MapInvalid, MapLoading, MapSetup } from "./map-setup";
import { TOUR_IDLE, TourBar, tourReducer } from "./map-tour";
import { type LoadedProductMap, useProductMap } from "./product-map-data";
import type { MapLens, ProductArea } from "./product-map-types";
import { NO_SPOTLIGHT, type Spotlight } from "./spotlight";

const LENSES = ["structure", "activity", "size", "open"] as const;

const lensLabels: Record<MapLens, string> = {
	structure: "Structure",
	activity: "Activity",
	size: "Size",
	open: "Open work",
};

const DEFAULT_CAPTION =
	"Hover an area to see what it builds on. Click to open it.";

type ZoomOrigin = { x: number; y: number };

const CENTER: ZoomOrigin = { x: 40, y: 40 };

function JumpButton({ onSearch }: { onSearch: () => void }) {
	return (
		<Button size="xs" variant="outline" onClick={onSearch}>
			<SearchIcon className="size-3.5 text-muted-foreground" />
			Jump to
			<KeyboardShortcutKeys keys={["/"]} className="max-md:hidden" />
		</Button>
	);
}

function areaSections(
	area: ProductArea,
	map: LoadedProductMap,
): { section: AreaSection; label: string; count?: number }[] {
	const hotFiles = map.activity?.areas[area.id]?.hotFiles.length ?? 0;
	return [
		...(area.flow.length > 0
			? [{ section: "how" as const, label: "How it works" }]
			: []),
		...(area.features.length > 0
			? [
					{
						section: "inside" as const,
						label: "Inside",
						count: area.features.length,
					},
				]
			: []),
		...(hotFiles > 0
			? [{ section: "code" as const, label: "Code", count: hotFiles }]
			: []),
		{
			section: "activity",
			label: "Activity",
			count: openWorkCount(map, area),
		},
	];
}

function isAreaSection(value: string | undefined): value is AreaSection {
	return AREA_SECTIONS.includes(value as AreaSection);
}

type SectionView = { band: AreaSection; atEnd: boolean };

function useVisibleSection(
	scopeRef: RefObject<HTMLElement | null>,
	areaId: string | null,
) {
	const [view, setView] = useState<SectionView>({ band: "how", atEnd: false });

	useEffect(() => {
		const scope = scopeRef.current;
		if (!(scope && areaId)) return;
		setView({ band: "how", atEnd: false });
		const bandObserver = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					const section = (entry.target as HTMLElement).dataset.areaSection;
					if (entry.isIntersecting && isAreaSection(section))
						setView((current) => ({ ...current, band: section }));
				}
			},
			{ rootMargin: "-20% 0px -70% 0px" },
		);
		const endObserver = new IntersectionObserver(([entry]) =>
			setView((current) => ({ ...current, atEnd: entry.isIntersecting })),
		);
		const sections = scope.querySelectorAll("[data-area-section]");
		for (const section of sections) bandObserver.observe(section);
		const end = scope.querySelector("[data-area-end]");
		if (end) endObserver.observe(end);
		return () => {
			bandObserver.disconnect();
			endObserver.disconnect();
		};
	}, [scopeRef, areaId]);

	const scrollable = view.band !== "how" || !view.atEnd;
	return view.atEnd && scrollable ? "activity" : view.band;
}

function Stage({
	stageKey,
	transformOrigin,
	from,
	children,
}: {
	stageKey: string;
	transformOrigin: string;
	from: number;
	children: ReactNode;
}) {
	const reduceMotion = useReducedMotion();
	const scale = reduceMotion ? 1 : from;
	return (
		<motion.div
			key={stageKey}
			className="absolute inset-0 flex flex-col bg-main"
			style={{ transformOrigin }}
			initial={{ opacity: 0, scale }}
			animate={{ opacity: 1, scale: 1 }}
			exit={{ opacity: 0, scale }}
			transition={{ duration: 0.26, ease: [0.2, 0.8, 0.2, 1] }}
		>
			{children}
		</motion.div>
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
	// Written after commit, so a render React throws away never leaves the
	// listener holding handlers for an area that was not shown.
	useLayoutEffect(() => {
		latest.current = handlers;
	});

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

	const hasTour = map.tour.length > 0;
	const startTour = useCallback(() => {
		if (!hasTour) return;
		void setAreaParam(null);
		dispatchTour({ type: "start" });
	}, [setAreaParam, hasTour]);

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
		stageRef.current
			?.querySelector(`[data-area="${firstTourArea}"]`)
			?.scrollIntoView({ block: "center", behavior: "smooth" });
	}, [firstTourArea]);

	const visibleSection = useVisibleSection(stageRef, area?.id ?? null);
	const showSection = (section: AreaSection) => {
		stageRef.current
			?.querySelector(`[data-area-section="${section}"]`)
			?.scrollIntoView({ block: "start", behavior: "smooth" });
	};

	const hoveredArea = hovered ? map.areaById.get(hovered) : null;
	const transformOrigin = `${origin.x}% ${origin.y}%`;

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
						<PageHeaderTitle asChild>
							<span>{area.name}</span>
						</PageHeaderTitle>
					</>
				) : (
					<PageHeaderTitle asChild>
						<span>
							<LayersIcon size={14} />
							Product map
						</span>
					</PageHeaderTitle>
				)}
			</PageHeader>

			<div ref={stageRef} className="relative min-h-0 flex-1 overflow-hidden">
				<AnimatePresence initial={false}>
					{area ? (
						<Stage
							stageKey="area"
							transformOrigin={transformOrigin}
							from={0.94}
						>
							<DetailLayout
								key={area.id}
								panelLabel="Area details"
								panel={
									<AreaPanel area={area} map={map} onNavigate={openArea} />
								}
								toolbar={
									<ViewTabs
										label="Sections"
										actions={
											<JumpButton onSearch={() => setSearchOpen(true)} />
										}
									>
										{areaSections(area, map).map((entry) => (
											<ViewTab
												key={entry.section}
												active={entry.section === visibleSection}
												onClick={() => showSection(entry.section)}
											>
												{entry.label}
												{entry.count ? (
													<ViewTabCount>{entry.count}</ViewTabCount>
												) : null}
											</ViewTab>
										))}
									</ViewTabs>
								}
							>
								<AreaSheet area={area} map={map} />
							</DetailLayout>
						</Stage>
					) : (
						<Stage
							stageKey="overview"
							transformOrigin={transformOrigin}
							from={1.06}
						>
							<DetailLayout
								panelLabel="About this product"
								panel={<MapPanel map={map} spotlight={spotlight} />}
								toolbar={
									<ViewTabs
										label="Map views"
										actions={
											<>
												{hasTour ? (
													<Button
														size="xs"
														variant="outline"
														onClick={startTour}
														iconLeft={<PlayIcon className="size-3.5" />}
													>
														Tour
													</Button>
												) : null}
												<JumpButton onSearch={() => setSearchOpen(true)} />
											</>
										}
									>
										{LENSES.map((value) => (
											<ViewTab
												key={value}
												active={value === lens}
												title={lensDescriptions[value]}
												onClick={() => void setLens(value)}
											>
												{lensLabels[value]}
											</ViewTab>
										))}
									</ViewTabs>
								}
							>
								<header className="flex flex-col gap-2">
									<h1 className="text-pretty font-semibold text-[23px] text-foreground leading-8 tracking-[-0.01em]">
										{map.pitch}
									</h1>
									<p
										aria-live="polite"
										className="min-h-5 font-[450] text-[13px] text-muted-foreground"
									>
										{hoveredArea ? (
											<>
												<span className="text-foreground">
													{hoveredArea.name}
												</span>{" "}
												{hoveredArea.tagline}
											</>
										) : (
											DEFAULT_CAPTION
										)}
									</p>
								</header>
								<MapCanvas
									map={map}
									lens={lens}
									spotlight={spotlight}
									onSpotlight={setHovered}
									onClearSpotlight={() => setHovered(null)}
									onOpen={openArea}
								/>
								<div
									aria-hidden
									className={tourStop ? "h-40" : "h-16 md:hidden"}
								/>
							</DetailLayout>
						</Stage>
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
	const state = useProductMap(owner, repo);
	if (state.status === "loading")
		return <MapLoading owner={owner} repo={repo} />;
	if (state.status === "missing") return <MapSetup owner={owner} repo={repo} />;
	if (state.status === "invalid")
		return <MapInvalid owner={owner} repo={repo} problems={state.problems} />;
	return <ProductMapView map={state.map} owner={owner} repo={repo} />;
}
