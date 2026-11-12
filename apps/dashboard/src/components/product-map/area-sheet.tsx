import { SectionCard } from "@diffkit/ui/components/section-card";
import { cn } from "@diffkit/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { FileTypeIcon } from "#/components/shared/file-type-icon";
import { AreaActivity } from "./area-activity";
import { AreaFlow } from "./area-flow";
import { blobLink, CodeLink, type RepoLinks } from "./code-link";
import { plural, shortPath } from "./map-format";
import { featureIcon } from "./map-icons";
import type { LoadedProductMap } from "./product-map-data";
import type { AreaFeature, ProductArea } from "./product-map-types";

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
	const Icon = featureIcon(feature.name, feature.path ?? "");
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
			{open && feature.path ? (
				<span className="flex pr-2.5 pb-2.5 pl-[3.375rem]">
					<CodeLink reference={{ path: feature.path }} repo={repo} />
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

/** One of the area's most changed files, with how many pull requests changed it. */
function HotFileRow({
	file,
	repo,
}: {
	file: { path: string; pulls: number };
	repo: RepoLinks;
}) {
	return (
		<Link
			{...blobLink(repo, file)}
			title={file.path}
			className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-row-hover"
		>
			<FileTypeIcon path={file.path} size={15} />
			<span className="min-w-0 flex-1 truncate font-mono text-[12px] text-foreground">
				{shortPath(file.path)}
			</span>
			<span className="shrink-0 font-[450] text-muted-foreground text-xs tabular-nums">
				{plural(file.pulls, "pull request")}
			</span>
		</Link>
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
	const hotFiles = map.activity?.areas[area.id]?.hotFiles ?? [];
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
					description={`${plural(area.features.length, "part")}. Open one to read more.`}
				>
					<FeatureList key={area.id} features={area.features} repo={repo} />
				</Section>
			) : null}

			{hotFiles.length > 0 ? (
				<Section
					id="code"
					title="Where the work happens"
					description="The files here that the most pull requests changed. A good place to start reading."
				>
					<SectionCard className="[&>div:last-child]:pb-0">
						{hotFiles.map((file) => (
							<HotFileRow key={file.path} file={file} repo={repo} />
						))}
					</SectionCard>
				</Section>
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
