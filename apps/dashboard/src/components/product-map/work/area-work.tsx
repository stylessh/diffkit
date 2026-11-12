import { GitMergeIcon, GitPullRequestIcon } from "@diffkit/icons";
import { SectionCard } from "@diffkit/ui/components/section-card";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@diffkit/ui/components/tooltip";
import { Link } from "@tanstack/react-router";
import { memo, type ReactNode, useMemo, useState } from "react";
import type { RepoLinks } from "../code-link";
import { formatShare } from "../map-format";
import type { LoadedProductMap } from "../product-map-data";
import type { ProductArea, PullReference } from "../product-map-types";
import { WorkRow } from "../work-row";
import { type AreaTouch, loadProductWork } from "./work-data";

const LIST_PREVIEW = 5;
const MAIN_SHARE = 0.1;
const MAIN_LINES = 40;
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
	repo,
}: {
	rows: Row[];
	repo: RepoLinks;
}) {
	return (
		<TooltipProvider delayDuration={0} skipDelayDuration={0}>
			<ul aria-label="Merged pull requests" className="-m-0.5 flex flex-wrap">
				{rows.map(({ touch, pull }) => (
					<li key={touch.number} className="flex">
						<Tooltip>
							<TooltipTrigger asChild>
								<Link
									to="/$owner/$repo/pull/$pullId"
									params={{
										owner: repo.owner,
										repo: repo.repo,
										pullId: String(touch.number),
									}}
									aria-label={`#${touch.number} ${pull.title}`}
									className="group/cell flex size-3.5 items-center justify-center"
								>
									<span
										style={{ backgroundColor: cellColor(touch) }}
										className="size-2.5 rounded-[3px] opacity-90 transition-shadow duration-150 group-hover/cell:shadow-[0_0_0_1.5px_var(--color-foreground)]"
									/>
								</Link>
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
 * ones, then the list. Both open the pull request's own page, where its spread
 * across the areas is shown.
 */
export function AreaWork({
	area,
	map,
	repo,
}: {
	area: ProductArea;
	map: LoadedProductMap;
	repo: RepoLinks;
}) {
	const [listState, setListState] = useState<ListState>("preview");
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

	if (main.length + minor.length === 0) return null;

	const shown = {
		preview: main.slice(0, LIST_PREVIEW),
		main,
		all: [...main, ...minor],
	}[listState];

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-col gap-3">
				<WorkCells rows={merged} repo={repo} />
				<CellLegend />
			</div>
			<SectionCard className="[&>div:last-child]:pb-0">
				{shown.map(({ pull }) => {
					const isMerged = pull.state === "merged";
					return (
						<WorkRow
							key={pull.number}
							kind="pull"
							repo={repo}
							icon={isMerged ? GitMergeIcon : GitPullRequestIcon}
							iconClassName={isMerged ? "text-state-merged" : "text-state-open"}
							number={pull.number}
							title={pull.title}
							author={pull.author}
							bot={map.people[pull.author]?.bot ?? false}
							date={pull.date}
						/>
					);
				})}
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
