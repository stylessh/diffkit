import {
	GitMergeIcon,
	GitPullRequestIcon,
	IssueClosedCompletedIcon,
	IssuesIcon,
} from "@diffkit/icons";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@diffkit/ui/components/avatar";
import { StatePill } from "@diffkit/ui/components/state-pill";
import { cn } from "@diffkit/ui/lib/utils";
import { useState } from "react";
import { formatMonth, formatShortDate, plural } from "./map-format";
import type { MapIcon } from "./map-icons";
import type { LoadedProductMap } from "./product-map-data";
import type { ProductArea } from "./product-map-types";
import { SheetSection } from "./sheet-section";

const WEEK_MS = 7 * 86_400_000;
const MERGED_PREVIEW = 6;

function monthTicks(weekStart: string, weeks: number) {
	const ticks: { week: number; label: string }[] = [];
	const start = Date.parse(weekStart);
	for (let week = 0; week < weeks; week += 1) {
		const date = new Date(start + week * WEEK_MS);
		const previous = new Date(start + (week - 1) * WEEK_MS);
		if (week === 0 || date.getUTCMonth() !== previous.getUTCMonth())
			ticks.push({ week, label: formatMonth(date) });
	}
	return ticks;
}

function WeeklyChart({
	weekly,
	weekStart,
}: {
	weekly: number[];
	weekStart: string;
}) {
	const peak = Math.max(1, ...weekly);
	const ticks = monthTicks(weekStart, weekly.length);
	return (
		<figure className="flex flex-col gap-1 rounded-lg bg-card p-3 shadow-card">
			<div
				className="grid h-14 items-end gap-px"
				style={{
					gridTemplateColumns: `repeat(${weekly.length}, minmax(0, 1fr))`,
				}}
			>
				{weekly.map((value, week) => (
					<span
						// biome-ignore lint/suspicious/noArrayIndexKey: the week index is the bar's identity
						key={week}
						title={`${plural(value, "commit")}, week of ${formatShortDate(
							new Date(Date.parse(weekStart) + week * WEEK_MS).toISOString(),
						)}`}
						className={cn(
							"rounded-[2px]",
							value === 0 ? "bg-card-border" : "bg-indigo",
						)}
						style={{
							height: value === 0 ? 2 : `${Math.max(8, (value / peak) * 100)}%`,
						}}
					/>
				))}
			</div>
			<div
				className="grid text-[10px] text-muted-foreground"
				style={{
					gridTemplateColumns: `repeat(${weekly.length}, minmax(0, 1fr))`,
				}}
			>
				{ticks.map((tick) => (
					<span
						key={tick.week}
						style={{ gridColumnStart: tick.week + 1 }}
						className="whitespace-nowrap"
					>
						{tick.label}
					</span>
				))}
			</div>
			<figcaption className="sr-only">
				Commits touching this area per week
			</figcaption>
		</figure>
	);
}

function WorkRow({
	icon: Icon,
	iconClassName,
	number,
	title,
	meta,
	href,
	note,
}: {
	icon: MapIcon;
	iconClassName: string;
	number: number;
	title: string;
	meta: string;
	href: string;
	note?: string;
}) {
	return (
		<li>
			<a
				href={href}
				target="_blank"
				rel="noreferrer"
				className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2.5 px-3 py-2 transition-colors hover:bg-row-hover"
			>
				<Icon
					size={14}
					strokeWidth={2}
					className={cn("shrink-0", iconClassName)}
				/>
				<span className="min-w-0">
					<span className="block truncate text-[13px] text-foreground">
						{title}
					</span>
					{note ? (
						<span className="block truncate text-warning text-xs">{note}</span>
					) : null}
				</span>
				<span className="whitespace-nowrap text-muted-foreground text-xs tabular-nums">
					#{number} · {meta}
				</span>
			</a>
		</li>
	);
}

function OpenWork({ area, map }: { area: ProductArea; map: LoadedProductMap }) {
	const openCount = area.pulls.open.length + area.issues.open.length;
	if (openCount === 0)
		return (
			<p className="rounded-lg bg-card px-3 py-2.5 text-muted-foreground text-xs shadow-card">
				Nothing open here: no pull requests or issues touch this area.
			</p>
		);
	return (
		<ul className="divide-y-[0.5px] divide-rule overflow-hidden rounded-lg bg-card shadow-card">
			{area.pulls.open.map((number) => {
				const pull = map.pulls[number];
				return (
					<WorkRow
						key={`pull-${number}`}
						icon={GitPullRequestIcon}
						iconClassName="text-state-open"
						number={number}
						title={pull.title}
						meta={`${pull.author} · opened ${formatShortDate(pull.date)}`}
						href={`${map.repo.url}/pull/${number}`}
					/>
				);
			})}
			{area.issues.open.map((number) => {
				const issue = map.issues[number];
				return (
					<WorkRow
						key={`issue-${number}`}
						icon={IssuesIcon}
						iconClassName="text-state-open"
						number={number}
						title={issue.title}
						note={issue.note}
						meta={`${issue.author} · opened ${formatShortDate(issue.date)}`}
						href={`${map.repo.url}/issues/${number}`}
					/>
				);
			})}
		</ul>
	);
}

type MergedListState = "preview" | "all";

function MergedWork({
	area,
	map,
}: {
	area: ProductArea;
	map: LoadedProductMap;
}) {
	const [listState, setListState] = useState<MergedListState>("preview");
	const merged = area.pulls.merged;
	const shown = listState === "all" ? merged : merged.slice(0, MERGED_PREVIEW);
	if (merged.length === 0 && area.issues.closed.length === 0) return null;
	return (
		<ul className="divide-y-[0.5px] divide-rule overflow-hidden rounded-lg bg-card shadow-card">
			{shown.map((number) => {
				const pull = map.pulls[number];
				return (
					<WorkRow
						key={`pull-${number}`}
						icon={GitMergeIcon}
						iconClassName="text-state-merged"
						number={number}
						title={pull.title}
						meta={`${pull.author} · ${formatShortDate(pull.date)}`}
						href={`${map.repo.url}/pull/${number}`}
					/>
				);
			})}
			{listState === "all"
				? area.issues.closed.map((number) => {
						const issue = map.issues[number];
						return (
							<WorkRow
								key={`issue-${number}`}
								icon={IssueClosedCompletedIcon}
								iconClassName="text-state-merged"
								number={number}
								title={issue.title}
								meta={`${issue.author} · issue closed`}
								href={`${map.repo.url}/issues/${number}`}
							/>
						);
					})
				: null}
			{listState === "preview" && merged.length > MERGED_PREVIEW ? (
				<li>
					<button
						type="button"
						onClick={() => setListState("all")}
						className="w-full px-3 py-2 text-left text-muted-foreground text-xs transition-colors hover:bg-row-hover hover:text-foreground"
					>
						Show all {merged.length} merged pull requests
					</button>
				</li>
			) : null}
		</ul>
	);
}

function People({ area, map }: { area: ProductArea; map: LoadedProductMap }) {
	const peak = Math.max(1, ...area.people.map((person) => person.commits));
	return (
		<ul className="flex flex-col gap-1.5 rounded-lg bg-card p-3 shadow-card">
			{area.people.map(({ login, commits }) => {
				const person = map.people[login];
				return (
					<li
						key={login}
						className="grid grid-cols-[auto_minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-2.5"
					>
						<Avatar className="size-5">
							{person?.bot ? null : (
								<AvatarImage
									src={`https://github.com/${login}.png?size=40`}
									alt=""
								/>
							)}
							<AvatarFallback className="text-[9px]">
								{login.slice(0, 2).toUpperCase()}
							</AvatarFallback>
						</Avatar>
						<span className="truncate text-[13px] text-foreground">
							{person?.name ?? login}
						</span>
						<span className="h-1 overflow-hidden rounded-full bg-card-border">
							<span
								className="block h-full rounded-full bg-indigo"
								style={{ width: `${(commits / peak) * 100}%` }}
							/>
						</span>
						<span className="text-muted-foreground text-xs tabular-nums">
							{plural(commits, "commit")}
						</span>
					</li>
				);
			})}
		</ul>
	);
}

export function AreaActivity({
	area,
	map,
}: {
	area: ProductArea;
	map: LoadedProductMap;
}) {
	const openCount = area.pulls.open.length + area.issues.open.length;
	return (
		<>
			<SheetSection
				title="What is happening here"
				aside={`${plural(area.stats.commits, "commit")} since ${formatShortDate(map.repo.firstCommit)}, ${area.stats.commitsLast30} in the last 30 days`}
			>
				<WeeklyChart
					weekly={area.stats.weekly}
					weekStart={map.repo.weekStart}
				/>
				<div className="grid gap-3 lg:grid-cols-2">
					<div className="flex min-w-0 flex-col gap-2">
						<span className="flex items-center gap-2 text-muted-foreground text-xs">
							Open now
							<StatePill tone={openCount > 0 ? "open" : "muted"}>
								{openCount}
							</StatePill>
						</span>
						<OpenWork area={area} map={map} />
					</div>
					<div className="flex min-w-0 flex-col gap-2">
						<span className="flex items-center gap-2 text-muted-foreground text-xs">
							Recently merged
							<StatePill tone="merged">{area.stats.mergedPulls}</StatePill>
						</span>
						<MergedWork key={area.id} area={area} map={map} />
					</div>
				</div>
			</SheetSection>
			<SheetSection
				title="Who has worked on it"
				aside={
					area.people.length === 1 ? "1 person" : `${area.people.length} people`
				}
			>
				<People area={area} map={map} />
			</SheetSection>
		</>
	);
}
