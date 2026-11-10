import {
	CloseIcon,
	FilterIcon,
	SearchIcon,
	Sorting01Icon,
} from "@diffkit/icons";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@diffkit/ui/components/dropdown-menu";
import { MenuSearch } from "@diffkit/ui/components/menu";
import { PageIconButton } from "@diffkit/ui/components/page-header";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@diffkit/ui/components/tooltip";
import { cn } from "@diffkit/ui/lib/utils";
import {
	type KeyboardEvent,
	type ReactNode,
	useMemo,
	useRef,
	useState,
} from "react";
import { useShellOverlay } from "#/lib/shell/shell-overlay";
import { useGlobalShortcuts } from "#/lib/shortcuts";
import type {
	FilterableItem,
	FilterDefinition,
	FilterOption,
} from "./filter-model";
import { FilterPill } from "./filter-pill";
import { FilterValueOptions, focusFirstMenuItem } from "./filter-value-options";
import type { ListFilterState } from "./use-list-filters";

export type FilterOptions = Map<string, FilterOption[]>;

export function useFilterOptions(
	defs: FilterDefinition[],
	items: FilterableItem[],
): FilterOptions {
	return useMemo(
		() => new Map(defs.map((def) => [def.id, def.extractOptions(items)])),
		[defs, items],
	);
}

/** The list's search input; `/` focuses it and Esc clears it, then leaves it. */
export function ToolbarSearchField({
	value,
	onChange,
	placeholder,
}: {
	value: string;
	onChange: (value: string) => void;
	placeholder: string;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	const shellIdle = useShellOverlay().kind === "none";
	useGlobalShortcuts([
		{
			shortcut: { key: "/" },
			enabled: shellIdle,
			onTrigger: () => inputRef.current?.focus(),
		},
	]);
	const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key !== "Escape") return;
		event.preventDefault();
		if (value) onChange("");
		else event.currentTarget.blur();
	};
	return (
		<div className="flex h-9 min-w-0 flex-1 items-center gap-2 text-muted-foreground">
			<SearchIcon size={14} strokeWidth={2} className="shrink-0" />
			<input
				ref={inputRef}
				type="search"
				value={value}
				onChange={(event) => onChange(event.target.value)}
				onKeyDown={onKeyDown}
				placeholder={placeholder}
				aria-label={placeholder}
				aria-keyshortcuts="/"
				className="h-full min-w-0 flex-1 bg-transparent text-[13px] font-[450] text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
			/>
			{value ? (
				<button
					type="button"
					aria-label="Clear search"
					onClick={() => {
						onChange("");
						inputRef.current?.focus();
					}}
					className="flex size-6 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-ghost-hover hover:text-foreground"
				>
					<CloseIcon size={13} />
				</button>
			) : null}
		</div>
	);
}

/** The 44px row under a list's header: search at the left, list actions at the right. */
export function ToolbarRow({
	search,
	children,
}: {
	search: ReactNode;
	children?: ReactNode;
}) {
	return (
		<div className="flex h-11 shrink-0 items-center gap-1.5 border-b-[0.5px] border-header-rule pr-3 pl-5 max-md:pl-3">
			{search}
			{children}
		</div>
	);
}

function keepTypingInSearch(event: KeyboardEvent<HTMLInputElement>) {
	if (event.key === "ArrowDown") {
		event.preventDefault();
		focusFirstMenuItem(event.currentTarget);
		return;
	}
	if (event.key === "Enter") {
		event.preventDefault();
		const item = focusFirstMenuItem(event.currentTarget);
		item?.dispatchEvent(
			new globalThis.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
		);
		return;
	}
	if (event.key.length === 1) event.stopPropagation();
}

function focusOnMount(input: HTMLInputElement | null) {
	if (input) requestAnimationFrame(() => input.focus());
}

function FilterMenu({
	state,
	options,
	open,
	onOpenChange,
}: {
	state: ListFilterState;
	options: FilterOptions;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const [query, setQuery] = useState("");
	const needle = query.trim().toLowerCase();
	const fields = state.filterDefs.filter((def) =>
		def.label.toLowerCase().includes(needle),
	);
	const selectedCounts = new Map(
		state.activeFilters.map((filter) => [filter.fieldId, filter.values.size]),
	);

	return (
		<DropdownMenu
			modal={false}
			open={open}
			onOpenChange={(next) => {
				onOpenChange(next);
				if (!next) setQuery("");
			}}
		>
			<Tooltip>
				<TooltipTrigger asChild>
					<DropdownMenuTrigger asChild>
						<PageIconButton
							raised
							aria-label="Filter"
							aria-keyshortcuts="F"
							className={cn(
								state.activeFilters.length > 0 && "text-foreground",
							)}
						>
							<FilterIcon size={14} strokeWidth={2} />
						</PageIconButton>
					</DropdownMenuTrigger>
				</TooltipTrigger>
				<TooltipContent keys={["F"]}>Filter</TooltipContent>
			</Tooltip>
			<DropdownMenuContent align="end" className="w-56 p-0">
				<MenuSearch
					ref={focusOnMount}
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					onKeyDown={keepTypingInSearch}
					placeholder="Filter by…"
					aria-label="Filter by"
					shortcut="F"
				/>
				<div className="flex flex-col p-1">
					{fields.map((def) => (
						<DropdownMenuSub key={def.id}>
							<DropdownMenuSubTrigger className="gap-2">
								<span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground">
									<def.icon size={14} strokeWidth={2} />
								</span>
								<span className="min-w-0 flex-1 truncate">{def.label}</span>
								{selectedCounts.has(def.id) ? (
									<span className="text-xs tabular-nums text-muted-foreground">
										{selectedCounts.get(def.id)}
									</span>
								) : null}
							</DropdownMenuSubTrigger>
							<DropdownMenuSubContent
								sideOffset={6}
								alignOffset={-4}
								className="w-60 p-0"
							>
								<FilterValueOptions
									definition={def}
									options={options.get(def.id) ?? []}
									selected={
										state.activeFilters.find(
											(filter) => filter.fieldId === def.id,
										)?.values
									}
									onToggle={(value) => state.toggleValue(def.id, value)}
									focusSearchOnContentFocus
								/>
							</DropdownMenuSubContent>
						</DropdownMenuSub>
					))}
					{fields.length === 0 ? (
						<p className="px-2 py-1.5 text-[13px] text-muted-foreground">
							No matching fields
						</p>
					) : null}
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function SortMenu({ state }: { state: ListFilterState }) {
	const current = state.sortOptions.find(
		(option) => option.id === state.sortId,
	);
	const label = `Sort: ${current?.label ?? "Default"}`;
	return (
		<DropdownMenu modal={false}>
			<Tooltip>
				<TooltipTrigger asChild>
					<DropdownMenuTrigger asChild>
						<PageIconButton raised aria-label={label}>
							<Sorting01Icon size={14} strokeWidth={2} />
						</PageIconButton>
					</DropdownMenuTrigger>
				</TooltipTrigger>
				<TooltipContent>{label}</TooltipContent>
			</Tooltip>
			<DropdownMenuContent align="end" className="w-52">
				<DropdownMenuLabel>Sort by</DropdownMenuLabel>
				<DropdownMenuRadioGroup
					value={state.sortId}
					onValueChange={state.setSortId}
				>
					{state.sortOptions.map((option) => (
						<DropdownMenuRadioItem key={option.id} value={option.id}>
							{option.label}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/**
 * The list's search behind an icon: `/` or a click opens it, Esc clears it and
 * then closes it. It stays open while it holds a query.
 */
function ToolbarSearchToggle({
	value,
	onChange,
	placeholder,
}: {
	value: string;
	onChange: (value: string) => void;
	placeholder: string;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [editing, setEditing] = useState(false);
	const shellIdle = useShellOverlay().kind === "none";
	useGlobalShortcuts([
		{
			shortcut: { key: "/" },
			enabled: shellIdle,
			onTrigger: () => {
				setEditing(true);
				inputRef.current?.focus();
			},
		},
	]);

	if (!editing && !value) {
		return (
			<Tooltip>
				<TooltipTrigger asChild>
					<PageIconButton
						raised
						aria-label={placeholder}
						aria-keyshortcuts="/"
						onClick={() => setEditing(true)}
					>
						<SearchIcon size={14} strokeWidth={2} />
					</PageIconButton>
				</TooltipTrigger>
				<TooltipContent keys={["/"]}>Search</TooltipContent>
			</Tooltip>
		);
	}

	const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key !== "Escape") return;
		event.preventDefault();
		if (value) onChange("");
		else event.currentTarget.blur();
	};
	return (
		<div className="flex h-7 w-56 items-center gap-1.5 rounded-md bg-button pr-1 pl-2 text-muted-foreground shadow-button max-md:w-40">
			<SearchIcon size={13} strokeWidth={2} className="shrink-0" />
			<input
				ref={inputRef}
				// biome-ignore lint/a11y/noAutofocus: it only mounts when the person asked to search
				autoFocus={editing}
				type="search"
				value={value}
				onChange={(event) => onChange(event.target.value)}
				onKeyDown={onKeyDown}
				onBlur={() => setEditing(false)}
				placeholder={placeholder}
				aria-label={placeholder}
				aria-keyshortcuts="/"
				className="h-full min-w-0 flex-1 bg-transparent text-[13px] font-[450] text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
			/>
			{value ? (
				<button
					type="button"
					aria-label="Clear search"
					onMouseDown={(event) => event.preventDefault()}
					onClick={() => {
						onChange("");
						inputRef.current?.focus();
					}}
					className="flex size-5 shrink-0 items-center justify-center rounded-[5px] transition-colors hover:bg-ghost-hover hover:text-foreground"
				>
					<CloseIcon size={12} />
				</button>
			) : null}
		</div>
	);
}

export type ListFiltersConfig = {
	state: ListFilterState;
	items: FilterableItem[];
	searchPlaceholder: string;
};

/** Search, Filter and Sort for a list, set in the page header's action slot. */
export function ListActions({
	state,
	items,
	searchPlaceholder,
}: ListFiltersConfig) {
	const [filterMenuOpen, setFilterMenuOpen] = useState(false);
	const options = useFilterOptions(state.filterDefs, items);
	const shellIdle = useShellOverlay().kind === "none";

	useGlobalShortcuts([
		{
			shortcut: { key: "f" },
			enabled: shellIdle && state.filterDefs.length > 0,
			onTrigger: () => setFilterMenuOpen(true),
		},
	]);

	return (
		<div className="flex items-center gap-1.5">
			<ToolbarSearchToggle
				value={state.searchQuery}
				onChange={state.setSearchQuery}
				placeholder={searchPlaceholder}
			/>
			{state.filterDefs.length > 0 ? (
				<FilterMenu
					state={state}
					options={options}
					open={filterMenuOpen}
					onOpenChange={setFilterMenuOpen}
				/>
			) : null}
			{state.sortOptions.length > 1 ? <SortMenu state={state} /> : null}
		</div>
	);
}

/** The active filters as pills, in a row under the page header. */
export function ActiveFilters({
	state,
	items,
}: Pick<ListFiltersConfig, "state" | "items">) {
	const options = useFilterOptions(state.filterDefs, items);
	if (state.activeFilters.length === 0) return null;
	return (
		<fieldset
			aria-label="Active filters"
			className="m-0 flex min-w-0 shrink-0 flex-wrap items-center gap-1.5 border-0 border-b-[0.5px] border-header-rule py-2 pr-3 pl-5 max-md:pl-3"
		>
			{state.activeFilters.map((filter) => {
				const definition = state.filterDefs.find(
					(def) => def.id === filter.fieldId,
				);
				if (!definition) return null;
				return (
					<FilterPill
						key={filter.fieldId}
						filter={filter}
						definition={definition}
						options={options.get(filter.fieldId) ?? []}
						state={state}
					/>
				);
			})}
			<button
				type="button"
				onClick={state.clearAllFilters}
				className="h-6 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-ghost-hover hover:text-foreground"
			>
				Clear
			</button>
		</fieldset>
	);
}
