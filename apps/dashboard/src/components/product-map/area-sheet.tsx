import { AlertCircleIcon, CircleCheckIcon } from "@diffkit/icons";
import { SectionCard } from "@diffkit/ui/components/section-card";
import { cn } from "@diffkit/ui/lib/utils";
import { type ReactNode, useState } from "react";
import { FileTypeIcon } from "#/components/shared/file-type-icon";
import { AreaActivity } from "./area-activity";
import { AreaFlow } from "./area-flow";
import { CodeLink, type RepoLinks } from "./code-link";
import {
	formatShortDate,
	githubBlobUrl,
	plural,
	shortPath,
} from "./map-format";
import { pathKind, stepKind } from "./map-icons";
import type { LoadedProductMap } from "./product-map-data";
import type {
	AreaFeature,
	CodeReference,
	ProductArea,
} from "./product-map-types";

export const AREA_SECTIONS = [
	"how",
	"inside",
	"code",
	"activity",
	"notes",
] as const;

export type AreaSection = (typeof AREA_SECTIONS)[number];

function Section({ id, children }: { id: AreaSection; children: ReactNode }) {
	return (
		<div data-area-section={id} className="scroll-mt-6 max-md:scroll-mt-16">
			{children}
		</div>
	);
}

function ScreenPreview({ area }: { area: ProductArea }) {
	const label = `${area.name}, as it looks in demo mode`;
	return (
		<figure className="overflow-hidden rounded-lg bg-card shadow-card">
			<img
				src={`/product-map/${area.id}-light.jpg`}
				alt={label}
				width={1280}
				height={800}
				loading="lazy"
				className="block h-auto w-full dark:hidden"
			/>
			<img
				src={`/product-map/${area.id}-dark.jpg`}
				alt={label}
				width={1280}
				height={800}
				loading="lazy"
				className="hidden h-auto w-full dark:block"
			/>
		</figure>
	);
}

function FeatureCell({
	feature,
	open,
	onToggle,
	repo,
}: {
	feature: AreaFeature;
	open: boolean;
	onToggle: () => void;
	repo: RepoLinks;
}) {
	const Icon = stepKind(pathKind(feature.entry[0]?.path ?? "")).icon;
	return (
		<li className="flex flex-col bg-card">
			<button
				type="button"
				aria-expanded={open}
				onClick={onToggle}
				className="flex flex-1 items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-row-hover"
			>
				<span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-group text-muted-foreground">
					<Icon size={14} strokeWidth={2} />
				</span>
				<span className="flex min-w-0 flex-col gap-0.5">
					<span className="font-medium text-[13px] text-foreground">
						{feature.name}
					</span>
					<span
						className={cn(
							"text-pretty text-muted-foreground text-xs leading-[1.5]",
							!open && "line-clamp-1",
						)}
					>
						{feature.summary}
					</span>
				</span>
			</button>
			{open ? (
				<span className="flex flex-wrap gap-1 px-4 pb-3.5 pl-[3.25rem]">
					{feature.entry.map((entry) => (
						<CodeLink
							key={`${entry.path}:${entry.symbol ?? ""}`}
							reference={entry}
							repo={repo}
						/>
					))}
				</span>
			) : null}
		</li>
	);
}

function FeatureGrid({
	features,
	repo,
}: {
	features: AreaFeature[];
	repo: RepoLinks;
}) {
	const [openFeature, setOpenFeature] = useState<string | null>(null);
	return (
		<ul className="grid gap-px bg-rule sm:grid-cols-2">
			{features.map((feature) => (
				<FeatureCell
					key={feature.name}
					feature={feature}
					open={feature.name === openFeature}
					onToggle={() =>
						setOpenFeature((current) =>
							current === feature.name ? null : feature.name,
						)
					}
					repo={repo}
				/>
			))}
			{features.length % 2 === 1 ? (
				<li aria-hidden className="bg-card max-sm:hidden" />
			) : null}
		</ul>
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
		<a
			href={githubBlobUrl(repo.url, repo.branch, entry.path, entry.line)}
			target="_blank"
			rel="noreferrer"
			title={`${entry.path}${entry.line ? `:${entry.line}` : ""}`}
			className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-row-hover"
		>
			<FileTypeIcon path={entry.path} size={15} />
			<span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
				{entry.role}
			</span>
			<span className="max-w-[45%] shrink-0 truncate font-mono text-[11px] text-muted-foreground">
				{entry.symbol ?? shortPath(entry.path)}
			</span>
		</a>
	);
}

function NoteRow({ text, tone }: { text: string; tone: "good" | "watch" }) {
	const Icon = tone === "good" ? CircleCheckIcon : AlertCircleIcon;
	return (
		<div className="flex gap-3 px-4 py-2.5">
			<Icon
				size={15}
				strokeWidth={2}
				className={cn(
					"mt-[3px] shrink-0",
					tone === "good" ? "text-success" : "text-warning",
				)}
			/>
			<span className="text-pretty text-[13px] text-foreground leading-5">
				{text}
			</span>
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
		url: map.repo.url,
		branch: map.repo.defaultBranch,
	};
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
			{area.screen ? <ScreenPreview area={area} /> : null}

			<Section id="how">
				<SectionCard
					title="How it works"
					description="The path one request takes, and where each step runs."
				>
					<AreaFlow key={area.id} steps={area.flow} repo={repo} />
				</SectionCard>
			</Section>

			<Section id="inside">
				<SectionCard
					title="What is inside"
					description={`${plural(area.features.length, "part")}. Open one for its code.`}
					className="[&>div:last-child]:pb-0"
				>
					<FeatureGrid key={area.id} features={area.features} repo={repo} />
				</SectionCard>
			</Section>

			<Section id="code">
				<SectionCard
					title="Ways into the code"
					description="Where to start reading. Opens on GitHub."
				>
					{area.entryPoints.map((entry) => (
						<EntryPointRow
							key={`${entry.path}:${entry.symbol ?? ""}`}
							entry={entry}
							repo={repo}
						/>
					))}
				</SectionCard>
			</Section>

			<Section id="activity">
				<SectionCard
					title="What is happening"
					description={`${plural(area.stats.commits, "commit")} since ${formatShortDate(map.repo.firstCommit)}, ${area.stats.commitsLast30} in the last 30 days.`}
				>
					<AreaActivity key={area.id} area={area} map={map} />
				</SectionCard>
			</Section>

			{area.goodParts.length + area.watch.length > 0 ? (
				<Section id="notes">
					<SectionCard
						title="Worth knowing"
						description="Found by reading the code, each with its evidence."
					>
						{area.goodParts.map((text) => (
							<NoteRow key={text} text={text} tone="good" />
						))}
						{area.watch.map((text) => (
							<NoteRow key={text} text={text} tone="watch" />
						))}
					</SectionCard>
				</Section>
			) : null}
			<div data-area-end aria-hidden className="h-px" />
		</>
	);
}
