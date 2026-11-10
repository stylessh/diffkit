import {
	CheckIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	CloseIcon,
	FilterIcon,
	SearchIcon,
	Sorting01Icon,
} from "@diffkit/icons";
import {
	Drawer,
	DrawerContent,
	DrawerTitle,
} from "@diffkit/ui/components/drawer";
import {
	MobileActionBar,
	MobileActionButton,
	MobileActionGroup,
} from "@diffkit/ui/components/mobile-action-bar";
import { cn } from "@diffkit/ui/lib/utils";
import {
	type ComponentProps,
	memo,
	type ReactNode,
	useCallback,
	useState,
} from "react";
import type {
	ActiveFilter,
	FilterDefinition,
	FilterOption,
	SortOption,
} from "./filter-model";
import { withSelectedOptions } from "./filter-value-options";
import {
	type FilterOptions,
	filterOptionsFor,
	type ListFiltersConfig,
} from "./list-toolbar";

type DrawerName = "search" | "filter" | "sort";
type OpenDrawer = DrawerName | "none";

/** A list's Search, Filter and Sort on phones: one pill above the bottom nav, each opening a drawer. */
export function MobileListActions({
	state,
	items,
	searchPlaceholder,
}: ListFiltersConfig) {
	const [open, setOpen] = useState<OpenDrawer>("none");
	const close = useCallback(() => setOpen("none"), []);

	return (
		<>
			<MobileActionBar label="List actions">
				<MobileActionGroup>
					<MobileActionButton
						icon={<SearchIcon size={15} strokeWidth={2} />}
						active={state.searchQuery !== ""}
						onClick={() => setOpen("search")}
					>
						Search
					</MobileActionButton>
					{state.filterDefs.length > 0 ? (
						<MobileActionButton
							icon={<FilterIcon size={15} strokeWidth={2} />}
							count={state.activeFilters.length}
							active={state.activeFilters.length > 0}
							onClick={() => setOpen("filter")}
						>
							Filter
						</MobileActionButton>
					) : null}
					{state.sortOptions.length > 1 ? (
						<MobileActionButton
							icon={<Sorting01Icon size={15} strokeWidth={2} />}
							onClick={() => setOpen("sort")}
						>
							Sort
						</MobileActionButton>
					) : null}
				</MobileActionGroup>
			</MobileActionBar>

			<SearchDrawer
				open={open === "search"}
				onClose={close}
				value={state.searchQuery}
				onChange={state.setSearchQuery}
				placeholder={searchPlaceholder}
			/>
			<FilterDrawer
				open={open === "filter"}
				onClose={close}
				filterDefs={state.filterDefs}
				activeFilters={state.activeFilters}
				options={filterOptionsFor(state.filterDefs, items)}
				toggleValue={state.toggleValue}
				clearAllFilters={state.clearAllFilters}
			/>
			<SortDrawer
				open={open === "sort"}
				onClose={close}
				sortOptions={state.sortOptions}
				sortId={state.sortId}
				setSortId={state.setSortId}
			/>
		</>
	);
}

type DrawerProps = { open: boolean; onClose: () => void };

function ActionDrawer({
	open,
	onClose,
	children,
}: DrawerProps & { children: ReactNode }) {
	return (
		<Drawer
			open={open}
			onOpenChange={(next) => {
				if (!next) onClose();
			}}
		>
			<DrawerContent aria-describedby={undefined}>{children}</DrawerContent>
		</Drawer>
	);
}

function SearchDrawer({
	open,
	onClose,
	value,
	onChange,
	placeholder,
}: DrawerProps & {
	value: string;
	onChange: (value: string) => void;
	placeholder: string;
}) {
	return (
		<ActionDrawer open={open} onClose={onClose}>
			<DrawerHeading>Search</DrawerHeading>
			<form
				className="px-4 pb-5"
				onSubmit={(event) => {
					event.preventDefault();
					onClose();
				}}
			>
				<div className="flex h-10 items-center gap-2 rounded-lg bg-surface-0 px-3 text-muted-foreground shadow-field">
					<SearchIcon size={15} strokeWidth={2} className="shrink-0" />
					<input
						// biome-ignore lint/a11y/noAutofocus: the drawer only opens because the person asked to search
						autoFocus
						type="search"
						enterKeyHint="search"
						value={value}
						onChange={(event) => onChange(event.target.value)}
						placeholder={placeholder}
						aria-label={placeholder}
						className="h-full min-w-0 flex-1 bg-transparent text-[15px] font-[450] text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
					/>
					{value ? (
						<button
							type="button"
							aria-label="Clear search"
							onClick={() => onChange("")}
							className="flex size-7 shrink-0 items-center justify-center rounded-md active:bg-ghost-hover"
						>
							<CloseIcon size={14} />
						</button>
					) : null}
				</div>
			</form>
		</ActionDrawer>
	);
}

const SortDrawer = memo(function SortDrawer({
	open,
	onClose,
	sortOptions,
	sortId,
	setSortId,
}: DrawerProps & {
	sortOptions: SortOption[];
	sortId: string;
	setSortId: (sortId: string) => void;
}) {
	return (
		<ActionDrawer open={open} onClose={onClose}>
			<DrawerHeading>Sort by</DrawerHeading>
			<div className="px-2 pb-4">
				{sortOptions.map((option) => (
					<DrawerRow
						key={option.id}
						aria-pressed={option.id === sortId}
						onClick={() => {
							setSortId(option.id);
							onClose();
						}}
						trailing={
							option.id === sortId ? (
								<CheckIcon size={16} strokeWidth={2} />
							) : null
						}
					>
						{option.label}
					</DrawerRow>
				))}
			</div>
		</ActionDrawer>
	);
});

type FilterDrawerProps = {
	filterDefs: FilterDefinition[];
	activeFilters: ActiveFilter[];
	options: FilterOptions;
	toggleValue: (fieldId: string, value: string) => void;
	clearAllFilters: () => void;
};

const FilterDrawer = memo(function FilterDrawer({
	open,
	onClose,
	...body
}: DrawerProps & FilterDrawerProps) {
	return (
		<ActionDrawer open={open} onClose={onClose}>
			<FilterDrawerBody {...body} onDone={onClose} />
		</ActionDrawer>
	);
});

const NOTHING_SELECTED: Set<string> = new Set();

/** Fields first; picking one swaps the drawer to that field's values. */
function FilterDrawerBody({
	filterDefs,
	activeFilters,
	options,
	toggleValue,
	clearAllFilters,
	onDone,
}: FilterDrawerProps & { onDone: () => void }) {
	const [fieldId, setFieldId] = useState<string | null>(null);
	const field = filterDefs.find((def) => def.id === fieldId);
	const selectedOf = (id: string) =>
		activeFilters.find((filter) => filter.fieldId === id)?.values;

	if (field) {
		return (
			<FilterValues
				definition={field}
				options={options.get(field.id) ?? []}
				selected={selectedOf(field.id) ?? NOTHING_SELECTED}
				onToggle={(value) => toggleValue(field.id, value)}
				onBack={() => setFieldId(null)}
			/>
		);
	}

	return (
		<>
			<div className="flex items-center justify-between pr-2">
				<DrawerHeading>Filter</DrawerHeading>
				{activeFilters.length > 0 ? (
					<button
						type="button"
						onClick={() => {
							clearAllFilters();
							onDone();
						}}
						className="mb-2 h-8 rounded-lg px-3 text-[13px] font-medium text-muted-foreground active:bg-ghost-hover"
					>
						Clear all
					</button>
				) : null}
			</div>
			<div className="px-2 pb-4">
				{filterDefs.map((def) => {
					const count = selectedOf(def.id)?.size ?? 0;
					return (
						<DrawerRow
							key={def.id}
							onClick={() => setFieldId(def.id)}
							leading={<def.icon size={15} strokeWidth={2} />}
							trailing={
								<>
									{count > 0 ? (
										<span className="text-[13px] tabular-nums text-muted-foreground">
											{count}
										</span>
									) : null}
									<ChevronRightIcon size={14} />
								</>
							}
						>
							{def.label}
						</DrawerRow>
					);
				})}
			</div>
		</>
	);
}

function FilterValues({
	definition,
	options,
	selected,
	onToggle,
	onBack,
}: {
	definition: FilterDefinition;
	options: FilterOption[];
	selected: Set<string>;
	onToggle: (value: string) => void;
	onBack: () => void;
}) {
	const [query, setQuery] = useState("");
	const needle = query.trim().toLowerCase();
	const shown = withSelectedOptions(options, selected).filter((option) =>
		option.label.toLowerCase().includes(needle),
	);
	const label = definition.label.toLowerCase();

	return (
		<>
			<div className="flex items-center gap-1 px-2 pb-2">
				<button
					type="button"
					onClick={onBack}
					aria-label="Back to filters"
					className="flex h-8 items-center gap-1 rounded-lg pr-2.5 pl-1.5 text-[13px] font-medium text-muted-foreground active:bg-ghost-hover"
				>
					<ChevronLeftIcon size={14} />
					Filter
				</button>
				<DrawerTitle className="text-[15px] font-semibold text-text-strong">
					{definition.label}
				</DrawerTitle>
			</div>
			<div className="px-4 pb-2">
				<input
					type="search"
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder={`Find ${label}…`}
					aria-label={`Find ${label}`}
					className="h-10 w-full rounded-lg bg-surface-0 px-3 text-[15px] font-[450] text-foreground shadow-field outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
				/>
			</div>
			<div className="max-h-[50dvh] overflow-y-auto overscroll-contain px-2 pb-4">
				{shown.map((option) => {
					const checked = selected.has(option.value);
					return (
						<DrawerRow
							key={option.value}
							role="checkbox"
							aria-checked={checked}
							onClick={() => onToggle(option.value)}
							leading={option.icon}
							trailing={
								checked ? <CheckIcon size={16} strokeWidth={2} /> : null
							}
						>
							{option.label}
						</DrawerRow>
					);
				})}
				{shown.length === 0 ? (
					<p className="px-3 py-3 text-[13px] text-muted-foreground">
						No {label} matches
					</p>
				) : null}
			</div>
		</>
	);
}

function DrawerHeading({ children }: { children: ReactNode }) {
	return (
		<DrawerTitle className="px-4 pb-3 text-[15px] font-semibold text-text-strong">
			{children}
		</DrawerTitle>
	);
}

function DrawerRow({
	leading,
	trailing,
	className,
	children,
	...props
}: ComponentProps<"button"> & {
	leading?: ReactNode;
	trailing?: ReactNode;
}) {
	return (
		<button
			type="button"
			className={cn(
				"flex h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-[15px] font-[450] text-text-header active:bg-ghost-hover [&_svg]:shrink-0",
				className,
			)}
			{...props}
		>
			{leading ? (
				<span className="flex shrink-0 items-center text-muted-foreground">
					{leading}
				</span>
			) : null}
			<span className="min-w-0 flex-1 truncate">{children}</span>
			{trailing ? (
				<span className="flex shrink-0 items-center gap-2 text-muted-foreground">
					{trailing}
				</span>
			) : null}
		</button>
	);
}
