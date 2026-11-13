import {
	ChevronDownIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	DisplayOptionsIcon,
	LayersIcon,
	PlayIcon,
	SearchIcon,
} from "@diffkit/icons";
import { Button } from "@diffkit/ui/components/button";
import { DetailLayout } from "@diffkit/ui/components/detail-layout";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@diffkit/ui/components/dropdown-menu";
import { KeyboardShortcutKeys } from "@diffkit/ui/components/keyboard-shortcut-keys";
import {
	PageHeaderCrumb,
	PageHeaderTitle,
	PageIconButton,
} from "@diffkit/ui/components/page-header";
import { isEditableKeyboardEvent } from "@diffkit/ui/lib/editable-keyboard-target";
import { cn } from "@diffkit/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
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
import { Skeleton, SkeletonBox } from "skullet/react";
import { RepoHeader, RepoHeaderNav } from "#/components/repo/repo-header";
import { githubRepoOverviewQueryOptions } from "#/lib/github.query";
import { useGitHubQueryScope } from "#/lib/use-github-query-scope";
import { AreaPanel } from "./area-panel";
import { AREA_SECTIONS, type AreaSection, AreaSheet } from "./area-sheet";
import { MapCanvas } from "./map-canvas";
import { lensDescriptions, openWorkCount } from "./map-format";
import { MapPanel } from "./map-panel";
import { MapSearch } from "./map-search";
import { MapInvalid, MapMissing } from "./map-setup";
import { TOUR_IDLE, TourBar, tourReducer } from "./map-tour";
import {
	type LoadedProductMap,
	useMapWriteAccess,
	useProductMap,
} from "./product-map-data";
import { sampleArea, sampleProductMap } from "./product-map-samples";
import type { MapLens, ProductArea } from "./product-map-types";
import { NO_SPOTLIGHT, type Spotlight } from "./spotlight";

const LENSES = ["structure", "activity", "size", "open"] as const;

const lensLabels: Record<MapLens, string> = {
	structure: "Structure",
	activity: "Activity",
	size: "Size",
	open: "Open work",
};

const MAP_CAPTION = "Click an area to see how it works.";

/**
 * Beside the repo tabs there is room for a label on phones, where the tabs fold
 * into one menu, and on wide screens; in between the buttons keep their icon.
 */
const ROOMY_ONLY = "md:max-xl:hidden";

function JumpButton({
	onSearch,
	labelled,
}: {
	onSearch: () => void;
	/** Where the label has room: `roomy` also shows it on phones. */
	labelled: "roomy" | "wide";
}) {
	return (
		<Button
			size="xs"
			variant="outline"
			aria-label="Jump to"
			title="Jump to"
			onClick={onSearch}
		>
			<SearchIcon className="size-3.5 text-muted-foreground" />
			<span className={labelled === "roomy" ? ROOMY_ONLY : "max-xl:hidden"}>
				Jump to
			</span>
			<KeyboardShortcutKeys keys={["/"]} className="max-xl:hidden" />
		</Button>
	);
}

function isLens(value: string): value is MapLens {
	return LENSES.includes(value as MapLens);
}

/**
 * How the areas are drawn. It changes what the same map shows, so it sits with
 * the page's other controls instead of looking like somewhere to go.
 */
function LensMenu({
	lens,
	onChange,
}: {
	lens: MapLens;
	onChange: (lens: MapLens) => void;
}) {
	return (
		<DropdownMenu modal={false}>
			<DropdownMenuTrigger asChild>
				<Button
					size="xs"
					variant="outline"
					aria-label={`Map view: ${lensLabels[lens]}`}
				>
					<DisplayOptionsIcon
						className={cn("size-3.5 text-muted-foreground", ROOMY_ONLY)}
					/>
					{lensLabels[lens]}
					<ChevronDownIcon className="size-3.5 text-muted-foreground" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-44">
				<DropdownMenuLabel>Show areas by</DropdownMenuLabel>
				<DropdownMenuRadioGroup
					value={lens}
					onValueChange={(value) => {
						if (isLens(value)) onChange(value);
					}}
				>
					{LENSES.map((value) => (
						<DropdownMenuRadioItem
							key={value}
							value={value}
							title={lensDescriptions[value]}
						>
							{lensLabels[value]}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
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

type AreaSectionEntry = ReturnType<typeof areaSections>[number];

/**
 * An area's chapters: the one on screen, and a menu that scrolls to another.
 * They are places on this page, so they stay out of the repo's row of tabs.
 */
function SectionMenu({
	sections,
	current,
	onSelect,
}: {
	sections: AreaSectionEntry[];
	current: AreaSection;
	onSelect: (section: AreaSection) => void;
}) {
	const currentLabel =
		sections.find((entry) => entry.section === current)?.label ??
		sections[0].label;
	return (
		<DropdownMenu modal={false}>
			<DropdownMenuTrigger asChild>
				<Button
					size="xs"
					variant="outline"
					aria-label={`Section: ${currentLabel}`}
				>
					{currentLabel}
					<ChevronDownIcon className="size-3.5 text-muted-foreground" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-44">
				<DropdownMenuLabel>On this page</DropdownMenuLabel>
				<DropdownMenuRadioGroup
					value={current}
					onValueChange={(value) => {
						if (isAreaSection(value)) onSelect(value);
					}}
				>
					{sections.map((entry) => (
						<DropdownMenuRadioItem key={entry.section} value={entry.section}>
							<span className="flex-1">{entry.label}</span>
							{entry.count ? (
								<span className="text-muted-foreground text-xs tabular-nums">
									{entry.count}
								</span>
							) : null}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
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

/**
 * The map, or one of its areas. While the map file is still being read it is
 * given the sample map and `loading`: the same frame then draws skeletons, and
 * because they stay mounted, the real map fades in over them.
 */
function ProductMapView({
	map,
	loading,
	owner,
	repo,
}: {
	map: LoadedProductMap;
	loading: boolean;
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
	const [searchOpen, setSearchOpen] = useState(false);
	const [tour, dispatchTour] = useReducer(tourReducer, TOUR_IDLE);
	const stageRef = useRef<HTMLDivElement>(null);
	const scope = useGitHubQueryScope();

	// A link to an area cannot be looked up in the sample, so it draws the sample's.
	const area = areaParam
		? loading
			? sampleArea(map)
			: (map.areaById.get(areaParam) ?? null)
		: null;
	const tourStop = tour.status === "idle" ? null : map.tour[tour.stop];

	// Only the tour lights areas up. Pointing at a tile shows nothing: what an
	// area is linked to is on its own page.
	const spotlight = useMemo<Spotlight>(
		() =>
			tourStop
				? {
						kind: "stop",
						areas: tourStop.areas,
						outside: tourStop.outside ?? [],
					}
				: NO_SPOTLIGHT,
		[tourStop],
	);

	const openArea = useCallback(
		(id: string) => {
			dispatchTour({ type: "stop" });
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
		enabled: !(searchOpen || loading),
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

	return (
		<div className="flex h-full min-h-0 flex-col">
			<RepoHeader
				owner={owner}
				repo={repo}
				scope={scope}
				active="map"
				withNav={false}
				trail={
					area ? (
						<>
							<PageHeaderCrumb asChild>
								<button type="button" onClick={showOverview}>
									<LayersIcon size={14} />
									Product map
								</button>
							</PageHeaderCrumb>
							<PageHeaderTitle asChild>
								<span>
									{loading ? (
										<SkeletonBox width={88} height={14} radius={4} />
									) : (
										area.name
									)}
								</span>
							</PageHeaderTitle>
						</>
					) : undefined
				}
			/>

			<div ref={stageRef} className="relative flex min-h-0 flex-1 flex-col">
				{area ? (
					<DetailLayout
						// The link's own id, so the layout and its skeletons stay mounted
						// when the sample area gives way to the real one.
						key={areaParam}
						panelLabel="Area details"
						panel={
							<Skeleton loading={loading}>
								<AreaPanel area={area} map={map} onNavigate={openArea} />
							</Skeleton>
						}
						toolbar={
							<RepoHeaderNav
								owner={owner}
								repo={repo}
								scope={scope}
								active="map"
								tabActions={
									<MapActions loading={loading}>
										<SectionMenu
											sections={areaSections(area, map)}
											current={visibleSection}
											onSelect={showSection}
										/>
										<PageIconButton
											raised
											aria-label="Previous area"
											onClick={() => stepArea(-1)}
										>
											<ChevronLeftIcon size={14} />
										</PageIconButton>
										<PageIconButton
											raised
											aria-label="Next area"
											onClick={() => stepArea(1)}
										>
											<ChevronRightIcon size={14} />
										</PageIconButton>
										<JumpButton
											labelled="wide"
											onSearch={() => setSearchOpen(true)}
										/>
									</MapActions>
								}
							/>
						}
					>
						<Skeleton loading={loading} label="Loading product map">
							<div className="flex flex-col gap-8">
								<AreaSheet area={area} map={map} />
							</div>
						</Skeleton>
					</DetailLayout>
				) : (
					<DetailLayout
						key="overview"
						panelLabel="About this product"
						panel={
							<Skeleton loading={loading}>
								<MapPanel map={map} spotlight={spotlight} />
							</Skeleton>
						}
						toolbar={
							<RepoHeaderNav
								owner={owner}
								repo={repo}
								scope={scope}
								active="map"
								tabActions={
									<MapActions loading={loading}>
										<LensMenu
											lens={lens}
											onChange={(next) => void setLens(next)}
										/>
										{hasTour ? (
											<Button
												size="xs"
												variant="outline"
												aria-label="Tour"
												title="Tour"
												onClick={startTour}
												iconLeft={<PlayIcon className="size-3.5" />}
											>
												<span className={ROOMY_ONLY}>Tour</span>
											</Button>
										) : null}
										<JumpButton
											labelled="roomy"
											onSearch={() => setSearchOpen(true)}
										/>
									</MapActions>
								}
							/>
						}
					>
						<Skeleton loading={loading} label="Loading product map">
							<div className="flex flex-col gap-8">
								<MapPitch pitch={map.pitch} />
								<MapCanvas
									map={map}
									lens={lens}
									spotlight={spotlight}
									onOpen={openArea}
								/>
								<div
									aria-hidden
									className={tourStop ? "h-40" : "h-16 md:hidden"}
								/>
							</div>
						</Skeleton>
					</DetailLayout>
				)}
				<TourBar state={tour} stops={map.tour} dispatch={dispatchTour} />
			</div>

			{loading ? null : (
				<MapSearch
					map={map}
					open={searchOpen}
					onOpenChange={setSearchOpen}
					onSelectArea={openArea}
				/>
			)}
		</div>
	);
}

/** The map's own buttons beside the repo tabs, drawn as blocks while it loads. */
function MapActions({
	loading,
	children,
}: {
	loading: boolean;
	children: ReactNode;
}) {
	return (
		<Skeleton loading={loading}>
			<span className="flex items-center gap-1.5">{children}</span>
		</Skeleton>
	);
}

/** The map's one-line pitch, and under it how to go further. */
function MapPitch({ pitch }: { pitch: string }) {
	return (
		<header className="flex flex-col gap-2">
			<h1 className="text-pretty font-semibold text-[23px] text-foreground leading-8 tracking-[-0.01em]">
				{pitch}
			</h1>
			<p className="font-[450] text-[13px] text-muted-foreground">
				{MAP_CAPTION}
			</p>
		</header>
	);
}

export function ProductMapPage({
	owner,
	repo,
}: {
	owner: string;
	repo: string;
}) {
	const scope = useGitHubQueryScope();
	const state = useProductMap(owner, repo);
	const access = useMapWriteAccess(
		owner,
		repo,
		state.status === "missing" || state.status === "invalid",
	);
	// The repo's tabs have usually read this already; it says which page to expect.
	const overview = useQuery(
		githubRepoOverviewQueryOptions(scope, { owner, repo }),
	);
	const sample = useMemo(() => sampleProductMap(owner, repo), [owner, repo]);

	if (state.status === "ready")
		return (
			<ProductMapView
				map={state.map}
				loading={false}
				owner={owner}
				repo={repo}
			/>
		);
	if (state.status === "missing")
		return <MapMissing owner={owner} repo={repo} access={access} />;
	if (state.status === "loading" && overview.data?.hasProductMap === false)
		return <MapMissing owner={owner} repo={repo} access="loading" />;
	if (state.status === "loading" || access === "loading")
		return <ProductMapView map={sample} loading owner={owner} repo={repo} />;
	return (
		<MapInvalid
			owner={owner}
			repo={repo}
			problems={state.problems}
			canFix={access === "can-push"}
		/>
	);
}
