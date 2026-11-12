import {
	ExternalLinkIcon,
	GitMergeIcon,
	GitPullRequestIcon,
} from "@diffkit/icons";
import { SectionCard } from "@diffkit/ui/components/section-card";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@diffkit/ui/components/tooltip";
import { cn } from "@diffkit/ui/lib/utils";
import { memo, type ReactNode, useMemo, useRef, useState } from "react";
import { formatShare, formatShortDate } from "../map-format";
import { areaIcon } from "../map-icons";
import type { LoadedProductMap } from "../product-map-data";
import type { ProductArea, PullReference } from "../product-map-types";
import { ShareBar } from "./share-bar";
import { type AreaTouch, loadProductWork, type WorkPart } from "./work-data";

const LIST_PREVIEW = 5;
const MAIN_SHARE = 0.1;
const MAIN_LINES = 40;
const TRACE_SHARE = 0.01;
const FIX_STRENGTH = [0, 45, 62, 80, 100];

function cellLevel(lines: number) {
	if (lines > 1500) return 4;
	if (lines > 300) return 3;
	if (lines > 50) return 2;
	return 1;
}

function cellColor(touch: AreaTouch) {
	const level = cellLevel(touch.lines);
	return touch.fix
		? `color-mix(in oklab, var(--color-removed) ${FIX_STRENGTH[level]}%, transparent)`
		: `var(--contrib-level-${level})`;
}

type Row = { touch: AreaTouch; pull: PullReference };

/** Whether the area is a real part of the pull request, not a line or two. */
function isMain({ touch }: Row) {
	return touch.share >= MAIN_SHARE || touch.lines >= MAIN_LINES;
}

const WorkCells = memo(function WorkCells({
	rows,
	selected,
	onSelect,
}: {
	rows: Row[];
	selected: number | null;
	onSelect: (number: number) => void;
}) {
	const hasSelectedCell = rows.some((row) => row.touch.number === selected);
	return (
		<TooltipProvider delayDuration={0} skipDelayDuration={0}>
			<ul aria-label="Merged pull requests" className="-m-0.5 flex flex-wrap">
				{rows.map(({ touch, pull }) => (
					<li key={touch.number} className="flex">
						<Tooltip>
							<TooltipTrigger asChild>
								<button
									type="button"
									aria-label={`#${touch.number} ${pull.title}`}
									aria-pressed={touch.number === selected}
									onClick={() => onSelect(touch.number)}
									className="group/cell flex size-3.5 items-center justify-center"
								>
									<span
										style={{ backgroundColor: cellColor(touch) }}
										className={cn(
											"size-2.5 rounded-[3px] transition-[opacity,box-shadow] duration-150 group-hover/cell:shadow-[0_0_0_1.5px_var(--color-foreground)]",
											!hasSelectedCell || touch.number === selected
												? "opacity-90"
												: "opacity-30",
											touch.number === selected &&
												"shadow-[0_0_0_1.5px_var(--color-foreground)]",
										)}
									/>
								</button>
							</TooltipTrigger>
							<TooltipContent className="max-w-72 flex-col items-start gap-0.5">
								<span className="line-clamp-2">{pull.title}</span>
								<span className="font-[450] text-muted-foreground">
									{formatShare(touch.share)} of #{touch.number} lands here
								</span>
							</TooltipContent>
						</Tooltip>
					</li>
				))}
			</ul>
		</TooltipProvider>
	);
});

function Swatch({ color }: { color: string }) {
	return (
		<span
			style={{ backgroundColor: color }}
			className="size-2.5 rounded-[3px]"
		/>
	);
}

function CellLegend() {
	return (
		<div
			aria-hidden
			className="flex items-center gap-1 font-[450] text-muted-foreground text-xs"
		>
			<span className="pr-1">Smaller</span>
			{[1, 2, 3, 4].map((level) => (
				<Swatch key={level} color={`var(--contrib-level-${level})`} />
			))}
			<span className="pr-3 pl-1">Bigger</span>
			<Swatch
				color={`color-mix(in oklab, var(--color-removed) ${FIX_STRENGTH[3]}%, transparent)`}
			/>
			<span className="pl-1">Fix</span>
		</div>
	);
}

function Footprint({
	number,
	parts,
	currentId,
	map,
	onOpenArea,
}: {
	number: number;
	parts: WorkPart[];
	currentId: string;
	map: LoadedProductMap;
	onOpenArea: (id: string) => void;
}) {
	const shown = parts.filter(
		(part) => part.share >= TRACE_SHARE || part.area === currentId,
	);
	const traces = parts.length - shown.length;
	return (
		<ul className="flex flex-col pr-4 pb-2.5 pl-[2.625rem]">
			{shown.map((part) => {
				const area = map.areaById.get(part.area);
				if (!area) return null;
				const Icon = areaIcon(area.icon);
				const current = part.area === currentId;
				return (
					<li key={part.area}>
						<button
							type="button"
							disabled={current}
							onClick={() => onOpenArea(part.area)}
							className={cn(
								"-mx-2 flex w-[calc(100%+1rem)] items-center gap-2.5 rounded-md px-2 py-1 text-left text-[13px] transition-colors",
								current
									? "font-medium text-foreground"
									: "text-muted-foreground hover:bg-item-hover hover:text-foreground",
							)}
						>
							<Icon size={14} strokeWidth={2} className="shrink-0" />
							<span className="min-w-0 flex-1 truncate">{area.name}</span>
							<ShareBar share={part.share} />
						</button>
					</li>
				);
			})}
			{traces > 0 ? (
				<li className="py-1 pl-6 text-muted-foreground text-xs">
					{traces} more under 1%
				</li>
			) : null}
			<li className="pt-1.5">
				<a
					href={`${map.repo.url}/pull/${number}`}
					target="_blank"
					rel="noreferrer"
					className="inline-flex items-center gap-2.5 font-[450] text-muted-foreground text-xs transition-colors hover:text-foreground"
				>
					<ExternalLinkIcon size={14} strokeWidth={2} />
					Open #{number} on GitHub
				</a>
			</li>
		</ul>
	);
}

function PullRow({
	row,
	open,
	onToggle,
	onMount,
	children,
}: {
	row: Row;
	open: boolean;
	onToggle: () => void;
	onMount: (node: HTMLLIElement | null) => void;
	children: ReactNode;
}) {
	const { touch, pull } = row;
	const merged = pull.state === "merged";
	const Icon = merged ? GitMergeIcon : GitPullRequestIcon;
	return (
		<li ref={onMount} className="flex flex-col">
			<button
				type="button"
				aria-expanded={open}
				onClick={onToggle}
				className="flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-row-hover"
			>
				<Icon
					size={14}
					strokeWidth={2}
					className={cn(
						"shrink-0",
						merged ? "text-state-merged" : "text-state-open",
					)}
				/>
				<span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
					{pull.title}
				</span>
				<span className="shrink-0 font-[450] text-muted-foreground text-xs tabular-nums">
					#{touch.number}
				</span>
				<ShareBar share={touch.share} />
				<time
					dateTime={pull.date}
					className="min-w-11 shrink-0 text-right font-[450] text-muted-foreground text-xs tabular-nums max-sm:hidden"
				>
					{formatShortDate(pull.date)}
				</time>
			</button>
			{open ? children : null}
		</li>
	);
}

type ListState = "preview" | "main" | "all";

function MoreButton({
	onClick,
	children,
}: {
	onClick: () => void;
	children: ReactNode;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="w-full px-4 py-2.5 text-left font-[450] text-muted-foreground text-xs transition-colors hover:bg-row-hover hover:text-foreground"
		>
			{children}
		</button>
	);
}

/**
 * Every pull request that changed one product area: a cell each for the merged
 * ones, then the list, each row opening the rest of that pull request's
 * footprint.
 */
export function AreaWork({
	area,
	map,
	onOpenArea,
}: {
	area: ProductArea;
	map: LoadedProductMap;
	onOpenArea: (id: string) => void;
}) {
	const [listState, setListState] = useState<ListState>("preview");
	const [selected, setSelected] = useState<number | null>(null);
	const revealRef = useRef<number | null>(null);
	const work = loadProductWork(map.repo.owner, map.repo.name);

	const { merged, main, minor } = useMemo(() => {
		const rows: Row[] = [];
		for (const touch of work?.byArea.get(area.id) ?? []) {
			const pull = map.pulls[touch.number];
			if (pull) rows.push({ touch, pull });
		}
		const open = rows.filter((row) => row.pull.state === "open").reverse();
		const done = rows.filter((row) => row.pull.state === "merged");
		const newestFirst = [...open, ...[...done].reverse()];
		return {
			merged: done,
			main: newestFirst.filter(isMain),
			minor: newestFirst.filter((row) => !isMain(row)),
		};
	}, [work, area.id, map]);

	if (!work || main.length + minor.length === 0) return null;

	const shown = {
		preview: main.slice(0, LIST_PREVIEW),
		main,
		all: [...main, ...minor],
	}[listState];

	const selectFromCell = (number: number) => {
		const next = number === selected ? null : number;
		setSelected(next);
		if (next === null) return;
		revealRef.current = next;
		setListState(
			main.some((row) => row.touch.number === next) ? "main" : "all",
		);
	};
	const revealRow = (number: number, node: HTMLLIElement | null) => {
		if (!node || revealRef.current !== number) return;
		revealRef.current = null;
		node.scrollIntoView({ block: "center", behavior: "smooth" });
	};

	return (
		<div className="flex flex-col gap-3 pt-2">
			<WorkCells rows={merged} selected={selected} onSelect={selectFromCell} />
			<CellLegend />
			<SectionCard className="mt-1 [&>div:last-child]:pb-0">
				<ul className="divide-y-[0.5px] divide-rule">
					{shown.map((row) => (
						<PullRow
							key={row.touch.number}
							row={row}
							open={row.touch.number === selected}
							onMount={(node) => revealRow(row.touch.number, node)}
							onToggle={() =>
								setSelected((current) =>
									current === row.touch.number ? null : row.touch.number,
								)
							}
						>
							<Footprint
								number={row.touch.number}
								parts={work.pulls.get(row.touch.number)?.parts ?? []}
								currentId={area.id}
								map={map}
								onOpenArea={onOpenArea}
							/>
						</PullRow>
					))}
				</ul>
				{listState === "preview" && main.length > LIST_PREVIEW ? (
					<MoreButton onClick={() => setListState("main")}>
						Show all {main.length}
					</MoreButton>
				) : null}
				{listState !== "all" &&
				minor.length > 0 &&
				(listState === "main" || main.length <= LIST_PREVIEW) ? (
					<MoreButton onClick={() => setListState("all")}>
						{minor.length} more that barely touch it
					</MoreButton>
				) : null}
			</SectionCard>
		</div>
	);
}
