import { SectionCard } from "@diffkit/ui/components/section-card";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@diffkit/ui/components/tooltip";
import { cn } from "@diffkit/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { Skeleton } from "skullet/react";
import { FileTypeIcon } from "#/components/shared/file-type-icon";
import type { HotFile, MapActivity } from "#/lib/product-map/activity";
import { AreaActivity } from "./area-activity";
import { AreaFlow } from "./area-flow";
import { blobLink, CodeLink, type RepoLinks } from "./code-link";
import { formatShortDate, plural, shortPath } from "./map-format";
import { featureIcon } from "./map-icons";
import { MarkTooltips } from "./mark-tooltips";
import { isCounting, type LoadedProductMap } from "./product-map-data";
import { sampleArea, sampleProductMap } from "./product-map-samples";
import type { AreaFeature, ProductArea } from "./product-map-types";
import { PullCell } from "./work/area-work";
import { PersonAvatar } from "./work-row";

export const AREA_SECTIONS = ["how", "inside", "code", "activity"] as const;

export type AreaSection = (typeof AREA_SECTIONS)[number];

function Section({
	id,
	title,
	description,
	children,
}: {
	id: AreaSection;
	title: string;
	description: string;
	children: ReactNode;
}) {
	return (
		<section
			data-area-section={id}
			className="mt-24 flex scroll-mt-10 flex-col gap-6 max-md:mt-14 max-md:scroll-mt-20"
		>
			<header className="flex flex-col gap-0.5">
				<h2 className="font-medium text-[15px] text-foreground">{title}</h2>
				<p className="text-pretty text-[13px] text-muted-foreground">
					{description}
				</p>
			</header>
			{children}
		</section>
	);
}

type Theme = "light" | "dark";

/** The area's own screenshots, served from the repository like README images. */
function ScreenPreview({
	area,
	screen,
	repo,
}: {
	area: ProductArea;
	screen: NonNullable<ProductArea["screen"]>;
	repo: RepoLinks;
}) {
	const [failed, setFailed] = useState<readonly Theme[]>([]);
	if (failed.length === 2) return null;
	const label = `${area.name}, as it looks in the product`;
	const raw = (path: string) =>
		`https://github.com/${repo.owner}/${repo.repo}/raw/${repo.branch}/${path}`;
	const image = (theme: Theme, className: string) =>
		failed.includes(theme) ? null : (
			<img
				src={raw(screen[theme])}
				alt={label}
				width={1280}
				height={800}
				loading="lazy"
				onError={() => setFailed((current) => [...current, theme])}
				className={className}
			/>
		);
	return (
		<figure className="overflow-hidden rounded-lg bg-card shadow-card empty:hidden">
			{image("light", "block h-auto w-full dark:hidden")}
			{image("dark", "hidden h-auto w-full dark:block")}
		</figure>
	);
}

/**
 * One part of an area: what it is, in full, and the file it starts in. Nothing
 * is folded away, so the list can be read straight down.
 */
function FeatureItem({
	feature,
	repo,
}: {
	feature: AreaFeature;
	repo: RepoLinks;
}) {
	const Icon = featureIcon(feature.name, feature.path ?? "");
	return (
		<li className="flex items-start gap-3">
			<span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-button text-muted-foreground shadow-button">
				<Icon size={14} strokeWidth={2} />
			</span>
			<span className="flex min-w-0 flex-col items-start gap-0.5">
				<span className="font-medium text-[13px] text-foreground">
					{feature.name}
				</span>
				<span className="text-pretty text-muted-foreground text-xs leading-[1.5]">
					{feature.summary}
				</span>
				{feature.path ? (
					<span className="mt-2 flex max-w-full">
						<CodeLink reference={{ path: feature.path }} repo={repo} />
					</span>
				) : null}
			</span>
		</li>
	);
}

function FeatureList({
	features,
	repo,
}: {
	features: AreaFeature[];
	repo: RepoLinks;
}) {
	return (
		<ul className="grid items-start gap-x-8 gap-y-6 sm:grid-cols-2">
			{features.map((feature) => (
				<FeatureItem key={feature.name} feature={feature} repo={repo} />
			))}
		</ul>
	);
}

/** How many of a file's pull requests get a cell before the older ones are only counted. */
const FILE_CELLS = 10;
const FILE_AUTHORS = 3;

/**
 * One of the area's most changed files: the pull requests that changed it as
 * cells (stronger for more lines in this file, red for a fix), who made them
 * and when it last changed. The path opens the file; a cell opens its pull
 * request.
 */
function HotFileRow({
	file,
	activity,
	repo,
}: {
	file: HotFile;
	activity: MapActivity;
	repo: RepoLinks;
}) {
	const changes = file.changes.flatMap((change) => {
		const pull = activity.pulls[change.pull];
		return pull ? [{ pull, lines: change.lines }] : [];
	});
	const shown = changes.slice(-FILE_CELLS);
	const older = changes.length - shown.length;
	const latest = changes.at(-1)?.pull;
	// Most recent author first, each once.
	const authors = [
		...new Set(changes.map(({ pull }) => pull.author).reverse()),
	].slice(0, FILE_AUTHORS);
	const slash = file.path.lastIndexOf("/");
	const short = shortPath(file.path);
	const folder = short.slice(0, short.lastIndexOf("/") + 1);

	return (
		<div className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-row-hover">
			<Link
				{...blobLink(repo, file)}
				title={file.path}
				className="flex min-w-0 flex-1 items-center gap-3"
			>
				<FileTypeIcon path={file.path} size={15} />
				<span className="min-w-0 truncate font-mono text-[12px] text-foreground">
					<span className="text-muted-foreground">{folder}</span>
					{file.path.slice(slash + 1)}
				</span>
			</Link>
			<MarkTooltips>
				<ul
					aria-label={`${plural(changes.length, "pull request")} changed this file`}
					className="flex shrink-0 gap-px"
				>
					{older > 0 ? (
						<li className="flex overflow-hidden first:rounded-l-[4px]">
							<Tooltip>
								<TooltipTrigger asChild>
									<span className="flex h-3.5 items-center bg-foreground/10 px-1.5 font-medium text-[10px] text-muted-foreground tabular-nums">
										+{older}
									</span>
								</TooltipTrigger>
								<TooltipContent>
									{plural(older, "earlier pull request")}
								</TooltipContent>
							</Tooltip>
						</li>
					) : null}
					{shown.map(({ pull, lines }) => (
						<li
							key={pull.number}
							className="flex overflow-hidden first:rounded-l-[4px] last:rounded-r-[4px]"
						>
							<PullCell pull={pull} lines={lines} repo={repo}>
								#{pull.number} · {plural(lines, "line")} here
							</PullCell>
						</li>
					))}
				</ul>
			</MarkTooltips>
			<span className="flex w-12 shrink-0 items-center justify-end max-sm:hidden">
				{authors.map((login, index) => (
					<PersonAvatar
						key={login}
						login={login}
						avatarUrl={activity.people[login]?.avatarUrl ?? null}
						title={login}
						className={cn("size-4 ring-2 ring-card", index > 0 && "-ml-1.5")}
					/>
				))}
			</span>
			{latest ? (
				<time
					dateTime={latest.date}
					className="min-w-11 shrink-0 text-right font-[450] text-muted-foreground text-xs tabular-nums"
				>
					{formatShortDate(latest.date)}
				</time>
			) : null}
		</div>
	);
}

export function AreaSheet({
	area,
	map,
}: {
	area: ProductArea;
	map: LoadedProductMap;
}) {
	const repo: RepoLinks = {
		owner: map.repo.owner,
		repo: map.repo.name,
		branch: map.repo.branch,
	};
	// The files most pull requests changed are only known once GitHub is
	// counted; until then the sample's hold the section's place.
	const counting = isCounting(map);
	const counted = counting
		? sampleProductMap(map.repo.owner, map.repo.name)
		: map;
	const { activity } = counted;
	const hotFiles =
		activity?.areas[counting ? sampleArea(counted).id : area.id]?.hotFiles ??
		[];
	const group = map.bands
		.flatMap((band) => band.groups)
		.find((candidate) => candidate.areas.includes(area.id));

	return (
		<>
			<header className="flex flex-col gap-2">
				<h1 className="text-pretty font-semibold text-[23px] text-foreground leading-8 tracking-[-0.01em]">
					{area.name}
				</h1>
				<p className="font-[450] text-[13px] text-muted-foreground">
					{group?.name}
				</p>
			</header>
			<p className="text-pretty text-[15px] text-foreground leading-6">
				{area.summary}
			</p>
			{area.screen ? (
				<ScreenPreview
					key={area.id}
					area={area}
					screen={area.screen}
					repo={repo}
				/>
			) : null}

			{area.flow.length > 0 ? (
				<Section
					id="how"
					title="How it works"
					description="The path one request takes, and where each step runs."
				>
					<AreaFlow key={area.id} steps={area.flow} repo={repo} />
				</Section>
			) : null}

			{area.features.length > 0 ? (
				<Section
					id="inside"
					title="What is inside"
					description={`${plural(area.features.length, "part")}, each with the file it starts in.`}
				>
					<FeatureList key={area.id} features={area.features} repo={repo} />
				</Section>
			) : null}

			{hotFiles.length > 0 ? (
				<Skeleton loading={counting} label="Counting on GitHub">
					<Section
						id="code"
						title="Where the work happens"
						description="The files here that the most pull requests changed, with each of those pull requests."
					>
						<SectionCard className="[&>div:last-child]:pb-0">
							{activity
								? hotFiles.map((file) => (
										<HotFileRow
											key={file.path}
											file={file}
											activity={activity}
											repo={repo}
										/>
									))
								: null}
						</SectionCard>
					</Section>
				</Skeleton>
			) : null}

			<Section
				id="activity"
				title="What is happening"
				description="Pull requests merged per week, then every pull request that changed this area."
			>
				<AreaActivity key={area.id} area={area} map={map} repo={repo} />
			</Section>

			<div data-area-end aria-hidden className="h-px" />
		</>
	);
}
