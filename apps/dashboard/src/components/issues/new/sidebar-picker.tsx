import { CheckIcon, PlusSignIcon, SearchIcon } from "@diffkit/icons";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@diffkit/ui/components/popover";
import { cn } from "@diffkit/ui/lib/utils";
import {
	type KeyboardEvent,
	type ReactNode,
	useMemo,
	useRef,
	useState,
} from "react";
import { PickerSkeletonRows } from "#/components/shared/picker-skeleton-rows";

type PickerState =
	| { status: "closed" }
	| { status: "open"; search: string; focusedIndex: number };

const CLOSED: PickerState = { status: "closed" };
const OPENED: PickerState = { status: "open", search: "", focusedIndex: -1 };

const rowClassName = "flex w-full items-center gap-2 px-3 py-1.5 text-sm";

export type SidebarPickerLeading = {
	shape: "avatar" | "icon";
	size: number;
};

export function SidebarPicker<T>({
	title,
	placeholder,
	items,
	getName,
	renderLeading,
	leading,
	selectedNames,
	onToggle,
	loading,
	emptyLabel,
	noMatchLabel,
	children,
}: {
	title: string;
	placeholder: string;
	items: readonly T[];
	getName: (item: T) => string;
	renderLeading: (item: T) => ReactNode;
	leading: SidebarPickerLeading;
	selectedNames: ReadonlySet<string>;
	onToggle: (item: T) => void;
	loading: boolean;
	emptyLabel: string;
	noMatchLabel: string;
	children: ReactNode;
}) {
	const [state, setState] = useState<PickerState>(CLOSED);
	const listRef = useRef<HTMLDivElement>(null);
	const search = state.status === "open" ? state.search : "";
	const focusedIndex = state.status === "open" ? state.focusedIndex : -1;

	const filtered = useMemo(() => {
		if (!search) return items;
		const query = search.toLowerCase();
		return items.filter((item) => getName(item).toLowerCase().includes(query));
	}, [items, search, getName]);

	const focus = (index: number) =>
		setState((current) =>
			current.status === "open" ? { ...current, focusedIndex: index } : current,
		);

	const focusAndReveal = (index: number) => {
		focus(index);
		listRef.current
			?.querySelector(`[data-index="${index}"]`)
			?.scrollIntoView({ block: "nearest" });
	};

	const handleKeyDown = (event: KeyboardEvent) => {
		if (filtered.length === 0) return;
		if (event.key === "ArrowDown") {
			event.preventDefault();
			focusAndReveal(focusedIndex < filtered.length - 1 ? focusedIndex + 1 : 0);
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			focusAndReveal(focusedIndex > 0 ? focusedIndex - 1 : filtered.length - 1);
		} else if (event.key === "Enter") {
			event.preventDefault();
			const item = filtered[focusedIndex];
			if (item !== undefined) onToggle(item);
		}
	};

	return (
		<div className="flex flex-col gap-2.5">
			<div className="flex items-center justify-between">
				<h3 className="text-[13px] font-[450] text-muted-foreground">
					{title}
				</h3>
				<Popover
					open={state.status === "open"}
					onOpenChange={(open) => setState(open ? OPENED : CLOSED)}
				>
					<PopoverTrigger asChild>
						<button
							type="button"
							className="flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-ghost-hover hover:text-foreground"
						>
							<PlusSignIcon size={14} strokeWidth={2} />
						</button>
					</PopoverTrigger>
					<PopoverContent align="end" className="w-64 p-0">
						<div className="flex items-center gap-2 border-b-[0.5px] px-3 py-2">
							<SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
							<input
								value={search}
								onChange={(event) =>
									setState({
										status: "open",
										search: event.target.value,
										focusedIndex: -1,
									})
								}
								onKeyDown={handleKeyDown}
								placeholder={placeholder}
								className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
							/>
						</div>
						<div ref={listRef} className="max-h-64 overflow-y-auto py-1">
							{loading ? (
								<PickerSkeletonRows
									label={`Loading ${title.toLowerCase()}`}
									leading={leading.shape}
									leadingSize={leading.size}
									rowClassName={rowClassName}
								/>
							) : filtered.length === 0 ? (
								<p className="px-3 py-4 text-center text-xs text-muted-foreground">
									{search ? noMatchLabel : emptyLabel}
								</p>
							) : (
								filtered.map((item, index) => {
									const name = getName(item);
									return (
										<button
											key={name}
											type="button"
											data-index={index}
											onClick={() => onToggle(item)}
											onMouseEnter={() => focus(index)}
											className={cn(
												rowClassName,
												"text-left transition-colors hover:bg-ghost-hover",
												focusedIndex === index && "bg-surface-1",
											)}
										>
											{renderLeading(item)}
											<span className="min-w-0 flex-1 truncate">{name}</span>
											{selectedNames.has(name) ? (
												<CheckIcon
													size={14}
													strokeWidth={2}
													className="shrink-0 text-success"
												/>
											) : null}
										</button>
									);
								})
							)}
						</div>
					</PopoverContent>
				</Popover>
			</div>
			{children}
		</div>
	);
}
