import {
	PanelAddButton,
	PanelPill,
	PanelSection,
} from "@diffkit/ui/components/detail-layout";
import {
	MenuHead,
	MenuRowEnd,
	menuRowClassName,
} from "@diffkit/ui/components/menu";
import {
	type KeyboardEvent,
	type ReactNode,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	PanelPicker,
	PanelPickerEmpty,
} from "#/components/details/panel-picker";
import { PickerSkeletonRows } from "#/components/shared/picker-skeleton-rows";

export type PickerOption = {
	key: string;
	label: string;
	leading?: ReactNode;
	group?: string;
};

type PickerState =
	| { status: "closed" }
	| { status: "open"; search: string; focusedIndex: number };

const CLOSED: PickerState = { status: "closed" };
const OPENED: PickerState = { status: "open", search: "", focusedIndex: -1 };

function matchesSearch(option: PickerOption, search: string) {
	return option.label.toLowerCase().includes(search.trim().toLowerCase());
}

export function PropertyPicker({
	label,
	addLabel,
	placeholder,
	emptyLabel,
	options,
	selected,
	loading,
	display = "rows",
	selection = "many",
	onToggle,
}: {
	label: string;
	addLabel: string;
	placeholder: string;
	emptyLabel: string;
	options: PickerOption[];
	selected: PickerOption[];
	loading: boolean;
	display?: "rows" | "pills";
	selection?: "one" | "many";
	onToggle: (key: string) => void;
}) {
	const [state, setState] = useState<PickerState>(CLOSED);
	const listRef = useRef<HTMLDivElement>(null);
	const search = state.status === "open" ? state.search : "";
	const focusedIndex = state.status === "open" ? state.focusedIndex : -1;

	const selectedKeys = useMemo(
		() => new Set(selected.map((option) => option.key)),
		[selected],
	);
	const visible = useMemo(
		() => (search ? options.filter((o) => matchesSearch(o, search)) : options),
		[options, search],
	);

	const focus = (index: number) => {
		setState((current) =>
			current.status === "open" ? { ...current, focusedIndex: index } : current,
		);
		listRef.current
			?.querySelector(`[data-index="${index}"]`)
			?.scrollIntoView({ block: "nearest" });
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (visible.length === 0) return;
		if (event.key === "ArrowDown") {
			event.preventDefault();
			focus(focusedIndex < visible.length - 1 ? focusedIndex + 1 : 0);
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			focus(focusedIndex > 0 ? focusedIndex - 1 : visible.length - 1);
		} else if (event.key === "Enter" && focusedIndex >= 0) {
			event.preventDefault();
			onToggle(visible[focusedIndex].key);
		} else if (!search && /^[1-9]$/.test(event.key)) {
			const option = visible[Number(event.key) - 1];
			if (!option) return;
			event.preventDefault();
			onToggle(option.key);
		}
	};

	const open = () =>
		setState((current) => (current.status === "open" ? current : OPENED));
	const expanded = state.status === "open";
	const triggerProps = {
		"aria-haspopup": "listbox",
		"aria-expanded": expanded,
		onClick: open,
	} as const;
	const addButton =
		selection === "one" && selected.length > 0 ? null : (
			<PanelAddButton
				aria-label={addLabel}
				className={
					display === "pills" && selected.length > 0 ? "ml-0" : undefined
				}
				{...triggerProps}
			/>
		);

	return (
		<PanelSection label={label}>
			<PanelPicker
				open={expanded}
				onOpenChange={(next) => setState(next ? OPENED : CLOSED)}
				search={search}
				onSearchChange={(value) =>
					setState({ status: "open", search: value, focusedIndex: -1 })
				}
				onKeyDown={handleKeyDown}
				placeholder={placeholder}
				listRef={listRef}
				anchor={
					display === "pills" ? (
						<div className="flex flex-wrap items-center gap-1.5">
							{selected.map((option) => (
								<button
									key={option.key}
									type="button"
									className="inline-flex h-6 max-w-full items-center gap-1.5 rounded-full bg-chip px-2 text-xs font-[450] text-text-header shadow-chip transition-colors hover:bg-row-hover"
									{...triggerProps}
								>
									{option.leading}
									<span className="truncate">{option.label}</span>
								</button>
							))}
							{addButton}
						</div>
					) : (
						<>
							{selected.map((option) => (
								<PanelPill key={option.key} asChild icon={option.leading}>
									<button type="button" {...triggerProps}>
										{option.label}
									</button>
								</PanelPill>
							))}
							{addButton}
						</>
					)
				}
			>
				{loading ? (
					<PickerSkeletonRows
						label={`Loading ${label.toLowerCase()}`}
						rowClassName={menuRowClassName}
					/>
				) : visible.length === 0 ? (
					<PanelPickerEmpty>
						{search.trim() ? `No match for “${search.trim()}”` : emptyLabel}
					</PanelPickerEmpty>
				) : (
					visible.map((option, index) => {
						const isSelected = selectedKeys.has(option.key);
						const startsGroup =
							option.group !== undefined &&
							option.group !== visible[index - 1]?.group;
						return (
							<div key={option.key}>
								{startsGroup ? <MenuHead>{option.group}</MenuHead> : null}
								<button
									type="button"
									role="option"
									aria-selected={isSelected}
									data-index={index}
									data-active={focusedIndex === index}
									onClick={() => onToggle(option.key)}
									onMouseEnter={() => focus(index)}
									className={menuRowClassName}
								>
									<span className="flex size-4 shrink-0 items-center justify-center">
										{option.leading}
									</span>
									<span className="truncate">{option.label}</span>
									<MenuRowEnd
										checked={isSelected}
										shortcut={!search && index < 9 ? index + 1 : undefined}
									/>
								</button>
							</div>
						);
					})
				)}
			</PanelPicker>
		</PanelSection>
	);
}
