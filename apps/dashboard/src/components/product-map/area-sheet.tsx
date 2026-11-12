import {
	AlertCircleIcon,
	ChevronRightIcon,
	CircleCheckIcon,
} from "@diffkit/icons";
import { Chip } from "@diffkit/ui/components/chip";
import { cn } from "@diffkit/ui/lib/utils";
import { useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { AreaActivity } from "./area-activity";
import {
	formatCount,
	formatShortDate,
	githubBlobUrl,
	plural,
	shortPath,
} from "./map-format";
import { areaIcon, stepKind } from "./map-icons";
import type { LoadedProductMap } from "./product-map-data";
import type {
	AreaFeature,
	CodeReference,
	FlowStep,
	ProductArea,
} from "./product-map-types";
import { SheetSection } from "./sheet-section";

type RepoLinks = { url: string; branch: string };

function CodeLink({
	reference,
	repo,
}: {
	reference: { path: string; line?: number };
	repo: RepoLinks;
}) {
	return (
		<a
			href={githubBlobUrl(
				repo.url,
				repo.branch,
				reference.path,
				reference.line,
			)}
			target="_blank"
			rel="noreferrer"
			title={reference.path}
			className="inline-flex h-5.5 max-w-full items-center rounded-[5px] bg-inline-code px-1.5 font-mono text-[11px] text-text-header transition-colors hover:text-foreground"
		>
			<span className="truncate">
				{shortPath(reference.path)}
				{reference.line ? `:${reference.line}` : ""}
			</span>
		</a>
	);
}

const STEP_INTERVAL_MS = 1400;

function useTravellingStep(count: number) {
	const reduceMotion = useReducedMotion();
	const [step, setStep] = useState(0);
	const [held, setHeld] = useState<number | null>(null);

	useEffect(() => {
		if (reduceMotion || held !== null || count < 2) return;
		const timer = window.setInterval(
			() => setStep((current) => (current + 1) % count),
			STEP_INTERVAL_MS,
		);
		return () => window.clearInterval(timer);
	}, [reduceMotion, held, count]);

	return { active: held ?? step, hold: setHeld };
}

function AreaFlow({ steps, repo }: { steps: FlowStep[]; repo: RepoLinks }) {
	const { active, hold } = useTravellingStep(steps.length);

	return (
		<ol
			className="flex flex-col lg:flex-row lg:items-stretch"
			onPointerLeave={() => hold(null)}
		>
			{steps.map((step, index) => {
				const kind = stepKind(step.kind);
				const reached = index <= active;
				return (
					<li
						key={`${step.kind}:${step.label}`}
						className="flex min-w-0 flex-1 flex-col lg:flex-row"
					>
						{index > 0 ? (
							<span
								aria-hidden
								className={cn(
									"mx-auto h-3 w-px shrink-0 transition-colors duration-300 lg:my-auto lg:h-px lg:w-4",
									reached ? "bg-indigo" : "bg-card-border",
								)}
							/>
						) : null}
						<div
							onPointerEnter={() => hold(index)}
							className={cn(
								"flex min-w-0 flex-1 flex-col gap-1 -outline-offset-1 rounded-lg bg-card p-2.5 shadow-card",
								index === active &&
									"outline-[1.5px] outline-indigo outline-solid",
							)}
						>
							<span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
								<kind.icon size={12} strokeWidth={2} className="shrink-0" />
								{kind.label}
							</span>
							<span className="font-medium text-[13px] text-foreground leading-5">
								{step.label}
							</span>
							<span className="text-pretty text-muted-foreground text-xs">
								{step.note}
							</span>
							{step.path ? (
								<span className="mt-auto pt-1">
									<CodeLink reference={{ path: step.path }} repo={repo} />
								</span>
							) : null}
						</div>
					</li>
				);
			})}
		</ol>
	);
}

function FeatureCard({
	feature,
	repo,
}: {
	feature: AreaFeature;
	repo: RepoLinks;
}) {
	return (
		<li className="flex flex-col gap-1.5 rounded-lg bg-card p-3 shadow-card">
			<span className="font-medium text-[13px] text-foreground">
				{feature.name}
			</span>
			<span className="text-pretty text-muted-foreground text-xs">
				{feature.summary}
			</span>
			<span className="mt-auto flex flex-wrap gap-1 pt-1">
				{feature.entry.map((entry) => (
					<CodeLink
						key={`${entry.path}:${entry.symbol ?? ""}`}
						reference={entry}
						repo={repo}
					/>
				))}
			</span>
		</li>
	);
}

function EntryPointRow({
	entry,
	repo,
}: {
	entry: CodeReference;
	repo: RepoLinks;
}) {
	return (
		<li>
			<a
				href={githubBlobUrl(repo.url, repo.branch, entry.path, entry.line)}
				target="_blank"
				rel="noreferrer"
				className="group/entry grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-3 py-2 transition-colors hover:bg-row-hover"
			>
				<span className="min-w-0">
					<span className="block truncate font-mono text-[12px] text-foreground">
						{entry.symbol ?? shortPath(entry.path)}
					</span>
					<span className="block truncate text-muted-foreground text-xs">
						{entry.role}
					</span>
				</span>
				<span className="flex min-w-0 items-center gap-1 font-mono text-[11px] text-muted-foreground max-sm:hidden">
					<span className="truncate">
						{entry.path}
						{entry.line ? `:${entry.line}` : ""}
					</span>
					<ChevronRightIcon
						size={12}
						className="shrink-0 opacity-0 transition-opacity group-hover/entry:opacity-100"
					/>
				</span>
			</a>
		</li>
	);
}

function ConnectionList({
	title,
	ids,
	map,
	onNavigate,
}: {
	title: string;
	ids: string[];
	map: LoadedProductMap;
	onNavigate: (id: string) => void;
}) {
	if (ids.length === 0) return null;
	return (
		<div className="flex min-w-0 flex-col gap-1.5">
			<span className="text-muted-foreground text-xs">{title}</span>
			<div className="flex flex-wrap gap-1.5">
				{ids.map((id) => {
					const area = map.areaById.get(id);
					if (!area) return null;
					const Icon = areaIcon(area.icon);
					return (
						<button
							key={id}
							type="button"
							onClick={() => onNavigate(id)}
							className="inline-flex h-7 items-center gap-1.5 rounded-md bg-button px-2 font-[450] text-foreground text-xs shadow-button transition-colors hover:bg-button-hover"
						>
							<Icon
								size={13}
								strokeWidth={2}
								className="text-muted-foreground"
							/>
							{area.name}
						</button>
					);
				})}
			</div>
		</div>
	);
}

function NoteList({
	items,
	tone,
}: {
	items: string[];
	tone: "good" | "watch";
}) {
	const Icon = tone === "good" ? CircleCheckIcon : AlertCircleIcon;
	return (
		<>
			{items.map((item) => (
				<li key={item} className="flex gap-2 px-3 py-2">
					<Icon
						size={14}
						strokeWidth={2}
						className={cn(
							"mt-0.5 shrink-0",
							tone === "good" ? "text-success" : "text-warning",
						)}
					/>
					<span className="text-pretty text-foreground text-xs leading-5">
						{item}
					</span>
				</li>
			))}
		</>
	);
}

function AreaFacts({ area }: { area: ProductArea }) {
	const { stats } = area;
	return (
		<div className="flex flex-wrap gap-1.5">
			<Chip>{formatCount(stats.loc)} lines</Chip>
			<Chip>{plural(stats.files, "file")}</Chip>
			<Chip>{plural(stats.testFiles, "test file")}</Chip>
			<Chip>{plural(stats.mergedPulls, "merged PR")}</Chip>
			<Chip>last change {formatShortDate(stats.lastTouched)}</Chip>
		</div>
	);
}

export function AreaSheet({
	area,
	map,
	onNavigate,
}: {
	area: ProductArea;
	map: LoadedProductMap;
	onNavigate: (id: string) => void;
}) {
	const Icon = areaIcon(area.icon);
	const repo: RepoLinks = {
		url: map.repo.url,
		branch: map.repo.defaultBranch,
	};
	const band = map.bands.find((candidate) =>
		candidate.groups.some((group) => group.areas.includes(area.id)),
	);
	const group = band?.groups.find((candidate) =>
		candidate.areas.includes(area.id),
	);

	return (
		<article className="mx-auto flex w-full max-w-[62rem] flex-col gap-8 px-6 pt-6 pb-24 max-md:px-4 max-md:pt-4">
			<header className="flex flex-col gap-3">
				<span className="flex items-center gap-1.5 text-muted-foreground text-xs">
					{band?.name}
					<span aria-hidden>›</span>
					{group?.name}
				</span>
				<h2 className="flex items-center gap-2.5 font-semibold text-2xl text-foreground tracking-[-0.01em]">
					<span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-card shadow-card">
						<Icon size={17} strokeWidth={1.8} />
					</span>
					{area.name}
				</h2>
				<p className="max-w-[46rem] text-pretty text-foreground text-lg">
					{area.summary}
				</p>
				<AreaFacts area={area} />
			</header>

			<SheetSection title="How it works">
				<p className="max-w-[46rem] text-pretty text-[13px] text-muted-foreground leading-[1.55]">
					{area.how}
				</p>
				<AreaFlow key={area.id} steps={area.flow} repo={repo} />
			</SheetSection>

			<SheetSection
				title="What is inside"
				aside={plural(area.features.length, "part")}
			>
				<ul className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-2">
					{area.features.map((feature) => (
						<FeatureCard key={feature.name} feature={feature} repo={repo} />
					))}
				</ul>
			</SheetSection>

			<SheetSection title="Ways into the code" aside="opens on GitHub">
				<ul className="divide-y-[0.5px] divide-rule overflow-hidden rounded-lg bg-card shadow-card">
					{area.entryPoints.map((entry) => (
						<EntryPointRow
							key={`${entry.path}:${entry.symbol ?? ""}`}
							entry={entry}
							repo={repo}
						/>
					))}
				</ul>
			</SheetSection>

			<AreaActivity area={area} map={map} />

			<SheetSection title="Connected to">
				<div className="flex flex-wrap gap-x-8 gap-y-3">
					<ConnectionList
						title="Builds on"
						ids={area.dependsOn}
						map={map}
						onNavigate={onNavigate}
					/>
					<ConnectionList
						title="Used by"
						ids={area.usedBy}
						map={map}
						onNavigate={onNavigate}
					/>
				</div>
			</SheetSection>

			{area.goodParts.length + area.watch.length > 0 ? (
				<SheetSection title="Worth knowing" aside="from reading the code">
					<ul className="divide-y-[0.5px] divide-rule overflow-hidden rounded-lg bg-card shadow-card">
						<NoteList items={area.goodParts} tone="good" />
						<NoteList items={area.watch} tone="watch" />
					</ul>
				</SheetSection>
			) : null}
		</article>
	);
}
