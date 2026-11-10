import { SearchIcon, XIcon } from "@diffkit/icons";
import { cn } from "@diffkit/ui/lib/utils";
import { AnimatePresence, motion } from "motion/react";
import {
	memo,
	useCallback,
	useDeferredValue,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { FileTypeIcon } from "#/components/shared/file-type-icon";
import {
	type FileSearchEntry,
	type FileSearchResult,
	getMatchIndices,
	searchFiles,
} from "#/lib/fuzzy-file-search";

function HighlightedText({
	text,
	indices,
	className,
}: {
	text: string;
	indices: Set<number>;
	className?: string;
}) {
	if (indices.size === 0) {
		return <span className={className}>{text}</span>;
	}

	const parts: React.ReactNode[] = [];
	let i = 0;
	while (i < text.length) {
		if (indices.has(i)) {
			const start = i;
			while (i < text.length && indices.has(i)) i++;
			parts.push(
				<span key={start} className="text-foreground">
					{text.slice(start, i)}
				</span>,
			);
		} else {
			const start = i;
			while (i < text.length && !indices.has(i)) i++;
			parts.push(<span key={start}>{text.slice(start, i)}</span>);
		}
	}

	return <span className={className}>{parts}</span>;
}

const spring = {
	type: "spring" as const,
	duration: 0.18,
	bounce: 0.05,
};

/**
 * Memoised so the card can re-render on every active-file change while the
 * diff scrolls without the shared-layout glyph re-measuring the layout.
 */
const SearchGlyph = memo(function SearchGlyph({
	isExpanded,
}: {
	isExpanded: boolean;
}) {
	return (
		<motion.span
			layoutId="sidebar-search-icon"
			transition={spring}
			className={cn(
				"absolute text-muted-foreground transition-[left] duration-150 ease-out",
				isExpanded ? "left-3.5" : "left-2.5",
			)}
		>
			<SearchIcon size={14} />
		</motion.span>
	);
});

type FileSearchCardProps = {
	entries: FileSearchEntry[];
	onSelect: (entry: FileSearchResult) => void;
	placeholder?: string;
	defaultEntries?: FileSearchEntry[];
	activePath?: string;
	shortcutKey?: string | null;
};

export const FileSearchCard = memo(function FileSearchCard({
	entries,
	onSelect,
	placeholder = "Search files...",
	defaultEntries,
	activePath,
	shortcutKey = "f",
}: FileSearchCardProps) {
	const [query, setQuery] = useState("");
	const deferredQuery = useDeferredValue(query);
	const [focused, setFocused] = useState(false);
	const [activeIndex, setActiveIndex] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);
	const cardRef = useRef<HTMLDivElement>(null);
	const isExpanded = focused || query.length > 0;
	const hasResults = deferredQuery.trim().length > 0;

	const searchResults = useMemo(
		() => searchFiles(deferredQuery, entries),
		[deferredQuery, entries],
	);

	const computedDefaults = useMemo(
		() =>
			(defaultEntries ?? entries.filter((f) => f.type === "file"))
				.slice(0, 5)
				.map((f) => ({ ...f, score: 0 })),
		[defaultEntries, entries],
	);

	const visibleResults = hasResults ? searchResults : computedDefaults;

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset index when query or result count changes
	useEffect(() => {
		setActiveIndex(0);
	}, [deferredQuery, visibleResults.length]);

	const handleClear = useCallback(() => {
		setQuery("");
		inputRef.current?.focus();
	}, []);

	const handleSelect = useCallback(
		(entry: FileSearchResult) => {
			onSelect(entry);
			setFocused(false);
			setQuery("");
			inputRef.current?.blur();
		},
		[onSelect],
	);

	const handleInputKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "ArrowDown") {
				e.preventDefault();
				setActiveIndex((prev) =>
					prev < visibleResults.length - 1 ? prev + 1 : 0,
				);
			} else if (e.key === "ArrowUp") {
				e.preventDefault();
				setActiveIndex((prev) =>
					prev > 0 ? prev - 1 : visibleResults.length - 1,
				);
			} else if (e.key === "Enter" && visibleResults.length > 0) {
				e.preventDefault();
				const item = visibleResults[activeIndex];
				if (item) handleSelect(item);
			}
		},
		[visibleResults, activeIndex, handleSelect],
	);

	useEffect(() => {
		if (!isExpanded) return;
		function handlePointerDown(e: PointerEvent) {
			if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
				setFocused(false);
				inputRef.current?.blur();
			}
		}
		document.addEventListener("pointerdown", handlePointerDown);
		return () => document.removeEventListener("pointerdown", handlePointerDown);
	}, [isExpanded]);

	useEffect(() => {
		function handleKeyDown(e: KeyboardEvent) {
			if (e.key === "Escape" && isExpanded) {
				setFocused(false);
				setQuery("");
				inputRef.current?.blur();
				return;
			}
			if (
				shortcutKey &&
				(e.key === "/" || e.key === shortcutKey) &&
				!e.metaKey &&
				!e.ctrlKey &&
				document.activeElement?.tagName !== "INPUT" &&
				document.activeElement?.tagName !== "TEXTAREA"
			) {
				e.preventDefault();
				inputRef.current?.focus();
			}
		}
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [isExpanded, shortcutKey]);

	return (
		<div className="relative z-10 shrink-0 px-3 pt-4 pb-2">
			<div className="h-8" />

			<div
				ref={cardRef}
				className={cn(
					"absolute overflow-hidden rounded-lg border-[0.5px] bg-surface-0 transition-[inset-inline,top,box-shadow] duration-150 ease-out",
					isExpanded
						? "inset-x-2 top-3 shadow-lg ring-1 ring-accent/20"
						: "inset-x-3 top-4",
				)}
			>
				<div
					className={cn(
						"relative flex items-center transition-[padding] duration-150 ease-out",
						isExpanded ? "px-1" : "px-0",
					)}
				>
					<SearchGlyph isExpanded={isExpanded} />
					<input
						ref={inputRef}
						type="text"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						onFocus={() => setFocused(true)}
						onKeyDown={handleInputKeyDown}
						placeholder={placeholder}
						className={cn(
							"w-full text-[13px] text-foreground placeholder:text-muted-foreground transition-[height,padding] duration-150 ease-out focus:outline-none",
							isExpanded ? "h-10 pr-9 pl-9" : "h-8 pr-8 pl-8",
						)}
					/>
					{query ? (
						<button
							type="button"
							onClick={handleClear}
							className={cn(
								"absolute text-muted-foreground transition-[right] duration-150 ease-out hover:text-foreground",
								isExpanded ? "right-3" : "right-2",
							)}
						>
							<XIcon size={14} />
						</button>
					) : (
						<AnimatePresence>
							{!isExpanded && shortcutKey && (
								<motion.kbd
									key="shortcut-hint"
									initial={{ opacity: 0, scale: 0.8 }}
									animate={{ opacity: 1, scale: 1 }}
									exit={{ opacity: 0, scale: 0.8 }}
									transition={spring}
									className="absolute right-2 flex size-5 items-center justify-center rounded border-[0.5px] border-border/60 bg-surface-1 text-[10px] font-medium text-muted-foreground"
								>
									{shortcutKey.toUpperCase()}
								</motion.kbd>
							)}
						</AnimatePresence>
					)}
				</div>

				<AnimatePresence initial={false}>
					{isExpanded && (
						<motion.div
							key="search-results"
							initial={{ height: 0, opacity: 0 }}
							animate={{ height: "auto", opacity: 1 }}
							exit={{ height: 0, opacity: 0 }}
							transition={spring}
							className="overflow-hidden border-t-[0.5px]"
						>
							<div className="max-h-[min(400px,60vh)] overflow-y-auto">
								{visibleResults.length > 0 ? (
									visibleResults.map((result, i) => (
										<SearchResultRow
											key={result.path}
											result={result}
											isHighlighted={i === activeIndex}
											isActive={activePath === result.path}
											query={deferredQuery}
											onSelect={handleSelect}
										/>
									))
								) : (
									<div className="px-3 py-6 text-center text-xs text-muted-foreground">
										No files found
									</div>
								)}
							</div>
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</div>
	);
});

const SearchResultRow = memo(function SearchResultRow({
	result,
	isHighlighted,
	isActive,
	query,
	onSelect,
}: {
	result: FileSearchResult;
	isHighlighted: boolean;
	isActive: boolean;
	query: string;
	onSelect: (entry: FileSearchResult) => void;
}) {
	const isDir = result.type === "dir";
	const dir = result.path.includes("/")
		? result.path.slice(0, result.path.lastIndexOf("/"))
		: null;
	const ref = useRef<HTMLButtonElement>(null);
	const nameIndices = useMemo(
		() => getMatchIndices(query, result.name),
		[query, result.name],
	);
	const dirIndices = useMemo(
		() => (dir ? getMatchIndices(query, dir) : new Set<number>()),
		[query, dir],
	);

	useEffect(() => {
		if (isHighlighted && ref.current) {
			ref.current.scrollIntoView({ block: "nearest" });
		}
	}, [isHighlighted]);

	return (
		<button
			ref={ref}
			type="button"
			onClick={() => onSelect(result)}
			className={cn(
				"flex w-full items-center gap-2 px-3 py-1.5 text-[13px] transition-colors hover:bg-surface-1",
				(isActive || isHighlighted) && "bg-surface-1",
			)}
		>
			<FileTypeIcon
				path={result.path}
				kind={isDir ? "directory" : "file"}
				size={15}
			/>
			<div className="flex min-w-0 flex-col text-left">
				<HighlightedText
					text={result.name}
					indices={nameIndices}
					className={cn(
						"truncate",
						isActive ? "text-foreground" : "text-muted-foreground",
					)}
				/>
				{dir && (
					<HighlightedText
						text={dir}
						indices={dirIndices}
						className="truncate text-[11px] text-muted-foreground/60"
					/>
				)}
			</div>
		</button>
	);
});
