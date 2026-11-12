import { GitMergeIcon, GitPullRequestIcon, IssuesIcon } from "@diffkit/icons";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@diffkit/ui/components/avatar";
import { cn } from "@diffkit/ui/lib/utils";
import { useState } from "react";
import { formatMonth, formatShortDate, plural } from "./map-format";
import type { MapIcon } from "./map-icons";
import type { LoadedProductMap } from "./product-map-data";
import type { ProductArea } from "./product-map-types";

const MERGED_PREVIEW = 4;

export function PersonAvatar({
	login,
	bot,
	className,
}: {
	login: string;
	bot: boolean;
	className?: string;
}) {
	return (
		<Avatar className={cn("size-5", className)} title={login}>
			{bot ? null : (
				<AvatarImage src={`https://github.com/${login}.png?size=40`} alt="" />
			)}
			<AvatarFallback className="text-[8px]">
				{login.slice(0, 2).toUpperCase()}
			</AvatarFallback>
		</Avatar>
	);
}

function WeeklyBars({
	weekly,
	weekStart,
	analysedAt,
}: {
	weekly: number[];
	weekStart: string;
	analysedAt: string;
}) {
	const peak = Math.max(1, ...weekly);
	const total = weekly.reduce((sum, value) => sum + value, 0);
	return (
		<figure className="flex flex-col gap-1.5">
			<div
				role="img"
				aria-label={`${plural(total, "commit")} per week since ${formatShortDate(weekStart)}`}
				className="flex h-12 items-end gap-[3px]"
			>
				{weekly.map((value, week) => (
					<span
						// biome-ignore lint/suspicious/noArrayIndexKey: the week index is the bar's identity
						key={week}
						className={cn(
							"flex-1 rounded-[2px]",
							value === 0 ? "bg-card-border" : "bg-indigo",
						)}
						style={{
							height:
								value === 0 ? 2 : `${Math.max(10, (value / peak) * 100)}%`,
						}}
					/>
				))}
			</div>
			<figcaption className="flex justify-between text-muted-foreground text-xs">
				<span>{formatMonth(new Date(weekStart))}</span>
				<span>{formatMonth(new Date(analysedAt))}</span>
			</figcaption>
		</figure>
	);
}

function WorkRow({
	icon: Icon,
	iconClassName,
	number,
	title,
	author,
	bot,
	date,
	href,
	note,
}: {
	icon: MapIcon;
	iconClassName: string;
	number: number;
	title: string;
	author: string;
	bot: boolean;
	date: string;
	href: string;
	note?: string;
}) {
	return (
		<a
			href={href}
			target="_blank"
			rel="noreferrer"
			title={note}
			className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-row-hover"
		>
			<Icon
				size={14}
				strokeWidth={2}
				className={cn("shrink-0", iconClassName)}
			/>
			<span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
				{title}
			</span>
			<span className="shrink-0 font-[450] text-muted-foreground text-xs tabular-nums">
				#{number}
			</span>
			<PersonAvatar login={author} bot={bot} className="size-4 shrink-0" />
			<time
				dateTime={date}
				className="min-w-11 shrink-0 text-right font-[450] text-muted-foreground text-xs tabular-nums"
			>
				{formatShortDate(date)}
			</time>
		</a>
	);
}

type MergedListState = "preview" | "all";

export function AreaActivity({
	area,
	map,
}: {
	area: ProductArea;
	map: LoadedProductMap;
}) {
	const [listState, setListState] = useState<MergedListState>("preview");
	const isBot = (login: string) => map.people[login]?.bot ?? false;
	const merged = area.pulls.merged;
	const shown = listState === "all" ? merged : merged.slice(0, MERGED_PREVIEW);

	return (
		<>
			<div className="px-4 pt-4 pb-3.5">
				<WeeklyBars
					weekly={area.stats.weekly}
					weekStart={map.repo.weekStart}
					analysedAt={map.repo.analysedAt}
				/>
			</div>
			{area.pulls.open.map((number) => {
				const pull = map.pulls[number];
				return (
					<WorkRow
						key={`pull-${number}`}
						icon={GitPullRequestIcon}
						iconClassName="text-state-open"
						number={number}
						title={pull.title}
						author={pull.author}
						bot={isBot(pull.author)}
						date={pull.date}
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
						iconClassName={issue.note ? "text-warning" : "text-state-open"}
						number={number}
						title={issue.title}
						note={issue.note}
						author={issue.author}
						bot={isBot(issue.author)}
						date={issue.date}
						href={`${map.repo.url}/issues/${number}`}
					/>
				);
			})}
			{shown.map((number) => {
				const pull = map.pulls[number];
				return (
					<WorkRow
						key={number}
						icon={GitMergeIcon}
						iconClassName="text-state-merged"
						number={number}
						title={pull.title}
						author={pull.author}
						bot={isBot(pull.author)}
						date={pull.date}
						href={`${map.repo.url}/pull/${number}`}
					/>
				);
			})}
			{listState === "preview" && merged.length > MERGED_PREVIEW ? (
				<button
					type="button"
					onClick={() => setListState("all")}
					className="w-full px-4 py-2.5 text-left font-[450] text-muted-foreground text-xs transition-colors hover:bg-row-hover hover:text-foreground"
				>
					Show {merged.length - MERGED_PREVIEW} more merged
				</button>
			) : null}
		</>
	);
}
