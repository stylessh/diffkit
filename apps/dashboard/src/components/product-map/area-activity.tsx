import { IssuesIcon } from "@diffkit/icons";
import { Button } from "@diffkit/ui/components/button";
import { SectionCard } from "@diffkit/ui/components/section-card";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@diffkit/ui/components/tooltip";
import { cn } from "@diffkit/ui/lib/utils";
import { Skeleton } from "skullet/react";
import { SkeletonSample } from "#/components/shared/skeleton-sample";
import type { RepoLinks } from "./code-link";
import {
	formatMonth,
	formatShortDate,
	formatWeekRange,
	noun,
	openWorkCount,
	plural,
} from "./map-format";
import { MarkTooltips } from "./mark-tooltips";
import { isCounting, type LoadedProductMap } from "./product-map-data";
import { sampleArea, sampleProductMap } from "./product-map-samples";
import type { ProductArea } from "./product-map-types";
import { AreaWork } from "./work/area-work";
import { WorkRow } from "./work-row";

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
			<MarkTooltips>
				<div
					role="img"
					aria-label={`${plural(total, "pull request")} merged per week since ${formatShortDate(weekStart)}`}
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
								<span>{value} merged</span>
								<span className="font-[450] text-muted-foreground">
									{formatWeekRange(weekStart, week)}
								</span>
							</TooltipContent>
						</Tooltip>
					))}
				</div>
			</MarkTooltips>
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

export function AreaActivity({
	area,
	map,
	repo,
}: {
	area: ProductArea;
	map: LoadedProductMap;
	repo: RepoLinks;
}) {
	if (map.retryActivity)
		return (
			<p className="flex items-center gap-3 text-[13px] text-muted-foreground">
				GitHub did not answer, so there is nothing to count yet.
				<Button size="xs" variant="outline" onClick={map.retryActivity}>
					Try again
				</Button>
			</p>
		);
	const counting = isCounting(map);
	const sample = counting
		? sampleProductMap(map.repo.owner, map.repo.name)
		: null;
	return (
		<Skeleton loading={counting} label="Counting pull requests on GitHub">
			{sample ? (
				<SkeletonSample>
					<AreaActivityCounts
						area={sampleArea(sample)}
						map={sample}
						repo={repo}
					/>
				</SkeletonSample>
			) : (
				<AreaActivityCounts area={area} map={map} repo={repo} />
			)}
		</Skeleton>
	);
}

function AreaActivityCounts({
	area,
	map,
	repo,
}: {
	area: ProductArea;
	map: LoadedProductMap;
	repo: RepoLinks;
}) {
	const { activity } = map;
	if (!activity) return null;
	const live = activity.areas[area.id];

	return (
		<div className="flex flex-col gap-10">
			<dl className="flex flex-wrap gap-x-10 gap-y-3">
				<Figure
					value={live.mergedPulls}
					label={noun(live.mergedPulls, "merged pull request")}
				/>
				<Figure value={live.mergedLast30} label="in the last 30 days" />
				<Figure value={openWorkCount(map, area)} label="open" />
			</dl>
			{live.mergedPulls > 0 ? (
				<WeeklyBars
					weekly={live.weekly}
					weekStart={activity.weekStart}
					analysedAt={activity.analysedAt}
				/>
			) : null}
			<AreaWork area={area} activity={activity} repo={repo} />
			{live.openIssues.length > 0 ? (
				<div className="flex flex-col gap-2.5">
					<h3 className="font-[450] text-muted-foreground text-xs">
						Open issues
					</h3>
					<SectionCard className="[&>div:last-child]:pb-0">
						{live.openIssues.map((number) => {
							const issue = activity.issues[number];
							return (
								<WorkRow
									key={number}
									kind="issue"
									repo={repo}
									icon={IssuesIcon}
									iconClassName={
										issue.note ? "text-warning" : "text-state-open"
									}
									number={number}
									title={issue.title}
									note={issue.note}
									author={issue.author}
									avatarUrl={activity.people[issue.author]?.avatarUrl ?? null}
									date={issue.date}
								/>
							);
						})}
					</SectionCard>
				</div>
			) : null}
		</div>
	);
}
