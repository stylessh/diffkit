import { AlertCircleIcon, CircleCheckIcon } from "@diffkit/icons";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@diffkit/ui/components/accordion";
import { cn } from "@diffkit/ui/lib/utils";
import { type PointerEvent, useState } from "react";
import { AreaActivity } from "./area-activity";
import { githubBlobUrl, shortPath } from "./map-format";
import { stepKind } from "./map-icons";
import type { LoadedProductMap } from "./product-map-data";
import type {
	AreaFeature,
	CodeReference,
	FlowStep,
	ProductArea,
} from "./product-map-types";

export const AREA_TABS = [
	"how",
	"inside",
	"code",
	"activity",
	"notes",
] as const;

export type AreaTab = (typeof AREA_TABS)[number];

type RepoLinks = { url: string; branch: string };

const cardListClassName =
	"divide-y-[0.5px] divide-rule overflow-hidden rounded-lg bg-card shadow-card";

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

function AreaFlow({ steps, repo }: { steps: FlowStep[]; repo: RepoLinks }) {
	const [selected, setSelected] = useState(0);
	const step = steps[selected];
	const kind = stepKind(step.kind);

	return (
		<div className="flex flex-col gap-5">
			<ol className="no-scrollbar -mx-1 flex overflow-x-auto px-1 py-1">
				{steps.map((candidate, index) => {
					const Icon = stepKind(candidate.kind).icon;
					const active = index === selected;
					const select = (event: PointerEvent<HTMLButtonElement>) => {
						if (event.pointerType === "mouse") setSelected(index);
					};
					return (
						<li
							key={`${candidate.kind}:${candidate.label}`}
							className="relative min-w-[5.5rem] flex-1 before:absolute before:top-[18px] before:right-1/2 before:h-px before:w-full before:bg-card-border first:before:hidden"
						>
							<button
								type="button"
								aria-pressed={active}
								onClick={() => setSelected(index)}
								onPointerEnter={select}
								className="group/step relative flex w-full flex-col items-center gap-2 rounded-lg outline-none"
							>
								<span
									className={cn(
										"-outline-offset-1 flex size-9 items-center justify-center rounded-full bg-button text-muted-foreground shadow-button transition-colors group-focus-visible/step:outline-2 group-focus-visible/step:outline-focus group-focus-visible/step:outline-solid",
										active &&
											"text-foreground outline-[1.5px] outline-indigo outline-solid",
									)}
								>
									<Icon size={15} strokeWidth={2} />
								</span>
								<span
									className={cn(
										"px-1 text-center font-[450] text-xs leading-4 transition-colors",
										active ? "text-foreground" : "text-muted-foreground",
									)}
								>
									{candidate.label}
								</span>
							</button>
						</li>
					);
				})}
			</ol>
			<div className="flex flex-col items-start gap-2 rounded-lg bg-group px-4 py-3.5">
				<span className="text-muted-foreground text-xs">
					{selected + 1} of {steps.length} · {kind.label}
				</span>
				<p className="text-pretty text-[13px] text-foreground leading-5">
					{step.note}
				</p>
				{step.path ? (
					<CodeLink reference={{ path: step.path }} repo={repo} />
				) : null}
			</div>
		</div>
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
		<Accordion type="single" collapsible className={cardListClassName}>
			{features.map((feature) => (
				<AccordionItem
					key={feature.name}
					value={feature.name}
					className="border-0"
				>
					<AccordionTrigger className="px-3 py-2.5 font-medium text-[13px] hover:bg-row-hover hover:no-underline">
						{feature.name}
					</AccordionTrigger>
					<AccordionContent className="flex flex-col gap-2.5 px-3 pb-3">
						<p className="text-pretty text-[13px] text-muted-foreground leading-5">
							{feature.summary}
						</p>
						<span className="flex flex-wrap gap-1">
							{feature.entry.map((entry) => (
								<CodeLink
									key={`${entry.path}:${entry.symbol ?? ""}`}
									reference={entry}
									repo={repo}
								/>
							))}
						</span>
					</AccordionContent>
				</AccordionItem>
			))}
		</Accordion>
	);
}

function EntryPointList({
	entries,
	repo,
}: {
	entries: CodeReference[];
	repo: RepoLinks;
}) {
	return (
		<ul className={cardListClassName}>
			{entries.map((entry) => (
				<li key={`${entry.path}:${entry.symbol ?? ""}`}>
					<a
						href={githubBlobUrl(repo.url, repo.branch, entry.path, entry.line)}
						target="_blank"
						rel="noreferrer"
						title={`${entry.path}${entry.line ? `:${entry.line}` : ""}`}
						className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-row-hover"
					>
						<span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
							{entry.role}
						</span>
						<span className="max-w-[45%] shrink-0 truncate font-mono text-[11px] text-muted-foreground">
							{entry.symbol ?? shortPath(entry.path)}
						</span>
					</a>
				</li>
			))}
		</ul>
	);
}

function NoteList({ area }: { area: ProductArea }) {
	const notes = [
		...area.goodParts.map((text) => ({ text, tone: "good" as const })),
		...area.watch.map((text) => ({ text, tone: "watch" as const })),
	];
	return (
		<ul className={cardListClassName}>
			{notes.map(({ text, tone }) => {
				const Icon = tone === "good" ? CircleCheckIcon : AlertCircleIcon;
				return (
					<li key={text} className="flex gap-2.5 px-3 py-2.5">
						<Icon
							size={14}
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
				);
			})}
		</ul>
	);
}

export function AreaSheet({
	area,
	map,
	tab,
}: {
	area: ProductArea;
	map: LoadedProductMap;
	tab: AreaTab;
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
			<section className="border-header-rule border-t-[0.5px] pt-6">
				{tab === "how" ? (
					<AreaFlow key={area.id} steps={area.flow} repo={repo} />
				) : null}
				{tab === "inside" ? (
					<FeatureList key={area.id} features={area.features} repo={repo} />
				) : null}
				{tab === "code" ? (
					<EntryPointList entries={area.entryPoints} repo={repo} />
				) : null}
				{tab === "activity" ? (
					<AreaActivity key={area.id} area={area} map={map} />
				) : null}
				{tab === "notes" ? <NoteList area={area} /> : null}
			</section>
		</>
	);
}
