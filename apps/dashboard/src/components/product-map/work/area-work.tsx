import { GitMergeIcon, GitPullRequestIcon } from "@diffkit/icons";
import { SectionCard } from "@diffkit/ui/components/section-card";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@diffkit/ui/components/tooltip";
import { Link } from "@tanstack/react-router";
import { memo, type ReactNode, useMemo, useState } from "react";
import type { MapActivity, PullWork } from "#/lib/product-map/activity";
import type { WorkPart } from "#/lib/product-map/work";
import type { RepoLinks } from "../code-link";
import { formatShare } from "../map-format";
import { MarkTooltips } from "../mark-tooltips";
import type { ProductArea } from "../product-map-types";
import { WorkRow } from "../work-row";

const LIST_PREVIEW = 5;
const MAIN_SHARE = 0.1;
const MAIN_LINES = 40;

function cellLevel(lines: number) {
	if (lines > 1500) return 4;
	if (lines > 300) return 3;
	if (lines > 50) return 2;
	return 1;
}

/** A cell's fill: stronger for more lines, and red when the pull request is a fix. */
function cellColor(lines: number, fix: boolean) {
	return `var(--pull-tile-${fix ? "fix-" : ""}${cellLevel(lines)})`;
}

/**
 * One pull request as a tile that opens it: what the area's activity and its
 * most changed files both count pull requests with. Tiles butt against each
 * other in a bar, and the bar rounds its own ends.
 */
export function PullCell({
	pull,
	lines,
	repo,
	children,
}: {
	pull: PullWork;
	/** What the cell's strength stands for: lines in the area, or in one file. */
	lines: number;
	repo: RepoLinks;
	/** The tooltip's second line. */
	children: ReactNode;
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Link
					to="/$owner/$repo/pull/$pullId"
					params={{
						owner: repo.owner,
						repo: repo.repo,
						pullId: String(pull.number),
					}}
					aria-label={`#${pull.number} ${pull.title}`}
					className="group/cell flex h-3.5 w-3 outline-none"
				>
					<span
						style={{ backgroundColor: cellColor(lines, pull.fix) }}
						className="size-full transition-shadow duration-150 group-hover/cell:shadow-[inset_0_0_0_1.5px_var(--color-foreground)] group-focus-visible/cell:shadow-[inset_0_0_0_1.5px_var(--color-focus)]"
					/>
				</Link>
			</TooltipTrigger>
			<TooltipContent className="max-w-72 flex-col items-start gap-0.5">
				<span className="line-clamp-2">{pull.title}</span>
				<span className="font-[450] text-muted-foreground">{children}</span>
			</TooltipContent>
		</Tooltip>
	);
}

/** One pull request as seen from a single area. */
type Row = { touch: WorkPart; pull: PullWork };

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
		<MarkTooltips>
			{/* The width is cut to a whole number of tiles, so every full line ends flush with the rounded edge. */}
			<ul
				aria-label="Merged pull requests"
				className="flex w-[calc(round(down,100%_+_1px,13px)_-_1px)] flex-wrap gap-px overflow-hidden rounded-[4px]"
			>
				{rows.map(({ touch, pull }) => (
					<li
						key={pull.number}
						className="flex overflow-hidden last:rounded-r-[4px]"
					>
						<PullCell pull={pull} lines={touch.lines} repo={repo}>
							{pull.approximate ? "About " : ""}
							{formatShare(touch.share)} of #{pull.number} lands here
						</PullCell>
					</li>
				))}
			</ul>
		</MarkTooltips>
	);
});

function Swatch({ color }: { color: string }) {
	return <span style={{ backgroundColor: color }} className="size-2.5" />;
}

function CellLegend() {
	return (
		<div
			aria-hidden
			className="flex items-center gap-1 font-[450] text-muted-foreground text-xs"
		>
			<span className="pr-1">Smaller</span>
			<span className="flex gap-px overflow-hidden rounded-[3px]">
				{[1, 2, 3, 4].map((level) => (
					<Swatch key={level} color={`var(--pull-tile-${level})`} />
				))}
			</span>
			<span className="pr-3 pl-1">Bigger</span>
			<span className="flex overflow-hidden rounded-[3px]">
				<Swatch color="var(--pull-tile-fix-3)" />
			</span>
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
	activity,
	repo,
}: {
	area: ProductArea;
	activity: MapActivity;
	repo: RepoLinks;
}) {
	const [listState, setListState] = useState<ListState>("preview");

	const { merged, main, minor } = useMemo(() => {
		const rows: Row[] = [];
		for (const number of activity.areas[area.id].pulls) {
			const pull = activity.pulls[number];
			const touch = pull.parts.find((part) => part.area === area.id);
			if (touch) rows.push({ touch, pull });
		}
		const open = rows.filter((row) => row.pull.state === "open").reverse();
		const done = rows.filter((row) => row.pull.state === "merged");
		const newestFirst = [...open, ...[...done].reverse()];
		return {
			merged: done,
			main: newestFirst.filter(isMain),
			minor: newestFirst.filter((row) => !isMain(row)),
		};
	}, [activity, area.id]);

	if (main.length + minor.length === 0) return null;

	const shown = {
		preview: main.slice(0, LIST_PREVIEW),
		main,
		all: [...main, ...minor],
	}[listState];

	return (
		<div className="flex flex-col gap-6">
			{merged.length > 0 ? (
				<div className="flex flex-col gap-3">
					<WorkCells rows={merged} repo={repo} />
					<CellLegend />
				</div>
			) : null}
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
							avatarUrl={activity.people[pull.author]?.avatarUrl ?? null}
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
