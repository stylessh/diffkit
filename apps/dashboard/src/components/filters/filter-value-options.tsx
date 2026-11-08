import { DropdownMenuCheckboxItem } from "@diffkit/ui/components/dropdown-menu";
import { MenuSearch } from "@diffkit/ui/components/menu";
import { type KeyboardEvent, useCallback, useRef, useState } from "react";
import type { FilterDefinition, FilterOption } from "./filter-model";

const MENU_ITEM_SELECTOR =
	'[role="menuitem"]:not([data-disabled]), [role="menuitemcheckbox"]:not([data-disabled]), [role="menuitemradio"]:not([data-disabled])';

export function focusFirstMenuItem(from: HTMLElement) {
	const menu = from.closest<HTMLElement>('[role="menu"]');
	const item = menu?.querySelector<HTMLElement>(MENU_ITEM_SELECTOR) ?? null;
	item?.focus();
	return item;
}

/** Selected values the current items no longer carry still show, so they can be cleared. */
function withSelectedOptions(
	options: FilterOption[],
	selected: Set<string>,
): FilterOption[] {
	const known = new Set(options.map((option) => option.value));
	const missing = [...selected]
		.filter((value) => !known.has(value))
		.map((value) => ({ value, label: value }));
	return [...options, ...missing];
}

export function FilterValueOptions({
	definition,
	options,
	selected = new Set(),
	onToggle,
	focusSearchOnContentFocus = false,
}: {
	definition: FilterDefinition;
	options: FilterOption[];
	selected?: Set<string>;
	onToggle: (value: string) => void;
	focusSearchOnContentFocus?: boolean;
}) {
	const [query, setQuery] = useState("");
	const searchRef = useRef<HTMLInputElement>(null);
	const needle = query.trim().toLowerCase();
	const shown = withSelectedOptions(options, selected).filter((option) =>
		option.label.toLowerCase().includes(needle),
	);
	const label = definition.label.toLowerCase();
	const attachSearch = useCallback(
		(input: HTMLInputElement | null) => {
			searchRef.current = input;
			if (input && !focusSearchOnContentFocus) {
				requestAnimationFrame(() => input.focus());
			}
		},
		[focusSearchOnContentFocus],
	);

	const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			focusFirstMenuItem(event.currentTarget);
		} else if (event.key === "Enter") {
			event.preventDefault();
			const first = shown[0];
			if (first) onToggle(first.value);
		} else if (event.key === "Escape" && query) {
			event.preventDefault();
			event.stopPropagation();
			setQuery("");
		} else if (
			event.key.length === 1 ||
			(query && (event.key === "ArrowLeft" || event.key === "ArrowRight"))
		) {
			event.stopPropagation();
		}
	};

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: forwards keyboard focus that lands on the submenu to its search field
		<div
			onFocus={(event) => {
				if (!focusSearchOnContentFocus) return;
				if (event.target.getAttribute("role") === "menu") {
					searchRef.current?.focus();
				}
			}}
		>
			<MenuSearch
				ref={attachSearch}
				value={query}
				onChange={(event) => setQuery(event.target.value)}
				onKeyDown={onKeyDown}
				placeholder={`Filter ${label}…`}
				aria-label={`Filter ${label}`}
			/>
			<div className="flex max-h-[min(60vh,20rem)] flex-col overflow-y-auto p-1">
				{shown.map((option) => (
					<DropdownMenuCheckboxItem
						key={option.value}
						checked={selected.has(option.value)}
						onSelect={(event) => event.preventDefault()}
						onCheckedChange={() => onToggle(option.value)}
						className="gap-2"
					>
						{option.icon ? (
							<span className="flex size-4 shrink-0 items-center justify-center">
								{option.icon}
							</span>
						) : null}
						<span className="min-w-0 truncate">{option.label}</span>
					</DropdownMenuCheckboxItem>
				))}
				{shown.length === 0 ? (
					<p className="px-2 py-1.5 text-[13px] text-muted-foreground">
						No {label} matches
					</p>
				) : null}
			</div>
		</div>
	);
}
