import { AlertCircleIcon, CircleCheckIcon } from "@diffkit/icons";
import { SectionCard } from "@diffkit/ui/components/section-card";
import { cn } from "@diffkit/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { FileTypeIcon } from "#/components/shared/file-type-icon";
import { AreaActivity } from "./area-activity";
import { AreaFlow } from "./area-flow";
import { blobLink, CodeLink, type RepoLinks } from "./code-link";
import { formatShortDate, plural, shortPath } from "./map-format";
import { featureIcon } from "./map-icons";
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

function FeatureItem({
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
	const Icon = featureIcon(feature.name, feature.entry[0]?.path ?? "");
	return (
		<li
			className={cn(
				"-mx-2.5 flex flex-col rounded-lg transition-colors",
				open ? "bg-item-hover" : "hover:bg-item-hover",
			)}
		>
			<button
				type="button"
				aria-expanded={open}
				onClick={onToggle}
				className="flex items-start gap-3 rounded-lg p-2.5 text-left"
			>
				<span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-button text-muted-foreground shadow-button">
					<Icon size={14} strokeWidth={2} />
				</span>
				<span className="flex min-w-0 flex-col gap-0.5">
					<span className="font-medium text-[13px] text-foreground">
						{feature.name}
					</span>
					<span
						className={cn(
							"text-pretty text-muted-foreground text-xs leading-[1.5]",
							!open && "line-clamp-2",
						)}
					>
						{feature.summary}
					</span>
				</span>
			</button>
			{open ? (
				<span className="flex flex-wrap gap-1 pr-2.5 pb-2.5 pl-[3.375rem]">
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

function FeatureList({
	features,
	repo,
}: {
	features: AreaFeature[];
	repo: RepoLinks;
}) {
	const [openFeature, setOpenFeature] = useState<string | null>(null);
	return (
		<ul className="grid items-start gap-x-8 gap-y-1 sm:grid-cols-2">
			{features.map((feature) => (
				<FeatureItem
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
		<Link
			{...blobLink(repo, entry)}
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
		</Link>
	);
}

function NoteList({
	label,
	notes,
	tone,
}: {
	label: string;
	notes: string[];
	tone: "good" | "watch";
}) {
	if (notes.length === 0) return null;
	const Icon = tone === "good" ? CircleCheckIcon : AlertCircleIcon;
	return (
		<div className="flex flex-col gap-2.5">
			<h3 className="font-[450] text-muted-foreground text-xs">{label}</h3>
			<ul className="flex flex-col gap-3">
				{notes.map((text) => (
					<li key={text} className="flex gap-3">
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
					</li>
				))}
			</ul>
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

			<Section
				id="how"
				title="How it works"
				description="The path one request takes, and where each step runs."
			>
				<AreaFlow key={area.id} steps={area.flow} repo={repo} />
			</Section>

			<Section
				id="inside"
				title="What is inside"
				description={`${plural(area.features.length, "part")}. Open one for its code.`}
			>
				<FeatureList key={area.id} features={area.features} repo={repo} />
			</Section>

			<Section
				id="code"
				title="Ways into the code"
				description="Where to start reading."
			>
				<SectionCard className="[&>div:last-child]:pb-0">
					{area.entryPoints.map((entry) => (
						<EntryPointRow
							key={`${entry.path}:${entry.symbol ?? ""}`}
							entry={entry}
							repo={repo}
						/>
					))}
				</SectionCard>
			</Section>

			<Section
				id="activity"
				title="What is happening"
				description={`Commits per week since ${formatShortDate(map.repo.firstCommit)}, then every pull request that changed this area.`}
			>
				<AreaActivity key={area.id} area={area} map={map} repo={repo} />
			</Section>

			{area.goodParts.length + area.watch.length > 0 ? (
				<Section
					id="notes"
					title="Worth knowing"
					description="Found by reading the code, each with its evidence."
				>
					<div className="flex flex-col gap-8">
						<NoteList label="Done well" notes={area.goodParts} tone="good" />
						<NoteList label="Rough edges" notes={area.watch} tone="watch" />
					</div>
				</Section>
			) : null}
			<div data-area-end aria-hidden className="h-px" />
		</>
	);
}
