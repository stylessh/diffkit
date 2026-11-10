import { Checkbox } from "@diffkit/ui/components/checkbox";
import { cn } from "@diffkit/ui/lib/utils";
import {
	createContext,
	type ReactNode,
	useContext,
	useMemo,
	useRef,
	useSyncExternalStore,
} from "react";
import type { ListSelectionStore } from "#/lib/list-selection";
import { useGlobalShortcuts } from "#/lib/shortcuts";
import { useIsSkeletonSample } from "./skeleton-sample";

const ROW_SELECTOR = "[data-selection-key]";

/**
 * Squares a selected row's corners on the side that touches another selected
 * row, so a run of them reads as one block. The row reads the two variables
 * for its background radius. Lists render rows either as direct siblings or
 * each inside its own wrapper, hence both forms.
 */
const joinSelectedNeighbours = cn(
	"data-selected:[[data-selected]+&]:[--row-radius-top:0px] data-selected:has-[+[data-selected]]:[--row-radius-bottom:0px]",
	"data-selected:[:has(>[data-selected])+*>&]:[--row-radius-top:0px] data-selected:[:has(+*>[data-selected])>&]:[--row-radius-bottom:0px]",
);

type SelectionScope = {
	store: ListSelectionStore;
	/** Toggles one row, or with `extend` selects every row from the last one clicked to it. */
	select: (row: HTMLElement, extend: boolean) => void;
};

const SelectionScopeContext = createContext<SelectionScope | null>(null);

function rowKey(row: HTMLElement) {
	return row.dataset.selectionKey ?? "";
}

function rowsIn(root: HTMLElement | null) {
	return Array.from(root?.querySelectorAll<HTMLElement>(ROW_SELECTOR) ?? []);
}

/**
 * Makes every `SelectableRow` below it selectable. Ranges and "select all"
 * follow the rows as rendered, so a collapsed group or a regrouped list never
 * selects something the user cannot see.
 */
export function ListSelectionScope({
	store,
	shortcutsEnabled,
	onEscape,
	children,
}: {
	store: ListSelectionStore;
	shortcutsEnabled: boolean;
	onEscape: () => void;
	children: ReactNode;
}) {
	const rootRef = useRef<HTMLDivElement>(null);
	// The row itself, not its key: one pull request can be listed under two groups.
	const anchorRef = useRef<HTMLElement>(null);
	const isSelecting = useSyncExternalStore(
		store.subscribe,
		() => store.get().size > 0,
	);

	const scope = useMemo<SelectionScope>(
		() => ({
			store,
			select(row, extend) {
				const rows = rowsIn(rootRef.current);
				const from = anchorRef.current ? rows.indexOf(anchorRef.current) : -1;
				const to = rows.indexOf(row);
				anchorRef.current = row;
				if (!extend || from === -1) {
					store.toggle(rowKey(row));
					return;
				}
				store.add(
					rows.slice(Math.min(from, to), Math.max(from, to) + 1).map(rowKey),
				);
			},
		}),
		[store],
	);

	useGlobalShortcuts([
		{
			shortcut: { key: "x" },
			enabled: shortcutsEnabled,
			onTrigger: () => {
				// Hover first: a clicked checkbox keeps focus after the pointer moves on.
				const row =
					rootRef.current?.querySelector<HTMLElement>(
						`${ROW_SELECTOR}:hover`,
					) ?? document.activeElement?.closest<HTMLElement>(ROW_SELECTOR);
				if (row && rootRef.current?.contains(row)) scope.select(row, false);
			},
		},
		{
			shortcut: { key: "a", mod: true },
			enabled: shortcutsEnabled,
			onTrigger: () => {
				store.add(rowsIn(rootRef.current).map(rowKey));
			},
		},
		{
			shortcut: { key: "Escape" },
			// An open menu takes Escape first and marks it handled.
			preventDefault: false,
			onTrigger: (event) => {
				if (!event.defaultPrevented) onEscape();
			},
		},
	]);

	return (
		<SelectionScopeContext.Provider value={scope}>
			<div
				ref={rootRef}
				className="contents"
				data-selecting={isSelecting ? "" : undefined}
			>
				{children}
			</div>
		</SelectionScopeContext.Provider>
	);
}

/**
 * Adds a checkbox in the row's left gutter. Outside a `ListSelectionScope`
 * (and for skeleton samples) it renders the row untouched.
 */
export function SelectableRow({
	selectionKey,
	label,
	children,
}: {
	selectionKey: string;
	label: string;
	children: ReactNode;
}) {
	const scope = useContext(SelectionScopeContext);
	const isSample = useIsSkeletonSample();
	if (!scope || isSample) return children;
	return (
		<SelectableRowInScope
			scope={scope}
			selectionKey={selectionKey}
			label={label}
		>
			{children}
		</SelectableRowInScope>
	);
}

function SelectableRowInScope({
	scope,
	selectionKey,
	label,
	children,
}: {
	scope: SelectionScope;
	selectionKey: string;
	label: string;
	children: ReactNode;
}) {
	const ref = useRef<HTMLDivElement>(null);
	const selected = useSyncExternalStore(scope.store.subscribe, () =>
		scope.store.get().has(selectionKey),
	);

	return (
		<div
			ref={ref}
			data-selection-key={selectionKey}
			data-selected={selected ? "" : undefined}
			className={cn("group/select relative", joinSelectedNeighbours)}
		>
			{children}
			<Checkbox
				checked={selected}
				aria-label={label}
				onMouseDown={(event) => {
					if (event.shiftKey) event.preventDefault();
				}}
				onClick={(event) => {
					if (ref.current) scope.select(ref.current, event.shiftKey);
				}}
				className={cn(
					"absolute top-1/2 left-[10px] hidden -translate-y-1/2 opacity-0 transition-opacity md:block",
					"after:absolute after:-inset-x-2.5 after:-inset-y-3.5",
					"border border-icon-faint data-[state=checked]:border-transparent data-[state=unchecked]:hover:border-muted-foreground",
					"group-hover/select:opacity-100 focus-visible:opacity-100 data-[state=checked]:opacity-100 in-data-selecting:opacity-100",
				)}
			/>
		</div>
	);
}
