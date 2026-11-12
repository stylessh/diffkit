import { IssuesIcon } from "@diffkit/icons";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@diffkit/ui/components/avatar";
import { SectionCard } from "@diffkit/ui/components/section-card";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@diffkit/ui/components/tooltip";
import { cn } from "@diffkit/ui/lib/utils";
import type { ReactNode } from "react";
import {
	formatMonth,
	formatShortDate,
	formatWeekRange,
	plural,
} from "./map-format";
import type { MapIcon } from "./map-icons";
import type { LoadedProductMap } from "./product-map-data";
import type { ProductArea } from "./product-map-types";
import { AreaWork } from "./work/area-work";
import { areaPullCounts, openWorkCount } from "./work/work-data";

export function PersonAvatar({
	login,
	bot,
	title,
	className,
}: {
	login: string;
	bot: boolean;
	title?: string;
	className?: string;
}) {
	return (
		<Avatar className={cn("size-5", className)} title={title}>
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
			<TooltipProvider delayDuration={0} skipDelayDuration={0}>
				<div
					role="img"
					aria-label={`${plural(total, "commit")} per week since ${formatShortDate(weekStart)}`}
					className="-mx-[1.5px] flex h-16 items-end"
				>
					{weekly.map((value, week) => (
						<Tooltip
							// biome-ignore lint/suspicious/noArrayIndexKey: the week index is the bar's identity
							key={week}
						>
							<TooltipTrigger asChild>
								<span className="group/bar flex h-full flex-1 items-end rounded-[3px] px-[1.5px] transition-colors hover:bg-foreground/[0.06]">
									<span
										className={cn(
											"w-full rounded-[2px]",
											value === 0 ? "bg-card-border" : "bg-indigo",
										)}
										style={{
											height:
												value === 0
													? 2
													: `${Math.max(8, (value / peak) * 100)}%`,
										}}
									/>
								</span>
							</TooltipTrigger>
							<TooltipContent className="flex-col items-start gap-0.5">
								<span>{plural(value, "commit")}</span>
								<span className="font-[450] text-muted-foreground">
									{formatWeekRange(weekStart, week)}
								</span>
							</TooltipContent>
						</Tooltip>
					))}
				</div>
			</TooltipProvider>
			<figcaption className="flex justify-between text-muted-foreground text-xs">
				<span>{formatMonth(new Date(weekStart))}</span>
				<span>{formatMonth(new Date(analysedAt))}</span>
			</figcaption>
		</figure>
	);
}

function Figure({ value, label }: { value: number; label: string }) {
	return (
		<div className="flex flex-col-reverse">
			<dt className="font-[450] text-muted-foreground text-xs">{label}</dt>
			<dd className="font-semibold text-[19px] text-foreground tabular-nums leading-7">
				{value}
			</dd>
		</div>
	);
}

export function WorkRow({
	icon: Icon,
	iconClassName,
	number,
	title,
	author,
	bot,
	date,
	href,
	note,
	trailing,
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
	trailing?: ReactNode;
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
			{trailing}
			<span className="shrink-0 font-[450] text-muted-foreground text-xs tabular-nums">
				#{number}
			</span>
			<PersonAvatar
				login={author}
				bot={bot}
				title={author}
				className="size-4 shrink-0"
			/>
			<time
				dateTime={date}
				className="min-w-11 shrink-0 text-right font-[450] text-muted-foreground text-xs tabular-nums"
			>
				{formatShortDate(date)}
			</time>
		</a>
	);
}

export function AreaActivity({
	area,
	map,
	onOpenArea,
}: {
	area: ProductArea;
	map: LoadedProductMap;
	onOpenArea: (id: string) => void;
}) {
	const isBot = (login: string) => map.people[login]?.bot ?? false;
	const { stats } = area;
	const pulls = areaPullCounts(map, area.id);

	return (
		<div className="flex flex-col gap-5">
			<dl className="flex flex-wrap gap-x-10 gap-y-3">
				<Figure value={stats.commits} label="commits" />
				<Figure value={stats.commitsLast30} label="in the last 30 days" />
				<Figure value={pulls.merged} label="merged pull requests" />
				<Figure value={openWorkCount(map, area)} label="open" />
			</dl>
			<WeeklyBars
				weekly={stats.weekly}
				weekStart={map.repo.weekStart}
				analysedAt={map.repo.analysedAt}
			/>
			<AreaWork area={area} map={map} onOpenArea={onOpenArea} />
			{area.issues.open.length > 0 ? (
				<div className="flex flex-col gap-2.5">
					<h3 className="font-[450] text-muted-foreground text-xs">
						Open issues
					</h3>
					<SectionCard className="[&>div:last-child]:pb-0">
						{area.issues.open.map((number) => {
							const issue = map.issues[number];
							return (
								<WorkRow
									key={number}
									icon={IssuesIcon}
									iconClassName={
										issue.note ? "text-warning" : "text-state-open"
									}
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
					</SectionCard>
				</div>
			) : null}
		</div>
	);
}
