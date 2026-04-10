import {
	CheckIcon,
	CopyIcon,
	EditIcon,
	MoreHorizontalIcon,
} from "@diffkit/icons";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@diffkit/ui/components/dropdown-menu";
import { highlightCode, Markdown } from "@diffkit/ui/components/markdown";
import { Spinner } from "@diffkit/ui/components/spinner";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@diffkit/ui/components/tooltip";
import { cn } from "@diffkit/ui/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";
import { updatePullBody } from "#/lib/github.functions";
import { type GitHubQueryScope, githubQueryKeys } from "#/lib/github.query";
import type { PullDetail, PullPageData } from "#/lib/github.types";
import { matchesShortcut } from "#/lib/shortcuts";
import { useOptimisticMutation } from "#/lib/use-optimistic-mutation";

export function PullBodySection({
	pr,
	owner,
	repo,
	pullNumber,
	isAuthor,
	scope,
}: {
	pr: PullDetail;
	owner: string;
	repo: string;
	pullNumber: number;
	isAuthor: boolean;
	scope: GitHubQueryScope;
}) {
	const { mutate } = useOptimisticMutation();
	const [isEditing, setIsEditing] = useState(false);
	const [editTab, setEditTab] = useState<"edit" | "preview">("edit");
	const [draft, setDraft] = useState(pr.body);
	const [isSaving, setIsSaving] = useState(false);
	const editorRef = useRef<HTMLTextAreaElement>(null);

	const insertMarkdown = useCallback(
		(before: string, after = "", placeholder = "") => {
			const textarea = editorRef.current;
			if (!textarea) return;
			const start = textarea.selectionStart;
			const end = textarea.selectionEnd;
			const selected = draft.slice(start, end);
			const text = selected || placeholder;
			const newValue = `${draft.slice(0, start)}${before}${text}${after}${draft.slice(end)}`;
			setDraft(newValue);
			requestAnimationFrame(() => {
				textarea.focus();
				const cursorStart = start + before.length;
				textarea.setSelectionRange(cursorStart, cursorStart + text.length);
			});
		},
		[draft],
	);

	const handleEditorKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLTextAreaElement>) => {
			const action = [
				{
					shortcut: { key: "b", mod: true },
					run: () => insertMarkdown("**", "**", "bold"),
				},
				{
					shortcut: { key: "i", mod: true },
					run: () => insertMarkdown("_", "_", "italic"),
				},
				{
					shortcut: { key: "e", mod: true },
					run: () => insertMarkdown("`", "`", "code"),
				},
				{
					shortcut: { key: "k", mod: true },
					run: () => insertMarkdown("[", "](url)", "text"),
				},
				{
					shortcut: { key: "h", mod: true },
					run: () => insertMarkdown("### ", "", "heading"),
				},
				{
					shortcut: { key: ".", mod: true, shift: true },
					run: () => insertMarkdown("> ", "", "quote"),
				},
				{
					shortcut: { key: "8", mod: true, shift: true },
					run: () => insertMarkdown("- ", "", "item"),
				},
				{
					shortcut: { key: "7", mod: true, shift: true },
					run: () => insertMarkdown("1. ", "", "item"),
				},
			].find(({ shortcut }) => matchesShortcut(event, shortcut));

			if (!action) {
				return;
			}

			event.preventDefault();
			action.run();
		},
		[insertMarkdown],
	);

	const pageQueryKey = githubQueryKeys.pulls.page(scope, {
		owner,
		repo,
		pullNumber,
	});

	const startEditing = () => {
		setDraft(pr.body);
		setEditTab("edit");
		setIsEditing(true);
	};

	const saveBody = async () => {
		setIsSaving(true);
		try {
			await mutate({
				mutationFn: () =>
					updatePullBody({
						data: { owner, repo, pullNumber, body: draft },
					}),
				updates: [
					{
						queryKey: pageQueryKey,
						updater: (prev: PullPageData) => ({
							...prev,
							detail: prev.detail
								? { ...prev.detail, body: draft }
								: prev.detail,
						}),
					},
				],
			});
			setIsEditing(false);
		} finally {
			setIsSaving(false);
		}
	};

	if (isEditing) {
		return (
			<div className="flex flex-col gap-2">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-0.5">
						<button
							type="button"
							onClick={() => setEditTab("edit")}
							className={cn(
								"rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
								editTab === "edit"
									? "bg-surface-1 text-foreground"
									: "text-muted-foreground hover:bg-surface-1 hover:text-foreground",
							)}
						>
							Edit
						</button>
						<button
							type="button"
							onClick={() => setEditTab("preview")}
							className={cn(
								"rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
								editTab === "preview"
									? "bg-surface-1 text-foreground"
									: "text-muted-foreground hover:bg-surface-1 hover:text-foreground",
							)}
						>
							Preview
						</button>
					</div>
					{editTab === "edit" && (
						<TooltipProvider delayDuration={300}>
							<div className="flex items-center gap-0.5 text-muted-foreground">
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
					)}
				</div>
				<div className="rounded-lg border bg-surface-0">
					{editTab === "edit" ? (
						<HighlightedMarkdownEditor
							value={draft}
							onChange={setDraft}
							placeholder="Write a description..."
							textareaRef={editorRef}
							onKeyDown={handleEditorKeyDown}
						/>
					) : (
						<div className="min-h-[200px] p-5">
							{draft ? (
								<Markdown>{draft}</Markdown>
							) : (
								<p className="text-sm italic text-muted-foreground">
									Nothing to preview
								</p>
							)}
						</div>
					)}
				</div>
				<div className="flex items-center justify-end gap-2 pt-2">
					<button
						type="button"
						onClick={() => setIsEditing(false)}
						disabled={isSaving}
						className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={saveBody}
						disabled={isSaving}
						className="flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
					>
						{isSaving ? (
							<Spinner size={13} />
						) : (
							<CheckIcon size={13} strokeWidth={2.5} />
						)}
						{isSaving ? "Saving..." : "Save"}
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="relative rounded-lg border bg-surface-0 p-5">
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-1 hover:text-foreground"
					>
						<MoreHorizontalIcon size={15} strokeWidth={2} />
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-44">
					{pr.body && (
						<DropdownMenuItem
							onSelect={() => {
								void navigator.clipboard.writeText(pr.body);
							}}
						>
							<CopyIcon size={14} strokeWidth={2} />
							Copy as Markdown
						</DropdownMenuItem>
					)}
					{isAuthor && (
						<DropdownMenuItem onSelect={startEditing}>
							<EditIcon size={14} strokeWidth={2} />
							Edit
						</DropdownMenuItem>
					)}
				</DropdownMenuContent>
			</DropdownMenu>
			{pr.body ? (
				<Markdown>{pr.body}</Markdown>
			) : (
				<p className="text-sm italic text-muted-foreground">
					No description provided.
				</p>
			)}
		</div>
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

function HighlightedMarkdownEditor({
	value,
	onChange,
	placeholder,
	textareaRef: externalRef,
	onKeyDown,
}: {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
	onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
}) {
	const [highlightedHtml, setHighlightedHtml] = useState("");
	const internalRef = useRef<HTMLTextAreaElement>(null);
	const textareaRef = externalRef || internalRef;
	const highlightRef = useRef<HTMLDivElement>(null);

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
		<div className="relative" style={{ height: 640, maxHeight: 1200 }}>
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
				onScroll={syncScroll}
				className="relative w-full resize-y whitespace-pre-wrap break-words bg-transparent p-5 font-mono text-sm leading-[1.625] text-transparent caret-foreground outline-none [word-break:break-all] placeholder:text-muted-foreground"
				style={{ height: 640, maxHeight: 1200 }}
				placeholder={placeholder}
				spellCheck={false}
			/>
		</div>
	);
}
