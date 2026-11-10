import {
	CheckIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	CloseIcon,
	SearchIcon,
} from "@diffkit/icons";
import {
	Drawer,
	DrawerContent,
	DrawerTitle,
} from "@diffkit/ui/components/drawer";
import { cn } from "@diffkit/ui/lib/utils";
import { type ComponentProps, type ReactNode, useState } from "react";
import type { FilterDefinition, FilterOption } from "./filter-model";
import { withSelectedOptions } from "./filter-value-options";
import { type ListFiltersConfig, useFilterOptions } from "./list-toolbar";

export type MobileListDrawer = "search" | "filter" | "sort";

/**
 * The drawers behind a list's phone action bar. Loaded on first open, so
 * desktop, where the bar is hidden, never pays for them or for vaul.
 */
export default function MobileListDrawers({
	open,
	onOpenChange,
	state,
	items,
	searchPlaceholder,
}: ListFiltersConfig & {
	open: MobileListDrawer | null;
	onOpenChange: (open: MobileListDrawer | null) => void;
}) {
	const options = useFilterOptions(state.filterDefs, items);
	const close = () => onOpenChange(null);
	const drawerProps = (which: MobileListDrawer) => ({
		open: open === which,
		onOpenChange: (next: boolean) => onOpenChange(next ? which : null),
	});
	const currentSort = state.sortOptions.find(
		(option) => option.id === state.sortId,
	);

	return (
		<>
			<Drawer {...drawerProps("search")}>
				<DrawerContent aria-describedby={undefined}>
					<DrawerHeading>Search</DrawerHeading>
					<form
						className="px-4 pb-5"
						onSubmit={(event) => {
							event.preventDefault();
							close();
						}}
					>
						<div className="flex h-10 items-center gap-2 rounded-lg bg-surface-0 px-3 text-muted-foreground shadow-field">
							<SearchIcon size={15} strokeWidth={2} className="shrink-0" />
							<input
								// biome-ignore lint/a11y/noAutofocus: the drawer only opens because the person asked to search
								autoFocus
								type="search"
								enterKeyHint="search"
								value={state.searchQuery}
								onChange={(event) => state.setSearchQuery(event.target.value)}
								placeholder={searchPlaceholder}
								aria-label={searchPlaceholder}
								className="h-full min-w-0 flex-1 bg-transparent text-[15px] font-[450] text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
							/>
							{state.searchQuery ? (
								<button
									type="button"
									aria-label="Clear search"
									onClick={() => state.setSearchQuery("")}
									className="flex size-7 shrink-0 items-center justify-center rounded-md active:bg-ghost-hover"
								>
									<CloseIcon size={14} />
								</button>
							) : null}
						</div>
					</form>
				</DrawerContent>
			</Drawer>

			<Drawer {...drawerProps("filter")}>
				<DrawerContent aria-describedby={undefined}>
					<FilterDrawerBody state={state} options={options} onDone={close} />
				</DrawerContent>
			</Drawer>

			<Drawer {...drawerProps("sort")}>
				<DrawerContent aria-describedby={undefined}>
					<DrawerHeading>Sort by</DrawerHeading>
					<div className="px-2 pb-4">
						{state.sortOptions.map((option) => (
							<DrawerRow
								key={option.id}
								aria-pressed={option.id === currentSort?.id}
								onClick={() => {
									state.setSortId(option.id);
									close();
								}}
								trailing={
									option.id === currentSort?.id ? (
										<CheckIcon size={16} strokeWidth={2} />
									) : null
								}
							>
								{option.label}
							</DrawerRow>
						))}
					</div>
				</DrawerContent>
			</Drawer>
		</>
	);
}

/** Fields first; picking one swaps the drawer to that field's values. */
function FilterDrawerBody({
	state,
	options,
	onDone,
}: {
	state: ListFiltersConfig["state"];
	options: Map<string, FilterOption[]>;
	onDone: () => void;
}) {
	const [fieldId, setFieldId] = useState<string | null>(null);
	const field = state.filterDefs.find((def) => def.id === fieldId);
	const selectedOf = (id: string) =>
		state.activeFilters.find((filter) => filter.fieldId === id)?.values;

	if (field) {
		return (
			<FilterValues
				definition={field}
				options={options.get(field.id) ?? []}
				selected={selectedOf(field.id) ?? new Set()}
				onToggle={(value) => state.toggleValue(field.id, value)}
				onBack={() => setFieldId(null)}
			/>
		);
	}

	return (
		<>
			<div className="flex items-center justify-between pr-2">
				<DrawerHeading>Filter</DrawerHeading>
				{state.activeFilters.length > 0 ? (
					<button
						type="button"
						onClick={() => {
							state.clearAllFilters();
							onDone();
						}}
						className="mb-2 h-8 rounded-lg px-3 text-[13px] font-medium text-muted-foreground active:bg-ghost-hover"
					>
						Clear all
					</button>
				) : null}
			</div>
			<div className="px-2 pb-4">
				{state.filterDefs.map((def) => {
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
