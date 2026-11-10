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
import { useKeyboardFocus } from "../hooks/use-keyboard-focus";
import { useTextareaContentFieldSizing } from "../hooks/use-textarea-content-field-sizing";
import { getCaretCoordinates } from "../lib/get-caret-coordinates";
import { cn } from "../lib/utils";
import { highlightCode, Markdown } from "./markdown";
import {
	getCommentMediaUploadPlaceholderText,
	replaceCommentMediaUploadPlaceholder,
} from "./markdown-editor-upload";
import { Spinner } from "./spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

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

export type MarkdownEditorHandle = {
	insertAtCaret: (snippet: string) => void;
	replaceUploadPlaceholder: (id: string, replacement: string) => void;
};

export { getCommentMediaUploadPlaceholderText };

export type MarkdownEditorMediaUpload = {
	isDragActive: boolean;
	rootProps: React.HTMLAttributes<HTMLDivElement>;
	inputProps: React.InputHTMLAttributes<HTMLInputElement>;
	onToolbarAttach: () => void;
};

type FocusHandlers = ReturnType<typeof useKeyboardFocus>[1];

type MarkdownEditorProps = {
	value: string;
	onChange: Dispatch<SetStateAction<string>>;
	placeholder?: string;
	compact?: boolean;
	onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
	onPaste?: React.ClipboardEventHandler<HTMLTextAreaElement>;
	textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
	mentions?: MentionConfig;
	media?: MarkdownEditorMediaUpload;
	scrollAnchorRef?: React.RefObject<HTMLElement | null>;
	footer?: React.ReactNode;
	/** Lays a compact composer out as one row: the field, then its footer. */
	inline?: boolean;
	/** Drops the editor's own card so it can sit inside another surface. */
	bare?: boolean;
};

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
		if (!(mentionState && config)) {
			return [];
		}
		const q = mentionState.query.toLowerCase();
		return config.candidates.filter((c) => c.label.toLowerCase().includes(q));
	}, [mentionState, config]);

	const detectMention = useCallback(() => {
		const textarea = editorRef.current;
		if (!(textarea && config)) {
			return;
		}

		const cursor = textarea.selectionStart;
		const text = value.slice(0, cursor);

		let triggerIdx = -1;
		for (let i = text.length - 1; i >= 0; i--) {
			const ch = text[i];
			if (ch === "@") {
				if (i === 0 || /\s/.test(text[i - 1])) {
					triggerIdx = i;
				}
				break;
			}
			if (/\s/.test(ch)) {
				break;
			}
		}

		if (triggerIdx === -1) {
			setMentionState(null);
			return;
		}

		const query = text.slice(triggerIdx + 1);
		setMentionState({ query, triggerIndex: triggerIdx });
		setActiveIndex(0);

		if (!activatedRef.current) {
			activatedRef.current = true;
			config.onActivate?.();
		}

		const coords = getCaretCoordinates(textarea, cursor);
		const rect = textarea.getBoundingClientRect();
		setDropdownPos({
			top: rect.top + coords.top + 20,
			left: rect.left + coords.left,
		});
	}, [editorRef, value, config]);

	const selectCandidate = useCallback(
		(candidate: MentionCandidate) => {
			if (!mentionState) {
				return;
			}
			const textarea = editorRef.current;
			if (!textarea) {
				return;
			}

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
			if (!mentionState || filtered.length === 0) {
				return false;
			}

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

function CompactWriteSurface({
	value,
	onChange,
	editorRef,
	onKeyDown,
	onPaste,
	placeholder,
	scrollAnchorRef,
	inline,
	focusHandlers,
}: {
	value: string;
	onChange: (next: string) => void;
	editorRef: React.RefObject<HTMLTextAreaElement | null>;
	onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement>;
	onPaste?: React.ClipboardEventHandler<HTMLTextAreaElement>;
	placeholder: string;
	scrollAnchorRef?: React.RefObject<HTMLElement | null>;
	inline: boolean;
	focusHandlers: FocusHandlers;
}) {
	const contentSizingOpts = useMemo(
		() => ({
			minHeightPx: 24,
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
			className={cn(
				"max-h-[min(85vh,40rem)] min-h-6 w-full resize-none overflow-y-auto bg-transparent font-[450] text-[15px] text-text-strong leading-6 outline-none placeholder:font-normal placeholder:text-composer-placeholder focus-visible:outline-none",
				inline ? "block py-2.5 pr-2 pl-4" : "px-4 pt-3 pb-1",
				contentSizing.sizingClassName,
			)}
			{...focusHandlers}
			onChange={(event) => onChange(event.target.value)}
			onKeyDown={onKeyDown}
			onPaste={onPaste}
			onPointerDown={contentSizing.onPointerDown}
			placeholder={placeholder}
			ref={editorRef}
			rows={1}
			style={contentSizing.heightStyle}
			value={value}
		/>
	);
}

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
		footer,
		inline,
		bare,
	},
	ref,
) {
	const [tab, setTab] = useState<"write" | "preview">("write");
	const [keyboardFocused, focusHandlers] = useKeyboardFocus();
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
			if (!textarea) {
				return;
			}
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
			if (!textarea) {
				return;
			}
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
			onChange((prev) =>
				replaceCommentMediaUploadPlaceholder(prev, id, replacement),
			);
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
			if (handleMentionKeyDown(event)) {
				return;
			}

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

	// biome-ignore lint/correctness/useExhaustiveDependencies: value triggers re-detection of @mentions on text change
	useEffect(() => {
		if (tab === "write" && mentionConfig) {
			detectMention();
		}
	}, [value, tab, mentionConfig, detectMention]);

	const rootProps = mediaUpload?.rootProps;
	const footerAttach = compact ? mediaUpload : undefined;
	const isInline = Boolean(compact && inline);
	const rootClassName = cn(
		"flex transition-[box-shadow]",
		isInline ? "items-end" : "flex-col",
		compact && !isInline && "min-h-[82px]",
		!bare &&
			"overflow-hidden rounded-lg bg-card data-keyboard-focus:shadow-[0_0_0_1px_var(--ln-focus),var(--ln-main-shadow)]",
		!bare &&
			(compact
				? "border-[0.5px] border-border shadow-[var(--ln-main-shadow)]"
				: "shadow-card"),
		mediaUpload?.isDragActive && "ring-1 ring-focus ring-inset",
		rootProps?.className,
	);

	return (
		<div
			{...(rootProps ?? {})}
			className={cn(rootClassName, mediaUpload && "relative")}
			data-keyboard-focus={keyboardFocused ? "" : undefined}
		>
			{mediaUpload ? (
				<input
					{...mediaUpload.inputProps}
					aria-label="Attach images or videos"
					className="sr-only"
				/>
			) : null}
			{/* Comment composers stay bare; shortcuts still format. */}
			{compact ? null : (
				<div className="flex items-center justify-between px-2 pt-2">
					<div className="flex items-center gap-0.5">
						<button
							className={cn(
								"flex h-6 items-center rounded-md px-2.5 font-medium text-xs transition-colors",
								tab === "write"
									? "bg-tab-selected text-foreground shadow-tab-selected"
									: "text-muted-foreground hover:text-foreground",
							)}
							onClick={() => {
								setTab("write");
								requestAnimationFrame(() => editorRef.current?.focus());
							}}
							type="button"
						>
							Write
						</button>
						<button
							className={cn(
								"flex h-6 items-center rounded-md px-2.5 font-medium text-xs transition-colors",
								tab === "preview"
									? "bg-tab-selected text-foreground shadow-tab-selected"
									: "text-muted-foreground hover:text-foreground",
							)}
							onClick={() => setTab("preview")}
							type="button"
						>
							Preview
						</button>
					</div>

					<div
						className={cn(
							"flex items-center gap-0.5 text-muted-foreground",
							tab !== "write" && "invisible",
						)}
					>
						<MdToolbarButton
							label="Heading"
							onClick={() => insertMarkdown("### ", "", "heading")}
							shortcut="⌘H"
						>
							<path d="M4 12h8M4 4v16M12 4v16M20 8v8" />
						</MdToolbarButton>
						<MdToolbarButton
							label="Bold"
							onClick={() => insertMarkdown("**", "**", "bold")}
							shortcut="⌘B"
						>
							<path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6zM6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
						</MdToolbarButton>
						<MdToolbarButton
							label="Italic"
							onClick={() => insertMarkdown("_", "_", "italic")}
							shortcut="⌘I"
						>
							<path d="M10 4h4M8 20h4M15 4l-6 16" />
						</MdToolbarButton>
						<span aria-hidden className="mx-1 h-3.5 w-px bg-header-rule" />
						<MdToolbarButton
							label="Code"
							onClick={() => insertMarkdown("`", "`", "code")}
							shortcut="⌘E"
						>
							<path d="M16 18l6-6-6-6M8 6l-6 6 6 6" />
						</MdToolbarButton>
						<MdToolbarButton
							label="Link"
							onClick={() => insertMarkdown("[", "](url)", "text")}
							shortcut="⌘K"
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
							onClick={() => insertMarkdown("> ", "", "quote")}
							shortcut="⌘⇧."
						>
							<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z" />
							<path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" />
						</MdToolbarButton>
						<span aria-hidden className="mx-1 h-3.5 w-px bg-header-rule" />
						<MdToolbarButton
							label="Unordered list"
							onClick={() => insertMarkdown("- ", "", "item")}
							shortcut="⌘⇧8"
						>
							<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
						</MdToolbarButton>
						<MdToolbarButton
							label="Ordered list"
							onClick={() => insertMarkdown("1. ", "", "item")}
							shortcut="⌘⇧7"
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
				</div>
			)}

			{/* Editor / Preview */}
			{tab === "write" ? (
				<div className={cn("relative", isInline && "min-w-0 flex-1")}>
					{compact ? (
						<CompactWriteSurface
							editorRef={editorRef}
							onChange={handleChange}
							onKeyDown={handleKeyDown}
							onPaste={onPaste}
							focusHandlers={focusHandlers}
							inline={isInline}
							placeholder={placeholder}
							scrollAnchorRef={scrollAnchorRef}
							value={value}
						/>
					) : (
						<HighlightedMarkdownEditor
							focusHandlers={focusHandlers}
							onChange={handleChange}
							onKeyDown={handleKeyDown}
							onPaste={onPaste}
							placeholder={placeholder}
							scrollAnchorRef={scrollAnchorRef}
							textareaRef={editorRef}
							value={value}
						/>
					)}
					{mentionState && dropdownPos && (
						<MentionDropdown
							activeIndex={activeIndex}
							candidates={filtered}
							isLoading={mentionLoading}
							onDismiss={dismissMention}
							onSelect={selectCandidate}
							position={dropdownPos}
						/>
					)}
				</div>
			) : (
				<div className="min-h-[200px] px-4 py-3">
					{value ? (
						<Markdown className="text-[15px] text-text-strong leading-6">
							{value}
						</Markdown>
					) : (
						<p className="text-[13px] text-muted-foreground">
							Nothing to preview
						</p>
					)}
				</div>
			)}
			{footer || footerAttach ? (
				<div
					className={cn(
						"mt-auto flex items-center justify-end gap-2",
						isInline
							? "shrink-0 pr-2.5 pb-2.5"
							: compact
								? "pt-1 pr-3.5 pb-3 pl-2.5"
								: "px-3 pt-1 pb-3",
					)}
				>
					{footerAttach ? (
						<span className="mr-auto flex text-muted-foreground">
							<MdToolbarButton
								label="Attach images or videos"
								onClick={footerAttach.onToolbarAttach}
							>
								<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
							</MdToolbarButton>
						</span>
					) : null}
					{footer}
				</div>
			) : null}
		</div>
	);
});

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

	useEffect(() => {
		const list = listRef.current;
		if (!list) {
			return;
		}
		const item = list.children[activeIndex] as HTMLElement | undefined;
		item?.scrollIntoView({ block: "nearest" });
	}, [activeIndex]);

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
			className="fixed z-50 max-h-56 min-w-[206px] overflow-y-auto rounded-xl bg-popover p-1 shadow-popover"
			ref={listRef}
			style={{ top: position.top, left: position.left }}
		>
			{isLoading && candidates.length === 0 && (
				<div className="flex items-center justify-center px-3 py-2">
					<Spinner className="text-muted-foreground" size={14} />
				</div>
			)}
			{isEmpty && (
				<div className="px-3 py-2 text-muted-foreground text-xs">
					No users found
				</div>
			)}
			{candidates.map((candidate, index) => (
				<button
					className={cn(
						"flex h-8 w-full items-center gap-2 rounded-lg pr-2.5 pl-[7.75px] text-left font-[450] text-[13px] transition-colors",
						index === activeIndex
							? "bg-menu-hover text-foreground"
							: "text-text-header hover:bg-menu-hover hover:text-foreground",
					)}
					key={candidate.id}
					onMouseDown={(e) => {
						e.preventDefault();
						onSelect(candidate);
					}}
					type="button"
				>
					{candidate.avatarUrl ? (
						<img
							alt={candidate.label}
							className="size-4 rounded-full ring-[0.5px] ring-chip-border"
							src={candidate.avatarUrl}
						/>
					) : (
						<div className="size-4 rounded-full bg-group" />
					)}
					<span className="truncate">{candidate.label}</span>
					{candidate.secondary && (
						<span className="ml-auto shrink-0 text-muted-foreground text-xs">
							{candidate.secondary}
						</span>
					)}
				</button>
			))}
		</div>,
		document.body,
	);
}

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
					className="flex size-6 items-center justify-center rounded-md transition-colors hover:bg-ghost-hover hover:text-foreground"
					onClick={onClick}
					onMouseDown={(e) => e.preventDefault()}
					type="button"
				>
					<svg
						aria-hidden="true"
						fill="none"
						height={14}
						stroke="currentColor"
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						viewBox="0 0 24 24"
						width={14}
					>
						{children}
					</svg>
				</button>
			</TooltipTrigger>
			<TooltipContent keys={shortcut ? [...shortcut] : undefined}>
				{label}
			</TooltipContent>
		</Tooltip>
	);
}

function HighlightedMarkdownEditor({
	value,
	onChange,
	placeholder,
	textareaRef: externalRef,
	scrollAnchorRef,
	onKeyDown,
	onPaste,
	focusHandlers,
}: {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
	scrollAnchorRef?: React.RefObject<HTMLElement | null>;
	onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
	onPaste?: React.ClipboardEventHandler<HTMLTextAreaElement>;
	focusHandlers: FocusHandlers;
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
		<div className="relative min-h-[640px] w-full">
			<div
				aria-hidden
				className="[&_pre]:!m-0 [&_pre]:!bg-transparent [&_pre]:!p-0 [&_pre]:!whitespace-pre-wrap [&_pre]:!break-words [&_pre]:!leading-[1.625] [&_code]:!font-mono [&_code]:!text-sm [&_code]:!leading-[1.625] pointer-events-none absolute inset-0 overflow-auto whitespace-pre-wrap break-words p-5 [scrollbar-width:none] [word-break:break-all] [&::-webkit-scrollbar]:hidden [&_pre]:font-mono [&_pre]:text-sm"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: HTML from shiki highlighter is trusted
				dangerouslySetInnerHTML={{ __html: highlightedHtml }}
				ref={highlightRef}
			/>
			<textarea
				className={cn(
					"relative box-border max-h-[1200px] min-h-[640px] w-full resize-y overflow-y-auto whitespace-pre-wrap break-words bg-transparent p-5 font-mono text-sm text-transparent leading-[1.625] caret-foreground outline-none [word-break:break-all] placeholder:text-muted-foreground",
					fullContentSizing.sizingClassName,
				)}
				{...focusHandlers}
				onChange={(event) => onChange(event.target.value)}
				onKeyDown={onKeyDown}
				onPaste={onPaste}
				onPointerDown={fullContentSizing.onPointerDown}
				onScroll={syncScroll}
				placeholder={placeholder}
				ref={textareaRef}
				spellCheck={false}
				style={fullContentSizing.heightStyle}
				value={value}
			/>
		</div>
	);
}
