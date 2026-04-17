import {
	type Dispatch,
	forwardRef,
	type SetStateAction,
	useCallback,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import { useTextareaContentFieldSizing } from "../hooks/use-textarea-content-field-sizing";
import { getCaretCoordinates } from "../lib/get-caret-coordinates";
import { cn } from "../lib/utils";
import { highlightCode, Markdown } from "./markdown";
import { Spinner } from "./spinner";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "./tooltip";

// ── Mention types ─────────────────────────────────────────────────

export type MentionCandidate = {
	id: string;
	label: string;
	avatarUrl?: string;
	secondary?: string;
};

export type MentionConfig = {
	candidates: MentionCandidate[];
	onActivate?: () => void;
	isLoading?: boolean;
};

// ── Editor props ──────────────────────────────────────────────────

export type MarkdownEditorHandle = {
	insertAtCaret: (snippet: string) => void;
	/** Swap a pending upload line (see `getCommentMediaUploadPlaceholderText`) for final HTML or an error line. */
	replaceUploadPlaceholder: (id: string, replacement: string) => void;
};

/** Machine-readable token embedded in the composer; replaced when the upload finishes. */
export function getCommentMediaUploadPlaceholderText(id: string): string {
	return `⏳ Uploading asset… [[DIFFKIT_UPLOAD:${id}]]`;
}

export type MarkdownEditorMediaUpload = {
	isDragActive: boolean;
	rootProps: React.HTMLAttributes<HTMLDivElement>;
	inputProps: React.InputHTMLAttributes<HTMLInputElement>;
	onToolbarAttach: () => void;
};

type MarkdownEditorProps = {
	value: string;
	onChange: Dispatch<SetStateAction<string>>;
	placeholder?: string;
	/** Compact mode for comment boxes — shorter height, no syntax highlight overlay */
	compact?: boolean;
	onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
	onPaste?: React.ClipboardEventHandler<HTMLTextAreaElement>;
	textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
	mentions?: MentionConfig;
	media?: MarkdownEditorMediaUpload;
	/** Scroll into view when typing at end — e.g. ref on the row below the editor (Send / Close PR). */
	scrollAnchorRef?: React.RefObject<HTMLElement | null>;
};

// ── Mention hook ──────────────────────────────────────────────────

type MentionState = {
	query: string;
	triggerIndex: number;
} | null;

function useMentions(
	editorRef: React.RefObject<HTMLTextAreaElement | null>,
	value: string,
	onChange: (value: string) => void,
	config?: MentionConfig,
) {
	const [mentionState, setMentionState] = useState<MentionState>(null);
	const [activeIndex, setActiveIndex] = useState(0);
	const [dropdownPos, setDropdownPos] = useState<{
		top: number;
		left: number;
	} | null>(null);
	const activatedRef = useRef(false);

	const filtered = useMemo(() => {
		if (!mentionState || !config) return [];
		const q = mentionState.query.toLowerCase();
		return config.candidates.filter((c) => c.label.toLowerCase().includes(q));
	}, [mentionState, config]);

	const detectMention = useCallback(() => {
		const textarea = editorRef.current;
		if (!textarea || !config) return;

		const cursor = textarea.selectionStart;
		const text = value.slice(0, cursor);

		// Walk backwards to find @ preceded by whitespace or at start
		let triggerIdx = -1;
		for (let i = text.length - 1; i >= 0; i--) {
			const ch = text[i];
			if (ch === "@") {
				if (i === 0 || /\s/.test(text[i - 1])) {
					triggerIdx = i;
				}
				break;
			}
			// Stop on whitespace — no valid @mention
			if (/\s/.test(ch)) break;
		}

		if (triggerIdx === -1) {
			setMentionState(null);
			return;
		}

		const query = text.slice(triggerIdx + 1);
		setMentionState({ query, triggerIndex: triggerIdx });
		setActiveIndex(0);

		// Fire onActivate once
		if (!activatedRef.current) {
			activatedRef.current = true;
			config.onActivate?.();
		}

		// Measure caret position for dropdown
		const coords = getCaretCoordinates(textarea, cursor);
		const rect = textarea.getBoundingClientRect();
		setDropdownPos({
			top: rect.top + coords.top + 20,
			left: rect.left + coords.left,
		});
	}, [editorRef, value, config]);

	const selectCandidate = useCallback(
		(candidate: MentionCandidate) => {
			if (!mentionState) return;
			const textarea = editorRef.current;
			if (!textarea) return;

			const before = value.slice(0, mentionState.triggerIndex);
			const after = value.slice(
				mentionState.triggerIndex + 1 + mentionState.query.length,
			);
			const insertion = `@${candidate.label} `;
			const newValue = before + insertion + after;
			onChange(newValue);

			const cursorPos = mentionState.triggerIndex + insertion.length;
			requestAnimationFrame(() => {
				textarea.focus();
				textarea.setSelectionRange(cursorPos, cursorPos);
			});

			setMentionState(null);
		},
		[mentionState, value, onChange, editorRef],
	);

	const handleMentionKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLTextAreaElement>): boolean => {
			if (!mentionState || filtered.length === 0) return false;

			switch (event.key) {
				case "ArrowDown":
					event.preventDefault();
					setActiveIndex((i) => (i + 1) % filtered.length);
					return true;
				case "ArrowUp":
					event.preventDefault();
					setActiveIndex((i) => (i <= 0 ? filtered.length - 1 : i - 1));
					return true;
				case "Enter":
				case "Tab":
					event.preventDefault();
					selectCandidate(filtered[activeIndex]);
					return true;
				case "Escape":
					event.preventDefault();
					setMentionState(null);
					return true;
				default:
					return false;
			}
		},
		[mentionState, filtered, activeIndex, selectCandidate],
	);

	const dismiss = useCallback(() => setMentionState(null), []);

	return {
		mentionState,
		filtered,
		activeIndex,
		dropdownPos,
		isLoading: config?.isLoading ?? false,
		detectMention,
		handleMentionKeyDown,
		selectCandidate,
		dismiss,
	};
}

// ── Compact write surface (comment box) ────────────────────────────

function CompactWriteSurface({
	value,
	onChange,
	editorRef,
	onKeyDown,
	onPaste,
	placeholder,
	scrollAnchorRef,
}: {
	value: string;
	onChange: (next: string) => void;
	editorRef: React.RefObject<HTMLTextAreaElement | null>;
	onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement>;
	onPaste?: React.ClipboardEventHandler<HTMLTextAreaElement>;
	placeholder: string;
	scrollAnchorRef?: React.RefObject<HTMLElement | null>;
}) {
	const contentSizingOpts = useMemo(
		() => ({
			minHeightPx: 88,
			maxHeightPx:
				typeof window !== "undefined"
					? Math.min(Math.floor(window.innerHeight * 0.85), 40 * 16)
					: 640,
		}),
		[],
	);

	const contentSizing = useTextareaContentFieldSizing(
		value,
		editorRef,
		contentSizingOpts,
		scrollAnchorRef,
	);

	return (
		<textarea
			ref={editorRef}
			value={value}
			onChange={(event) => onChange(event.target.value)}
			onKeyDown={onKeyDown}
			onPaste={onPaste}
			onPointerDown={contentSizing.onPointerDown}
			style={contentSizing.heightStyle}
			placeholder={placeholder}
			rows={4}
			className={cn(
				"min-h-[5.5rem] max-h-[min(85vh,40rem)] w-full resize-y overflow-y-auto bg-transparent p-3 text-sm outline-none placeholder:text-muted-foreground",
				contentSizing.sizingClassName,
			)}
		/>
	);
}

// ── Main component ────────────────────────────────────────────────

export const MarkdownEditor = forwardRef<
	MarkdownEditorHandle,
	MarkdownEditorProps
>(function MarkdownEditor(
	{
		value,
		onChange,
		placeholder = "Leave a comment...",
		compact,
		onKeyDown: externalOnKeyDown,
		onPaste,
		textareaRef: externalRef,
		mentions: mentionConfig,
		media: mediaUpload,
		scrollAnchorRef,
	},
	ref,
) {
	const [tab, setTab] = useState<"write" | "preview">("write");
	const internalRef = useRef<HTMLTextAreaElement>(null);
	const editorRef = externalRef || internalRef;

	const {
		mentionState,
		filtered,
		activeIndex,
		dropdownPos,
		isLoading: mentionLoading,
		detectMention,
		handleMentionKeyDown,
		selectCandidate,
		dismiss: dismissMention,
	} = useMentions(editorRef, value, onChange, mentionConfig);

	const insertMarkdown = useCallback(
		(before: string, after = "", placeholderText = "") => {
			const textarea = editorRef.current;
			if (!textarea) return;
			const start = textarea.selectionStart;
			const end = textarea.selectionEnd;
			const selected = value.slice(start, end);
			const text = selected || placeholderText;
			const newValue = `${value.slice(0, start)}${before}${text}${after}${value.slice(end)}`;
			onChange(newValue);
			requestAnimationFrame(() => {
				textarea.focus();
				const cursorStart = start + before.length;
				textarea.setSelectionRange(cursorStart, cursorStart + text.length);
			});
		},
		[value, onChange, editorRef],
	);

	const insertAtCaret = useCallback(
		(snippet: string) => {
			const textarea = editorRef.current;
			if (!textarea) return;
			const start = textarea.selectionStart;
			const end = textarea.selectionEnd;
			onChange((prev) => `${prev.slice(0, start)}${snippet}${prev.slice(end)}`);
			requestAnimationFrame(() => {
				textarea.focus();
				const pos = start + snippet.length;
				textarea.setSelectionRange(pos, pos);
			});
		},
		[onChange, editorRef],
	);

	const replaceUploadPlaceholder = useCallback(
		(id: string, replacement: string) => {
			const needle = getCommentMediaUploadPlaceholderText(id);
			onChange((prev) => {
				if (!prev.includes(needle)) return prev;
				return prev.replace(needle, replacement);
			});
		},
		[onChange],
	);

	useImperativeHandle(
		ref,
		() => ({ insertAtCaret, replaceUploadPlaceholder }),
		[insertAtCaret, replaceUploadPlaceholder],
	);

	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLTextAreaElement>) => {
			// Mention dropdown takes priority
			if (handleMentionKeyDown(event)) return;

			const mod = event.metaKey || event.ctrlKey;
			if (mod) {
				const shortcuts: Record<string, () => void> = {
					b: () => insertMarkdown("**", "**", "bold"),
					i: () => insertMarkdown("_", "_", "italic"),
					e: () => insertMarkdown("`", "`", "code"),
					k: () => insertMarkdown("[", "](url)", "text"),
					h: () => insertMarkdown("### ", "", "heading"),
				};
				const shiftShortcuts: Record<string, () => void> = {
					".": () => insertMarkdown("> ", "", "quote"),
					"8": () => insertMarkdown("- ", "", "item"),
					"7": () => insertMarkdown("1. ", "", "item"),
				};

				const key = event.key.toLowerCase();
				const action = event.shiftKey ? shiftShortcuts[key] : shortcuts[key];

				if (action) {
					event.preventDefault();
					action();
					return;
				}
			}
			externalOnKeyDown?.(event);
		},
		[handleMentionKeyDown, insertMarkdown, externalOnKeyDown],
	);

	const handleChange = useCallback(
		(newValue: string) => {
			onChange(newValue);
		},
		[onChange],
	);

	// Detect mentions after value or cursor changes
	// biome-ignore lint/correctness/useExhaustiveDependencies: value triggers re-detection of @mentions on text change
	useEffect(() => {
		if (tab === "write" && mentionConfig) {
			detectMention();
		}
	}, [value, tab, mentionConfig, detectMention]);

	const rootProps = mediaUpload?.rootProps;
	const rootClassName = cn(
		"flex flex-col rounded-lg border bg-surface-0 overflow-hidden",
		mediaUpload?.isDragActive && "ring-2 ring-primary/45 ring-inset",
		rootProps?.className,
	);

	return (
		<div
			{...(rootProps ?? {})}
			className={cn(rootClassName, mediaUpload && "relative")}
		>
			{mediaUpload ? (
				<input
					{...mediaUpload.inputProps}
					className="sr-only"
					aria-label="Attach images or videos"
				/>
			) : null}
			{/* Tabs + Toolbar */}
			<div className="flex items-center justify-between border-b px-2 py-1.5 bg-surface-1">
				<div className="flex items-center gap-0.5">
					<button
						type="button"
						onClick={() => setTab("write")}
						className={cn(
							"rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
							tab === "write"
								? "bg-surface-2 text-foreground"
								: "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
						)}
					>
						Write
					</button>
					<button
						type="button"
						onClick={() => setTab("preview")}
						className={cn(
							"rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
							tab === "preview"
								? "bg-surface-2 text-foreground"
								: "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
						)}
					>
						Preview
					</button>
				</div>

				<TooltipProvider delayDuration={300}>
					<div
						className={cn(
							"flex items-center gap-0.5 text-muted-foreground",
							tab !== "write" && "invisible",
						)}
					>
						<MdToolbarButton
							label="Heading"
							shortcut="⌘H"
							onClick={() => insertMarkdown("### ", "", "heading")}
						>
							<path d="M4 12h8M4 4v16M12 4v16M20 8v8" />
						</MdToolbarButton>
						<MdToolbarButton
							label="Bold"
							shortcut="⌘B"
							onClick={() => insertMarkdown("**", "**", "bold")}
						>
							<path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6zM6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
						</MdToolbarButton>
						<MdToolbarButton
							label="Italic"
							shortcut="⌘I"
							onClick={() => insertMarkdown("_", "_", "italic")}
						>
							<path d="M10 4h4M8 20h4M15 4l-6 16" />
						</MdToolbarButton>
						<span className="mx-1 h-4 w-px bg-border" />
						<MdToolbarButton
							label="Code"
							shortcut="⌘E"
							onClick={() => insertMarkdown("`", "`", "code")}
						>
							<path d="M16 18l6-6-6-6M8 6l-6 6 6 6" />
						</MdToolbarButton>
						<MdToolbarButton
							label="Link"
							shortcut="⌘K"
							onClick={() => insertMarkdown("[", "](url)", "text")}
						>
							<path d="M10 14a3.5 3.5 0 0 0 5 0l4-4a3.5 3.5 0 0 0-5-5l-.5.5" />
							<path d="M14 10a3.5 3.5 0 0 0-5 0l-4 4a3.5 3.5 0 0 0 5 5l.5-.5" />
						</MdToolbarButton>
						{mediaUpload ? (
							<MdToolbarButton
								label="Attach images or videos"
								onClick={mediaUpload.onToolbarAttach}
							>
								<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
							</MdToolbarButton>
						) : null}
						<MdToolbarButton
							label="Quote"
							shortcut="⌘⇧."
							onClick={() => insertMarkdown("> ", "", "quote")}
						>
							<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z" />
							<path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" />
						</MdToolbarButton>
						<span className="mx-1 h-4 w-px bg-border" />
						<MdToolbarButton
							label="Unordered list"
							shortcut="⌘⇧8"
							onClick={() => insertMarkdown("- ", "", "item")}
						>
							<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
						</MdToolbarButton>
						<MdToolbarButton
							label="Ordered list"
							shortcut="⌘⇧7"
							onClick={() => insertMarkdown("1. ", "", "item")}
						>
							<path d="M10 6h11M10 12h11M10 18h11M4 6h1v4M3 10h3M4 14.5a.5.5 0 0 1 .5-.5H5a.5.5 0 0 1 .5.5v0a1.5 1.5 0 0 1-1.5 1.5H3.5a.5.5 0 0 0-.5.5v0a.5.5 0 0 0 .5.5H5a.5.5 0 0 1 .5.5v0a1.5 1.5 0 0 1-1.5 1.5H3" />
						</MdToolbarButton>
						<MdToolbarButton
							label="Task list"
							onClick={() => insertMarkdown("- [ ] ", "", "task")}
						>
							<path d="M9 11l3 3L22 4" />
							<path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
						</MdToolbarButton>
					</div>
				</TooltipProvider>
			</div>

			{/* Editor / Preview */}
			{tab === "write" ? (
				<div className="relative">
					{compact ? (
						<CompactWriteSurface
							editorRef={editorRef}
							scrollAnchorRef={scrollAnchorRef}
							value={value}
							onChange={handleChange}
							onKeyDown={handleKeyDown}
							onPaste={onPaste}
							placeholder={placeholder}
						/>
					) : (
						<HighlightedMarkdownEditor
							value={value}
							onChange={handleChange}
							placeholder={placeholder}
							scrollAnchorRef={scrollAnchorRef}
							textareaRef={editorRef}
							onKeyDown={handleKeyDown}
							onPaste={onPaste}
						/>
					)}
					{mentionState && dropdownPos && (
						<MentionDropdown
							candidates={filtered}
							activeIndex={activeIndex}
							isLoading={mentionLoading}
							position={dropdownPos}
							onSelect={selectCandidate}
							onDismiss={dismissMention}
						/>
					)}
				</div>
			) : (
				<div className={cn("p-4", compact ? "min-h-[120px]" : "min-h-[200px]")}>
					{value ? (
						<Markdown>{value}</Markdown>
					) : (
						<p className="text-sm italic text-muted-foreground">
							Nothing to preview
						</p>
					)}
				</div>
			)}
		</div>
	);
});

// ── Mention dropdown ──────────────────────────────────────────────

function MentionDropdown({
	candidates,
	activeIndex,
	isLoading,
	position,
	onSelect,
	onDismiss,
}: {
	candidates: MentionCandidate[];
	activeIndex: number;
	isLoading: boolean;
	position: { top: number; left: number };
	onSelect: (candidate: MentionCandidate) => void;
	onDismiss: () => void;
}) {
	const listRef = useRef<HTMLDivElement>(null);

	// Scroll active item into view
	useEffect(() => {
		const list = listRef.current;
		if (!list) return;
		const item = list.children[activeIndex] as HTMLElement | undefined;
		item?.scrollIntoView({ block: "nearest" });
	}, [activeIndex]);

	// Dismiss on outside click
	useEffect(() => {
		const handleClick = (e: MouseEvent) => {
			if (listRef.current && !listRef.current.contains(e.target as Node)) {
				onDismiss();
			}
		};
		document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, [onDismiss]);

	const isEmpty = candidates.length === 0 && !isLoading;

	return createPortal(
		<div
			ref={listRef}
			className="fixed z-50 max-h-48 min-w-[200px] overflow-y-auto rounded-lg border bg-surface-0 py-1 shadow-lg"
			style={{ top: position.top, left: position.left }}
		>
			{isLoading && candidates.length === 0 && (
				<div className="flex items-center justify-center px-3 py-2">
					<Spinner size={14} className="text-muted-foreground" />
				</div>
			)}
			{isEmpty && (
				<div className="px-3 py-2 text-xs text-muted-foreground">
					No users found
				</div>
			)}
			{candidates.map((candidate, index) => (
				<button
					key={candidate.id}
					type="button"
					onMouseDown={(e) => {
						e.preventDefault();
						onSelect(candidate);
					}}
					className={cn(
						"flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors",
						index === activeIndex
							? "bg-surface-2 text-foreground"
							: "text-muted-foreground hover:bg-surface-1 hover:text-foreground",
					)}
				>
					{candidate.avatarUrl ? (
						<img
							src={candidate.avatarUrl}
							alt={candidate.label}
							className="size-4 rounded-full"
						/>
					) : (
						<div className="size-4 rounded-full bg-surface-2" />
					)}
					<span className="truncate">{candidate.label}</span>
					{candidate.secondary && (
						<span className="ml-auto shrink-0 text-xs text-muted-foreground">
							{candidate.secondary}
						</span>
					)}
				</button>
			))}
		</div>,
		document.body,
	);
}

// ── Toolbar button ─────────────────────────────────────────────────

function MdToolbarButton({
	label,
	shortcut,
	onClick,
	children,
}: {
	label: string;
	shortcut?: string;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					type="button"
					onClick={onClick}
					className="flex size-7 items-center justify-center rounded-md transition-colors hover:bg-surface-1 hover:text-foreground"
				>
					<svg
						aria-hidden="true"
						fill="none"
						height={15}
						stroke="currentColor"
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						viewBox="0 0 24 24"
						width={15}
					>
						{children}
					</svg>
				</button>
			</TooltipTrigger>
			<TooltipContent>
				<span className="flex items-center gap-1.5">
					{label}
					{shortcut && (
						<kbd className="rounded bg-foreground/10 px-1 font-mono text-[10px]">
							{shortcut}
						</kbd>
					)}
				</span>
			</TooltipContent>
		</Tooltip>
	);
}

// ── Highlighted editor (full mode) ────────────────────────────────

function HighlightedMarkdownEditor({
	value,
	onChange,
	placeholder,
	textareaRef: externalRef,
	scrollAnchorRef,
	onKeyDown,
	onPaste,
}: {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
	scrollAnchorRef?: React.RefObject<HTMLElement | null>;
	onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
	onPaste?: React.ClipboardEventHandler<HTMLTextAreaElement>;
}) {
	const [highlightedHtml, setHighlightedHtml] = useState("");
	const internalRef = useRef<HTMLTextAreaElement>(null);
	const textareaRef = externalRef || internalRef;
	const highlightRef = useRef<HTMLDivElement>(null);

	const fullContentSizingOpts = useMemo(
		() => ({
			minHeightPx: 640,
			maxHeightPx: 1200,
		}),
		[],
	);

	const fullContentSizing = useTextareaContentFieldSizing(
		value,
		textareaRef,
		fullContentSizingOpts,
		scrollAnchorRef,
	);

	useEffect(() => {
		let cancelled = false;
		if (!value) {
			setHighlightedHtml("");
			return;
		}
		highlightCode(value, "markdown").then((html) => {
			if (!cancelled) {
				setHighlightedHtml(html);
			}
		});
		return () => {
			cancelled = true;
		};
	}, [value]);

	const syncScroll = () => {
		if (highlightRef.current && textareaRef.current) {
			highlightRef.current.scrollTop = textareaRef.current.scrollTop;
			highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
		}
	};

	return (
		<div className="relative w-full min-h-[640px]">
			<div
				ref={highlightRef}
				aria-hidden
				className="pointer-events-none absolute inset-0 overflow-auto whitespace-pre-wrap break-words p-5 [scrollbar-width:none] [word-break:break-all] [&::-webkit-scrollbar]:hidden [&_pre]:!m-0 [&_pre]:!bg-transparent [&_pre]:!p-0 [&_pre]:!whitespace-pre-wrap [&_pre]:!break-words [&_pre]:font-mono [&_pre]:text-sm [&_pre]:!leading-[1.625] [&_code]:!font-mono [&_code]:!text-sm [&_code]:!leading-[1.625]"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: HTML from shiki highlighter is trusted
				dangerouslySetInnerHTML={{ __html: highlightedHtml }}
			/>
			<textarea
				ref={textareaRef}
				value={value}
				onChange={(event) => onChange(event.target.value)}
				onKeyDown={onKeyDown}
				onPaste={onPaste}
				onPointerDown={fullContentSizing.onPointerDown}
				onScroll={syncScroll}
				style={fullContentSizing.heightStyle}
				className={cn(
					"relative box-border min-h-[640px] max-h-[1200px] w-full resize-y overflow-y-auto whitespace-pre-wrap break-words bg-transparent p-5 font-mono text-sm leading-[1.625] text-transparent caret-foreground outline-none [word-break:break-all] placeholder:text-muted-foreground",
					fullContentSizing.sizingClassName,
				)}
				placeholder={placeholder}
				spellCheck={false}
			/>
		</div>
	);
}
