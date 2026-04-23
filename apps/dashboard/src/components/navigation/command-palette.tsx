import { CommentIcon, StarIcon } from "@diffkit/icons";
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem as CommandItemUI,
	CommandList,
	CommandShortcut,
} from "@diffkit/ui/components/command";
import { cn } from "@diffkit/ui/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, useMatches, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CommandItem, CommandItemMeta } from "#/lib/command-palette/types";
import {
	cacheSearchResults,
	getCommandSearchItems,
	getSearchCodeCommandItems,
	useCommandItems,
} from "#/lib/command-palette/use-command-items";
import { useCommandPalette } from "#/lib/command-palette/use-command-palette";
import { formatRelativeTime } from "#/lib/format-relative-time";
import {
	codeSearchQueryOptions,
	githubCommandPaletteSearchQueryOptions,
} from "#/lib/github.query";

const routeApi = getRouteApi("/_protected");

function getActiveRepoFromMatches(
	matches: ReturnType<typeof useMatches>,
): string | undefined {
	for (let index = matches.length - 1; index >= 0; index--) {
		const params = matches[index]?.params;
		if (!params || typeof params !== "object") {
			continue;
		}
		const ownerCandidate = (params as Record<string, unknown>).owner;
		const repoCandidate = (params as Record<string, unknown>).repo;
		if (
			typeof ownerCandidate !== "string" ||
			typeof repoCandidate !== "string"
		) {
			continue;
		}
		return `${ownerCandidate}/${repoCandidate}`;
	}
	return undefined;
}

export function CommandPalette() {
	const { open, setOpen, close } = useCommandPalette();
	const router = useRouter();
	const matches = useMatches();
	const queryClient = useQueryClient();
	const { user } = routeApi.useRouteContext();
	const scope = useMemo(() => ({ userId: user.id }), [user.id]);
	const [search, setSearch] = useState("");
	const debouncedSearch = useDebouncedValue(search, 250);
	const trimmedDebouncedSearch = debouncedSearch.trim();
	const shouldSearchGitHub = open && trimmedDebouncedSearch.length >= 2;
	const items = useCommandItems();
	const githubSearchQuery = useQuery({
		...githubCommandPaletteSearchQueryOptions(
			{ userId: user.id },
			{ query: trimmedDebouncedSearch, perPage: 5 },
		),
		enabled: shouldSearchGitHub,
	});
	const activeRepo = useMemo(
		() => getActiveRepoFromMatches(matches),
		[matches],
	);
	const codeSearchQuery = useQuery({
		...codeSearchQueryOptions(scope, {
			q: trimmedDebouncedSearch,
			repo: activeRepo,
			page: "1",
		}),
		enabled: shouldSearchGitHub,
	});
	const searchItems = useMemo(
		() => getCommandSearchItems(githubSearchQuery.data),
		[githubSearchQuery.data],
	);
	const codeSearchItems = useMemo(
		() =>
			getSearchCodeCommandItems(codeSearchQuery.data, async (item) => {
				const [owner, repo, ...rest] = item.repo.split("/");
				if (!(owner && repo) || rest.length > 0) {
					return;
				}
				const routeSplat = `main/${item.path}`;
				await router.navigate({
					to: "/$owner/$repo/blob/$",
					params: {
						owner,
						repo,
						_splat: routeSplat,
					},
				});
			}),
		[codeSearchQuery.data, router],
	);
	const allItems = useMemo(
		() => mergeCommandItems(items, searchItems, codeSearchItems),
		[items, searchItems, codeSearchItems],
	);

	const cachedSearchDataRef = useRef(githubSearchQuery.data);
	useEffect(() => {
		const data = githubSearchQuery.data;
		if (!data || data === cachedSearchDataRef.current) return;
		cachedSearchDataRef.current = data;
		cacheSearchResults(queryClient, scope, data);
	}, [githubSearchQuery.data, queryClient, scope]);

	const groups = new Map<string, CommandItem[]>();
	for (const item of allItems) {
		const list = groups.get(item.group) ?? [];
		list.push(item);
		groups.set(item.group, list);
	}

	function handleSelect(item: CommandItem) {
		setSearch("");
		close();
		if (item.action.type === "navigate") {
			void router.navigate({ to: item.action.to });
		} else {
			void item.action.fn();
		}
	}

	function handleOpenChange(nextOpen: boolean) {
		setOpen(nextOpen);
		if (!nextOpen) {
			setSearch("");
		}
	}

	return (
		<CommandDialog open={open} onOpenChange={handleOpenChange}>
			<CommandInput
				placeholder="Type a command or search GitHub..."
				value={search}
				onValueChange={setSearch}
			/>
			<CommandList>
				<CommandEmpty>
					{getEmptyMessage(
						search,
						shouldSearchGitHub &&
							(githubSearchQuery.isFetching || codeSearchQuery.isFetching),
					)}
				</CommandEmpty>
				{Array.from(groups.entries()).map(([groupName, groupItems]) => (
					<CommandGroup key={groupName} heading={groupName}>
						{groupItems.map((item) => (
							<CommandItemUI
								key={item.id}
								value={`${item.label} ${(item.keywords ?? []).join(" ")}`}
								onSelect={() => handleSelect(item)}
							>
								{item.icon && (
									<item.icon
										className={cn("size-4 shrink-0", item.iconClassName)}
									/>
								)}
								<div className="mr-4 min-w-0 flex-1">
									<p className="truncate text-sm">{item.label}</p>
									{item.meta && <ItemMeta meta={item.meta} />}
								</div>
								{item.meta?.comments != null && item.meta.comments > 0 && (
									<span className="ml-auto flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
										<CommentIcon className="size-4" />
										{item.meta.comments}
									</span>
								)}
								{item.shortcut && <CommandShortcut keys={item.shortcut} />}
							</CommandItemUI>
						))}
					</CommandGroup>
				))}
			</CommandList>
		</CommandDialog>
	);
}

function useDebouncedValue(value: string, delayMs: number) {
	const [debouncedValue, setDebouncedValue] = useState(value);

	useEffect(() => {
		const timeout = setTimeout(() => {
			setDebouncedValue(value);
		}, delayMs);

		return () => clearTimeout(timeout);
	}, [delayMs, value]);

	return debouncedValue;
}

function mergeCommandItems(
	localItems: CommandItem[],
	searchItems: CommandItem[],
	codeItems: CommandItem[],
) {
	const itemsById = new Map<string, CommandItem>();

	for (const item of [...localItems, ...searchItems, ...codeItems]) {
		if (!itemsById.has(item.id)) {
			itemsById.set(item.id, item);
		}
	}

	return [...itemsById.values()];
}

function getEmptyMessage(search: string, isSearching: boolean) {
	if (search.trim().length === 1) {
		return "Type at least 2 characters to search GitHub.";
	}

	if (isSearching) {
		return "Searching GitHub...";
	}

	return "No results found.";
}

function ItemMeta({ meta }: { meta: CommandItemMeta }) {
	const parts: string[] = [];
	if (meta.repo) parts.push(meta.repo);
	if (meta.language) parts.push(meta.language);

	if (!parts.length && meta.stars == null && !meta.updatedAt) {
		return null;
	}

	return (
		<span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
			{parts.length > 0 && <span>{parts.join(" · ")}</span>}
			{meta.stars != null && meta.stars > 0 && (
				<>
					{parts.length > 0 && <span>·</span>}
					<span className="inline-flex items-center gap-0.5">
						<StarIcon className="size-4" />
						{meta.stars}
					</span>
				</>
			)}
			{meta.updatedAt && (
				<>
					{(parts.length > 0 || (meta.stars != null && meta.stars > 0)) && (
						<span>·</span>
					)}
					<span>{formatRelativeTime(meta.updatedAt)}</span>
				</>
			)}
		</span>
	);
}
