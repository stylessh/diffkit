import {
	CodeSimpleIcon,
	GitMergeIcon,
	GitPullRequestIcon,
	IssuesIcon,
} from "@diffkit/icons";
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@diffkit/ui/components/command";
import { useMemo } from "react";
import { shortPath } from "./map-format";
import { areaIcon } from "./map-icons";
import type { LoadedProductMap } from "./product-map-data";

type CodeHit = {
	key: string;
	areaId: string;
	areaName: string;
	label: string;
	path: string;
};

function collectCode(map: LoadedProductMap): CodeHit[] {
	const hits = new Map<string, CodeHit>();
	for (const area of map.areas) {
		const references = [
			...area.entryPoints,
			...area.features.flatMap((feature) => feature.entry),
		];
		for (const reference of references) {
			const key = `${reference.path}:${reference.symbol ?? ""}`;
			if (hits.has(key)) continue;
			hits.set(key, {
				key,
				areaId: area.id,
				areaName: area.name,
				label: reference.symbol ?? shortPath(reference.path),
				path: reference.path,
			});
		}
	}
	return [...hits.values()];
}

export function MapSearch({
	map,
	open,
	onOpenChange,
	onSelectArea,
}: {
	map: LoadedProductMap;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSelectArea: (id: string) => void;
}) {
	const code = useMemo(() => collectCode(map), [map]);
	const pulls = useMemo(
		() =>
			Object.values(map.pulls)
				.filter((pull) => pull.areas.length > 0)
				.sort((a, b) => b.number - a.number),
		[map],
	);
	const issues = useMemo(
		() => Object.values(map.issues).sort((a, b) => b.number - a.number),
		[map],
	);
	const select = (areaId: string) => {
		onSelectArea(areaId);
		onOpenChange(false);
	};
	const areaName = (id: string) => map.areaById.get(id)?.name ?? id;

	return (
		<CommandDialog
			open={open}
			onOpenChange={onOpenChange}
			title="Jump to"
			description="Search areas, features, code, pull requests and issues"
		>
			<CommandInput placeholder="Jump to an area, feature, file, pull request or issue" />
			<CommandList className="max-h-[min(26rem,60vh)]">
				<CommandEmpty>Nothing on the map matches.</CommandEmpty>
				<CommandGroup heading="Areas">
					{map.areas.map((area) => {
						const Icon = areaIcon(area.icon);
						return (
							<CommandItem
								key={area.id}
								value={`${area.name} ${area.tagline}`}
								onSelect={() => select(area.id)}
							>
								<Icon size={14} strokeWidth={2} className="size-3.5" />
								<span className="truncate">{area.name}</span>
								<span className="ml-auto truncate text-muted-foreground text-xs">
									{area.tagline}
								</span>
							</CommandItem>
						);
					})}
				</CommandGroup>
				<CommandGroup heading="Features">
					{map.areas.flatMap((area) =>
						area.features.map((feature) => (
							<CommandItem
								key={`${area.id}:${feature.name}`}
								value={`${feature.name} ${area.name}`}
								onSelect={() => select(area.id)}
							>
								<span className="truncate">{feature.name}</span>
								<span className="ml-auto shrink-0 text-muted-foreground text-xs">
									{area.name}
								</span>
							</CommandItem>
						)),
					)}
				</CommandGroup>
				<CommandGroup heading="Code">
					{code.map((hit) => (
						<CommandItem
							key={hit.key}
							value={`${hit.label} ${hit.path}`}
							onSelect={() => select(hit.areaId)}
						>
							<CodeSimpleIcon size={14} className="size-3.5" />
							<span className="truncate font-mono text-xs">{hit.label}</span>
							<span className="min-w-0 truncate font-mono text-[11px] text-muted-foreground">
								{hit.path}
							</span>
							<span className="ml-auto shrink-0 text-muted-foreground text-xs">
								{hit.areaName}
							</span>
						</CommandItem>
					))}
				</CommandGroup>
				<CommandGroup heading="Pull requests">
					{pulls.map((pull) => {
						const Icon =
							pull.state === "open" ? GitPullRequestIcon : GitMergeIcon;
						return (
							<CommandItem
								key={pull.number}
								value={`#${pull.number} ${pull.title} ${pull.author}`}
								onSelect={() => select(pull.areas[0])}
							>
								<Icon
									size={14}
									className={
										pull.state === "open"
											? "size-3.5 text-state-open"
											: "size-3.5 text-state-merged"
									}
								/>
								<span className="truncate">{pull.title}</span>
								<span className="ml-auto shrink-0 text-muted-foreground text-xs">
									#{pull.number} · {areaName(pull.areas[0])}
								</span>
							</CommandItem>
						);
					})}
				</CommandGroup>
				<CommandGroup heading="Issues">
					{issues.map((issue) => (
						<CommandItem
							key={issue.number}
							value={`#${issue.number} ${issue.title} ${issue.author}`}
							onSelect={() => select(issue.areas[0])}
						>
							<IssuesIcon
								size={14}
								className={
									issue.state === "open"
										? "size-3.5 text-state-open"
										: "size-3.5 text-state-merged"
								}
							/>
							<span className="truncate">{issue.title}</span>
							<span className="ml-auto shrink-0 text-muted-foreground text-xs">
								#{issue.number} · {areaName(issue.areas[0])}
							</span>
						</CommandItem>
					))}
				</CommandGroup>
			</CommandList>
		</CommandDialog>
	);
}
