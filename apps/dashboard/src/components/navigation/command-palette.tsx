import { ChevronRightIcon } from "@diffkit/icons";
import {
	Command,
	CommandBareInput,
	CommandGroup,
	CommandItem as CommandItemUI,
	CommandList,
	CommandShortcut,
} from "@diffkit/ui/components/command";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@diffkit/ui/components/dialog";
import { Kbd } from "@diffkit/ui/components/menu";
import { ScrollFade } from "@diffkit/ui/components/scroll-fade";
import { cn } from "@diffkit/ui/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, useRouter } from "@tanstack/react-router";
import {
	type KeyboardEvent,
	type PointerEvent,
	type ReactNode,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { PickerSkeletonRows } from "#/components/shared/picker-skeleton-rows";
import type { CommandItem } from "#/lib/command-palette/types";
import {
	cacheSearchResults,
	getCommandSearchItems,
	useCommandItems,
} from "#/lib/command-palette/use-command-items";
import { useCommandPalette } from "#/lib/command-palette/use-command-palette";
import { formatRelativeTime } from "#/lib/format-relative-time";
import { githubCommandPaletteSearchQueryOptions } from "#/lib/github.query";
import { PalettePreview, PREVIEW_MOTION } from "./palette-preview";

const routeApi = getRouteApi("/_protected");

const MIN_GITHUB_QUERY = 2;
/** How long a row stays selected before its details are fetched for the preview. */
const PREVIEW_SETTLE_MS = 140;
/** The least room kept between the preview card and the window's bottom. */
const PREVIEW_MARGIN = 16;
/**
 * The palette stays centred; the card only shows where it fits in the space to
 * its left: the 42rem palette plus, each side, the 18rem card, its 0.75rem gap
 * and a 1rem margin.
 */
const PREVIEW_FITS = "(min-width: 81.5rem)";

/**
 * ⌘K, after Trylle's: one field, the results narrowed by kind with Tab, rows
 * that name their repository, and the keys for what Enter does underneath.
 */
export function CommandPalette() {
	const { open, setOpen, close } = useCommandPalette();
	const router = useRouter();
	const queryClient = useQueryClient();
	const { user } = routeApi.useRouteContext();
	const scope = useMemo(() => ({ userId: user.id }), [user.id]);
	const [search, setSearch] = useState("");
	const [kind, setKind] = useState<string | null>(null);
	const [active, setActive] = useState("");
	const debouncedSearch = useDebouncedValue(search, 250);
	const trimmedDebouncedSearch = debouncedSearch.trim();
	const shouldSearchGitHub =
		open && trimmedDebouncedSearch.length >= MIN_GITHUB_QUERY;
	const items = useCommandItems();
	const githubSearchQuery = useQuery({
		...githubCommandPaletteSearchQueryOptions(
			{ userId: user.id },
			{ query: trimmedDebouncedSearch, perPage: 5 },
		),
		enabled: shouldSearchGitHub,
	});
	const searchItems = useMemo(
		() => getCommandSearchItems(githubSearchQuery.data),
		[githubSearchQuery.data],
	);

	const cachedSearchDataRef = useRef(githubSearchQuery.data);
	useEffect(() => {
		const data = githubSearchQuery.data;
		if (!data || data === cachedSearchDataRef.current) return;
		cachedSearchDataRef.current = data;
		cacheSearchResults(queryClient, scope, data);
	}, [githubSearchQuery.data, queryClient, scope]);

	const matched = useMemo(
		() => matchItems(items, searchItems, search),
		[items, searchItems, search],
	);
	const kinds = kindCounts(matched);
	const activeKind = kind && kinds.has(kind) ? kind : null;
	const shown = activeKind
		? matched.filter((item) => item.group === activeKind)
		: matched;
	const groups = groupByKind(shown);
	const selected = shown.find((item) => item.id === active);
	const searching = shouldSearchGitHub && githubSearchQuery.isFetching;
	const settledId = useDebouncedValue(active, PREVIEW_SETTLE_MS);
	const roomForPreview = useMediaQuery(PREVIEW_FITS);
	const preview = roomForPreview ? selected?.preview : undefined;

	const popupRef = useRef<HTMLDivElement>(null);
	const listRef = useRef<HTMLDivElement>(null);
	const previewRef = useRef<HTMLDivElement>(null);
	const [previewTop, setPreviewTop] = useState(0);
	const placePreview = () => {
		const popup = popupRef.current;
		const list = listRef.current;
		const row = list?.querySelector<HTMLElement>(
			'[cmdk-item][data-selected="true"]',
		);
		if (!popup || !list || !row) return;
		const box = popup.getBoundingClientRect();
		const view = list.getBoundingClientRect();
		const at = row.getBoundingClientRect();
		const visible = Math.min(
			Math.max(at.top, view.top),
			view.bottom - at.height,
		);
		const height =
			previewRef.current?.querySelector<HTMLElement>("[data-preview-content]")
				?.offsetHeight ?? 0;
		const lowest = window.innerHeight - PREVIEW_MARGIN - height;
		setPreviewTop(Math.max(0, Math.min(visible, lowest) - box.top));
	};
	// biome-ignore lint/correctness/useExhaustiveDependencies: re-placed when the selection or the rows change; it reads the DOM
	useLayoutEffect(() => {
		if (preview) placePreview();
	}, [preview, active, shown.length]);
	// biome-ignore lint/correctness/useExhaustiveDependencies: it reads the DOM
	useEffect(() => {
		const card = previewRef.current?.querySelector<HTMLElement>(
			"[data-preview-content]",
		);
		if (!preview || !card) return;
		const observer = new ResizeObserver(() => placePreview());
		observer.observe(card);
		window.addEventListener("resize", placePreview);
		return () => {
			observer.disconnect();
			window.removeEventListener("resize", placePreview);
		};
	}, [preview]);

	function reset() {
		setSearch("");
		setKind(null);
	}

	function handleSelect(item: CommandItem) {
		reset();
		close();
		if (item.action.type === "navigate") {
			void router.navigate({ to: item.action.to });
		} else {
			void item.action.fn();
		}
	}

	function handleOpenChange(nextOpen: boolean) {
		setOpen(nextOpen);
		if (!nextOpen) reset();
	}

	// Chrome sends a pointer move when the list scrolls under a resting pointer;
	// selecting on that would pull the selection back as the arrows scroll the
	// list, so a row is only picked when the pointer itself moved.
	const lastPointer = useRef({ x: -1, y: -1 });
	function hoverRow(event: PointerEvent<HTMLDivElement>) {
		const { clientX: x, clientY: y } = event;
		if (x === lastPointer.current.x && y === lastPointer.current.y) return;
		lastPointer.current = { x, y };
		const row = (event.target as Element).closest("[cmdk-item]");
		const id = row?.getAttribute("data-value");
		if (id && row?.getAttribute("aria-disabled") !== "true") setActive(id);
	}

	/** A new kind starts its list from the top, with its first row selected. */
	function pickKind(next: string | null) {
		const rows = next ? matched.filter((item) => item.group === next) : matched;
		setKind(next);
		setActive(rows[0]?.id ?? "");
		if (listRef.current) listRef.current.scrollTop = 0;
	}

	function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
		const order = [null, ...kinds.keys()];
		const at = order.indexOf(activeKind);
		if (event.key === "Tab") {
			event.preventDefault();
			const step = event.shiftKey ? -1 : 1;
			pickKind(order[(at + step + order.length) % order.length] ?? null);
			return;
		}
		// Plain arrows only: with a modifier they stay the field's (⌥← a word back, ⌘← the line's start).
		const plainArrow =
			(event.key === "ArrowLeft" || event.key === "ArrowRight") &&
			!event.shiftKey &&
			!event.altKey &&
			!event.metaKey &&
			!event.ctrlKey;
		if (plainArrow && kinds.size > 0) {
			event.preventDefault();
			const next = order[at + (event.key === "ArrowRight" ? 1 : -1)];
			if (next !== undefined) pickKind(next);
			return;
		}
		if (event.key === "Backspace" && search === "" && activeKind) {
			event.preventDefault();
			pickKind(null);
		}
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent
				ref={popupRef}
				showCloseButton={false}
				className="top-[12vh] translate-y-0 gap-0 overflow-visible rounded-2xl p-0 sm:max-w-2xl"
			>
				{preview ? (
					<div
						ref={previewRef}
						style={{ transform: `translateY(${previewTop}px)` }}
						className={cn(
							"absolute top-0 right-full mr-3 transition-transform",
							PREVIEW_MOTION,
						)}
					>
						<PalettePreview
							key={selected?.id}
							target={preview}
							scope={scope}
							settled={settledId === active}
						/>
					</div>
				) : null}
				<DialogTitle className="sr-only">Command palette</DialogTitle>
				<DialogDescription className="sr-only">
					Go to a page, run a command, or search GitHub.
				</DialogDescription>
				<Command
					shouldFilter={false}
					loop
					disablePointerSelection
					value={active}
					onValueChange={setActive}
					onKeyDown={onKeyDown}
					label="Command palette"
					className="rounded-none bg-transparent"
				>
					<div className="px-5 pt-4 pb-3">
						<CommandBareInput
							value={search}
							onValueChange={setSearch}
							placeholder="Type a command or search GitHub…"
							spellCheck={false}
							autoCorrect="off"
							autoCapitalize="off"
							className="w-full bg-transparent px-1 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
						/>
					</div>
					{kinds.size > 0 ? (
						<KindBar
							count={matched.length}
							kinds={kinds}
							active={activeKind}
							onPick={pickKind}
						/>
					) : null}
					<CommandList
						ref={listRef}
						onScroll={placePreview}
						onPointerMove={hoverRow}
						className="max-h-[min(27rem,56vh)] scroll-py-2 overscroll-y-contain px-2 pb-2"
					>
						{shown.length === 0 ? (
							<Empty search={search} searching={searching} />
						) : null}
						{[...groups.entries()].map(([group, groupItems]) => (
							<CommandGroup
								key={group}
								heading={group}
								className="p-0 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5"
							>
								{groupItems.map((item) => (
									<Row key={item.id} item={item} onSelect={handleSelect} />
								))}
							</CommandGroup>
						))}
					</CommandList>
					<Footer>
						{selected ? (
							<Hint keys={["↵"]}>
								{selected.action.type === "navigate" ? "Open" : "Run"}
							</Hint>
						) : null}
						<span className="ml-auto" />
						{kinds.size > 1 ? <Hint keys={["←", "→"]}>Filter</Hint> : null}
						<Hint keys={["esc"]}>Close</Hint>
					</Footer>
				</Command>
			</DialogContent>
		</Dialog>
	);
}

function Row({
	item,
	onSelect,
}: {
	item: CommandItem;
	onSelect: (item: CommandItem) => void;
}) {
	const Icon = item.icon;
	const updated = item.meta?.updatedAt
		? formatRelativeTime(item.meta.updatedAt, undefined, { compact: true })
		: null;
	return (
		<CommandItemUI
			value={item.id}
			onSelect={() => onSelect(item)}
			className="group/row h-10 gap-3 rounded-xl px-3 text-[13px]"
		>
			<span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground group-data-[selected=true]/row:text-foreground">
				{Icon ? <Icon className={cn("size-4", item.iconClassName)} /> : null}
			</span>
			<span className="flex min-w-0 flex-1 items-center gap-1.5">
				{item.meta?.repo ? (
					<>
						<span className="max-w-40 shrink-0 truncate text-muted-foreground">
							{item.meta.repo}
						</span>
						<ChevronRightIcon
							size={12}
							strokeWidth={2}
							className="shrink-0 text-muted-foreground/60"
						/>
					</>
				) : null}
				<span className="min-w-0 truncate text-foreground">{item.label}</span>
				{item.meta?.language ? (
					<span className="min-w-0 shrink-[3] truncate text-muted-foreground">
						{item.meta.language}
					</span>
				) : null}
			</span>
			{item.shortcut ? (
				<CommandShortcut keys={item.shortcut} className="ml-0" />
			) : updated ? (
				<span className="shrink-0 text-xs tabular-nums text-muted-foreground">
					{updated}
				</span>
			) : null}
		</CommandItemUI>
	);
}

function KindBar({
	count,
	kinds,
	active,
	onPick,
}: {
	count: number;
	kinds: Map<string, number>;
	active: string | null;
	onPick: (kind: string | null) => void;
}) {
	const strip = useRef<HTMLDivElement>(null);
	// biome-ignore lint/correctness/useExhaustiveDependencies: runs when the pick changes
	useEffect(() => {
		strip.current
			?.querySelector<HTMLElement>('[aria-pressed="true"]')
			?.scrollIntoView({ block: "nearest", inline: "nearest" });
	}, [active]);
	const chip = (kind: string | null, label: string, n?: number) => (
		<button
			key={kind ?? "all"}
			type="button"
			tabIndex={-1}
			aria-pressed={active === kind}
			onMouseDown={(event) => event.preventDefault()}
			onClick={() => onPick(active === kind ? null : kind)}
			className="flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-[450] text-muted-foreground shadow-chip transition-colors hover:text-foreground aria-pressed:bg-foreground aria-pressed:text-background aria-pressed:shadow-none"
		>
			{label}
			{n !== undefined ? (
				<span className="tabular-nums opacity-60">{n}</span>
			) : null}
		</button>
	);
	return (
		<div className="flex items-center gap-2 pb-2 pl-5">
			<span className="shrink-0 text-xs tabular-nums text-muted-foreground">
				{count} {count === 1 ? "result" : "results"}
			</span>
			<ScrollFade
				ref={strip}
				className="ml-auto flex min-w-0 scroll-px-7 items-center gap-1 py-0.5 pr-5 pl-0.5"
			>
				{chip(null, "All")}
				{[...kinds.entries()].map(([kind, n]) => chip(kind, kind, n))}
			</ScrollFade>
		</div>
	);
}

function Empty({ search, searching }: { search: string; searching: boolean }) {
	const query = search.trim();
	if (searching) {
		return (
			<PickerSkeletonRows
				label="Searching GitHub"
				rows={5}
				rowClassName="flex h-10 items-center gap-3 px-3 text-[13px]"
				className="pt-2"
			/>
		);
	}
	return (
		<p className="py-10 text-center text-xs text-muted-foreground">
			{query.length === 1 ? (
				"Type at least 2 characters to search GitHub."
			) : query ? (
				<>
					Nothing matches “<span className="text-foreground">{query}</span>”.
				</>
			) : (
				"Nothing here yet."
			)}
		</p>
	);
}

function Footer({ children }: { children: ReactNode }) {
	return (
		<div className="flex h-11 shrink-0 items-center gap-4 border-t-[0.5px] border-popover-border px-5 text-xs text-muted-foreground">
			{children}
		</div>
	);
}

function Hint({ keys, children }: { keys: string[]; children: ReactNode }) {
	return (
		<span className="flex min-w-0 items-center gap-1.5">
			{keys.map((key) => (
				<Kbd key={key}>{key}</Kbd>
			))}
			<span className="truncate">{children}</span>
		</span>
	);
}

function useMediaQuery(media: string) {
	const [matches, setMatches] = useState(false);
	useEffect(() => {
		const query = window.matchMedia(media);
		setMatches(query.matches);
		const onChange = () => setMatches(query.matches);
		query.addEventListener("change", onChange);
		return () => query.removeEventListener("change", onChange);
	}, [media]);
	return matches;
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

/**
 * Local commands narrowed by every typed word; GitHub's results already match
 * the query on its side (titles, bodies), so they all stay.
 */
function matchItems(
	localItems: CommandItem[],
	searchItems: CommandItem[],
	search: string,
) {
	const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
	const seen = new Set<string>();
	const result: CommandItem[] = [];
	for (const item of localItems) {
		if (seen.has(destination(item))) continue;
		const haystack = [item.label, item.meta?.repo, ...(item.keywords ?? [])]
			.join(" ")
			.toLowerCase();
		if (!words.every((word) => haystack.includes(word))) continue;
		seen.add(destination(item));
		result.push(item);
	}
	for (const item of searchItems) {
		if (seen.has(destination(item))) continue;
		seen.add(destination(item));
		result.push(item);
	}
	return result;
}

/** A pull request can come from the cached lists and from GitHub's search under different ids; where it opens is the same. */
function destination(item: CommandItem) {
	return item.action.type === "navigate" ? item.action.to : item.id;
}

function kindCounts(items: CommandItem[]) {
	const counts = new Map<string, number>();
	for (const item of items) {
		counts.set(item.group, (counts.get(item.group) ?? 0) + 1);
	}
	return counts;
}

function groupByKind(items: CommandItem[]) {
	const groups = new Map<string, CommandItem[]>();
	for (const item of items) {
		const list = groups.get(item.group) ?? [];
		list.push(item);
		groups.set(item.group, list);
	}
	return groups;
}
