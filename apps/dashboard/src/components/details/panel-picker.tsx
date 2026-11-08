import { MenuSearch } from "@diffkit/ui/components/menu";
import {
	Popover,
	PopoverAnchor,
	PopoverContent,
} from "@diffkit/ui/components/popover";
import type { KeyboardEvent, ReactNode, RefObject } from "react";

/**
 * A properties-panel picker, as Linear assigns an issue: the section's rows
 * (ghost pills, the + under them) anchor a 240px popover with a search row
 * and 32px option rows. Any row can open it, so it is controlled.
 */
export function PanelPicker({
	open,
	onOpenChange,
	search,
	onSearchChange,
	onKeyDown,
	placeholder,
	listRef,
	anchor,
	children,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	search: string;
	onSearchChange: (value: string) => void;
	onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
	placeholder: string;
	listRef?: RefObject<HTMLDivElement | null>;
	/** The section's rows: the picker opens beneath them. */
	anchor: ReactNode;
	children: ReactNode;
}) {
	return (
		<Popover open={open} onOpenChange={onOpenChange}>
			<PopoverAnchor asChild>
				<div className="flex flex-col gap-1">{anchor}</div>
			</PopoverAnchor>
			<PopoverContent
				align="start"
				sideOffset={4}
				className="w-[240px] p-0"
				onOpenAutoFocus={(event) => event.preventDefault()}
			>
				<MenuSearch
					// biome-ignore lint/a11y/noAutofocus: the picker opens to type into, as Linear's do
					autoFocus
					value={search}
					onChange={(event) => onSearchChange(event.target.value)}
					onKeyDown={onKeyDown}
					placeholder={placeholder}
					aria-label={placeholder}
				/>
				<div
					ref={listRef}
					role="listbox"
					aria-multiselectable="true"
					className="max-h-[min(60vh,20rem)] overflow-y-auto p-1.5"
				>
					{children}
				</div>
			</PopoverContent>
		</Popover>
	);
}

/** The muted line a picker shows while loading or when nothing matches. */
export function PanelPickerEmpty({ children }: { children: ReactNode }) {
	return (
		<p className="px-2 py-2 text-[13px] text-muted-foreground">{children}</p>
	);
}
