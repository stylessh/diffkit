import {
	CheckIcon,
	ChevronDownIcon,
	ChevronUpIcon,
	CommentIcon,
	CopyIcon,
	EditIcon,
	MoreHorizontalIcon,
} from "@diffkit/icons";
import { LineCounts } from "@diffkit/ui/components/detail-layout";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@diffkit/ui/components/dropdown-menu";
import { Markdown } from "@diffkit/ui/components/markdown";
import {
	MarkdownEditor,
	type MentionConfig,
} from "@diffkit/ui/components/markdown-editor";
import { PageIconButton } from "@diffkit/ui/components/page-header";
import { toast } from "@diffkit/ui/components/sonner";
import { Spinner } from "@diffkit/ui/components/spinner";
import { quickhubDark, quickhubLight } from "@diffkit/ui/lib/diffs-themes";
import { shikiBundledLangSet } from "@diffkit/ui/lib/shiki-bundle";
import { cn } from "@diffkit/ui/lib/utils";
import type { SelectedLineRange } from "@pierre/diffs";
import type { DiffLineAnnotation, PatchDiffProps } from "@pierre/diffs/react";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import {
	type ComponentType,
	type LazyExoticComponent,
	lazy,
	memo,
	Suspense,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { CommentMoreMenu } from "#/components/details/comment-more-menu";
import { formatRelativeTime } from "#/lib/format-relative-time";
import {
	replyToReviewComment,
	resolveReviewThread,
	unresolveReviewThread,
} from "#/lib/github.functions";
import type { PullFile, PullReviewComment } from "#/lib/github.types";
import {
	invalidateGitHubEntities,
	pullEntityKey,
} from "#/lib/github-query-updates";
import { FileTypeIcon } from "./review-icons";
import type {
	ActiveCommentForm,
	PendingComment,
	ReviewAnnotation,
} from "./review-types";
import { buildPatchString } from "./review-utils";

type ReviewPatchDiffComponent = ComponentType<PatchDiffProps<ReviewAnnotation>>;

const LARGE_PATCH_CHANGE_THRESHOLD = 400;
const LARGE_PATCH_CHAR_THRESHOLD = 24_000;
const DIFF_LINE_HEIGHT = 20;
const DIFF_HUNK_SEPARATOR_HEIGHT = 28;

/**
 * Pierre's diff, restyled after Linear's file card (measured from the
 * reference's Diff tab): 20px rows of 12px mono on the card's own fill, a 50px
 * number column (12px right padding, numbers green/red on changed lines), no
 * change bars or gutter gaps, a calm 28px hunk row, a hairline between split
 * halves, and comment threads on the page fill between hairlines.
 */
const DIFF_UNSAFE_CSS = `
:host {
	--diffs-font-family: 'Geist Mono Variable', 'SF Mono', ui-monospace, 'Cascadia Code', monospace;
	--diffs-header-font-family: 'Inter Variable', 'Inter', ui-sans-serif, system-ui, sans-serif;
	--diffs-light-bg: var(--ln-card);
	--diffs-dark-bg: var(--ln-card);
	--diffs-light: var(--ln-text);
	--diffs-dark: var(--ln-text-header);
	font-weight: 400;
	--diffs-font-features: "liga" 0, "calt" 0;
	--diffs-font-size: 12px;
	--diffs-line-height: 20px;
	--diffs-gap-block: 4px;
	--diffs-gap-inline: 0px;
	--diffs-gap-style: 0 solid transparent;
	--diffs-fg-number-addition-override: var(--ln-success);
	--diffs-fg-number-deletion-override: var(--ln-number-removed);
	--diffs-bg-separator-override: var(--ln-card);
	--diffs-bg-hover-override: var(--ln-row-hover);
	--diffs-bg-context-override: var(--ln-main);
}
[data-code] { padding-block: 4px; }
[data-column-number] {
	box-sizing: border-box;
	min-width: 50px;
	padding: 0 12px 0 0;
}
[data-line-number-content] { min-width: 0; }
[data-line], [data-no-newline] { padding-inline: 0 16px; }
[data-diff-type='split'] [data-deletions] { border-right: 0; }
[data-diff-type='split'][data-overflow='scroll'] [data-additions],
[data-diff-type='split'][data-overflow='wrap'] [data-additions] [data-gutter] {
	border-left: 1px solid var(--ln-card-border);
}
[data-gutter-utility-slot] { align-items: center; }
[data-utility-button] {
	width: 20px;
	height: 20px;
	margin-right: -12px;
	border-radius: 9999px;
	background-color: var(--ln-button);
	color: var(--ln-text-muted);
	box-shadow: var(--ln-button-ring);
}
[data-utility-button]:hover { background-color: var(--ln-button-hover); color: var(--ln-text); }
[data-utility-button] svg { width: 12px; height: 12px; }
[data-content-buffer],
[data-gutter-buffer='buffer'] {
	background-image: none;
	background-color: var(--ln-card);
}
[data-separator='line-info'] {
	height: 28px;
	margin-block: 0;
	background-color: var(--ln-card);
}
[data-separator-wrapper],
[data-separator-content],
[data-expand-button] {
	background-color: transparent;
	border: 0;
	border-radius: 0;
}
[data-separator-content] {
	justify-content: center;
	font-size: 12px;
	font-weight: 500;
	color: var(--ln-text-muted);
	padding-inline: 8px;
}
[data-expand-button] { color: var(--ln-text-muted); }
[data-expand-button]:hover { color: var(--ln-text); }
[data-line-annotation] {
	font-family: var(--diffs-header-font-family);
	font-weight: 450;
	white-space: normal;
	border-block: 0.5px solid var(--ln-card-border);
}
[data-gutter-buffer='annotation'] { border-block: 0.5px solid var(--ln-card-border); }
[data-line-annotation] code { font-family: var(--diffs-font-family, var(--diffs-font-fallback)); }
[data-annotation-content] {
	background-color: transparent;
	/* keep threads in view when long lines scroll the column sideways */
	position: sticky;
	left: var(--diffs-column-number-width, 50px);
	width: var(--diffs-column-content-width, auto);
	box-sizing: border-box;
}
[data-overflow='wrap'] [data-annotation-content] { position: static; width: auto; }
[data-line-annotation], [data-gutter-buffer='annotation'] { --diffs-line-bg: var(--ln-main); }
`;

function estimateDiffHeight(
	patch: string | null | undefined,
	diffStyle: "unified" | "split",
): number {
	if (!patch) return 0;
	const lines = patch.split("\n").length;
	const hunkCount = patch.match(/^@@/gm)?.length ?? 0;
	const effectiveLines =
		diffStyle === "split" ? Math.ceil(lines * 0.75) : lines;
	return (
		effectiveLines * DIFF_LINE_HEIGHT + hunkCount * DIFF_HUNK_SEPARATOR_HEIGHT
	);
}

// Kick off both Pierre chunks as soon as this module evaluates (i.e. when
// ReviewDiffPane loads) so the JS is already parsed by the time the first
// file block enters the viewport — no per-Suspense waterfall.
const patchDiffModulePromise: Promise<{
	default: ReviewPatchDiffComponent;
}> = import.meta.env.SSR
	? Promise.resolve({ default: (() => null) as ReviewPatchDiffComponent })
	: import("@pierre/diffs/react").then((mod) => ({
			default: mod.PatchDiff as ReviewPatchDiffComponent,
		}));

const pierreInitPromise: Promise<void> = import.meta.env.SSR
	? Promise.resolve()
	: import("@pierre/diffs").then(
			({
				registerCustomTheme,
				EXTENSION_TO_FILE_FORMAT,
				extendFileFormatMap,
			}) => {
				registerCustomTheme("quickhub-light", () =>
					Promise.resolve(quickhubLight),
				);
				registerCustomTheme("quickhub-dark", () =>
					Promise.resolve(quickhubDark),
				);

				// Pierre's default map sends some extensions to grammars we deliberately
				// excluded from our Shiki bundle (e.g. `.h` → `objective-cpp`). Shiki
				// then throws "Language ... not found". Walk the default map and
				// redirect any unsupported mapping to `text` so those diffs render
				// without highlighting instead of failing.
				const overrides: Record<string, "text"> = {};
				for (const [ext, lang] of Object.entries(EXTENSION_TO_FILE_FORMAT)) {
					if (!lang) continue;
					if (lang === "text" || lang === "ansi") continue;
					if (shikiBundledLangSet.has(lang)) continue;
					overrides[ext] = "text";
				}
				if (Object.keys(overrides).length > 0) {
					extendFileFormatMap(overrides);
				}
			},
		);
// Gate PatchDiff's Suspense resolution on pierreInit so the extension-map
// override is always in place before the first file's grammar is looked up.
const PatchDiff: LazyExoticComponent<ReviewPatchDiffComponent> = lazy(() =>
	Promise.all([patchDiffModulePromise, pierreInitPromise]).then(([mod]) => mod),
);

export const ReviewFileDiffBlock = memo(function ReviewFileDiffBlock({
	id,
	file,
	diffStyle,
	isNearViewport,
	readOnly = false,
	annotations,
	repliesByCommentId,
	owner,
	repo,
	pullNumber,
	pendingComments,
	activeCommentForm,
	selectedLines,
	onGutterClick,
	onCancelComment,
	onAddComment,
	onEditComment,
	mentionConfig,
	viewerLogin,
	threadInfoByCommentId,
	wrapLines = false,
}: {
	id: string;
	file: PullFile;
	diffStyle: "unified" | "split";
	isNearViewport: boolean;
	readOnly?: boolean;
	annotations: DiffLineAnnotation<PullReviewComment>[];
	repliesByCommentId: ReadonlyMap<number, PullReviewComment[]>;
	owner: string;
	repo: string;
	pullNumber: number;
	pendingComments: PendingComment[];
	activeCommentForm: ActiveCommentForm | null;
	selectedLines: SelectedLineRange | null;
	onGutterClick: (filename: string, range: SelectedLineRange) => void;
	onCancelComment: () => void;
	onAddComment: (comment: PendingComment) => void;
	onEditComment: (original: PendingComment, newBody: string) => void;
	mentionConfig?: MentionConfig;
	viewerLogin?: string;
	threadInfoByCommentId?: ReadonlyMap<
		number,
		{ threadId: string; isResolved: boolean }
	>;
	/** Wrap long lines instead of scrolling them sideways. */
	wrapLines?: boolean;
}) {
	// A deleted file starts folded: its lines are all red and rarely worth reading.
	const [isCollapsed, setIsCollapsed] = useState(file.status === "removed");
	const [isViewed, setIsViewed] = useState(false);
	const { resolvedTheme } = useTheme();
	const isDark = resolvedTheme === "dark";

	const handleGutterUtilityClick = useCallback(
		(range: SelectedLineRange) => onGutterClick(file.filename, range),
		[file.filename, onGutterClick],
	);

	const allAnnotations = useMemo(() => {
		if (readOnly) {
			return [] as DiffLineAnnotation<ReviewAnnotation>[];
		}

		const result: DiffLineAnnotation<ReviewAnnotation>[] = [...annotations];

		for (const pending of pendingComments) {
			result.push({
				side: pending.side === "LEFT" ? "deletions" : "additions",
				lineNumber: pending.line,
				metadata: pending,
			});
		}

		if (activeCommentForm) {
			result.push({
				side: activeCommentForm.side === "LEFT" ? "deletions" : "additions",
				lineNumber: activeCommentForm.line,
				metadata: {
					path: activeCommentForm.path,
					line: activeCommentForm.line,
					startLine: activeCommentForm.startLine,
					side: activeCommentForm.side,
					startSide: activeCommentForm.startSide,
					body: "__FORM__",
				} satisfies PendingComment,
			});
		}

		return result;
	}, [readOnly, annotations, pendingComments, activeCommentForm]);

	const useWordDiff =
		file.changes <= LARGE_PATCH_CHANGE_THRESHOLD &&
		(file.patch?.length ?? 0) <= LARGE_PATCH_CHAR_THRESHOLD;

	const unsafeCSS = useMemo(
		() =>
			[
				`:host { color-scheme: ${isDark ? "dark" : "light"}; }`,
				DIFF_UNSAFE_CSS,
			].join("\n"),
		[isDark],
	);

	const diffOptions = useMemo(
		() => ({
			diffStyle,
			theme: {
				dark: "quickhub-dark" as const,
				light: "quickhub-light" as const,
			},
			lineDiffType: useWordDiff ? ("word" as const) : ("none" as const),
			maxLineDiffLength: useWordDiff ? 1_000 : 200,
			hunkSeparators: "line-info" as const,
			diffIndicators: "none" as const,
			overflow: wrapLines ? ("wrap" as const) : ("scroll" as const),
			disableFileHeader: true,
			enableGutterUtility: !readOnly,
			enableLineSelection: !readOnly,
			...(readOnly ? {} : { onGutterUtilityClick: handleGutterUtilityClick }),
			unsafeCSS,
		}),
		[
			diffStyle,
			handleGutterUtilityClick,
			readOnly,
			unsafeCSS,
			useWordDiff,
			wrapLines,
		],
	);
	const patchString = useMemo(() => buildPatchString(file), [file]);
	const placeholderHeight = useMemo(
		() => estimateDiffHeight(file.patch, diffStyle),
		[file.patch, diffStyle],
	);

	const toggleCollapse = useCallback(() => setIsCollapsed((prev) => !prev), []);
	// Marking a file viewed folds it away; unmarking opens it again.
	const toggleViewed = useCallback((viewed: boolean) => {
		setIsViewed(viewed);
		setIsCollapsed(viewed);
	}, []);

	const renderAnnotation = useCallback(
		(annotation: DiffLineAnnotation<ReviewAnnotation>) => {
			if (readOnly) return null;

			const data = annotation.metadata as
				| PendingComment
				| PullReviewComment
				| null;
			if (!data) return null;

			if ("body" in data && data.body === "__FORM__") {
				const formData = data as PendingComment;
				return (
					<InlineCommentForm
						isMultiLine={
							formData.startLine != null && formData.startLine !== formData.line
						}
						startLine={formData.startLine}
						endLine={formData.line}
						onSubmit={(body) =>
							onAddComment({
								path: file.filename,
								line: formData.line,
								startLine: formData.startLine,
								side: formData.side,
								startSide: formData.startSide,
								body,
							})
						}
						onCancel={onCancelComment}
						mentionConfig={mentionConfig}
					/>
				);
			}

			if ("body" in data && !("id" in data)) {
				return (
					<PendingCommentBubble
						comment={data as PendingComment}
						onEdit={onEditComment}
						mentionConfig={mentionConfig}
					/>
				);
			}

			if ("id" in data) {
				const c = data as PullReviewComment;
				const replies = repliesByCommentId.get(c.id);
				return (
					<ReviewCommentThread
						comment={c}
						replies={replies}
						owner={owner}
						repo={repo}
						pullNumber={pullNumber}
						viewerLogin={viewerLogin}
						threadInfo={threadInfoByCommentId?.get(c.id)}
					/>
				);
			}

			return null;
		},
		[
			file.filename,
			mentionConfig,
			onAddComment,
			onCancelComment,
			onEditComment,
			owner,
			pullNumber,
			readOnly,
			repliesByCommentId,
			repo,
			threadInfoByCommentId,
			viewerLogin,
		],
	);

	const header = (
		<FileHeader
			file={file}
			isCollapsed={isCollapsed}
			onToggleCollapse={toggleCollapse}
			isViewed={readOnly ? undefined : isViewed}
			onViewedChange={toggleViewed}
		/>
	);

	return (
		<section
			id={id}
			data-filename={file.filename}
			aria-label={file.filename}
			className="overflow-clip rounded-lg border-[0.5px] border-card-border bg-surface-0"
		>
			{header}
			{!isCollapsed && !file.patch && (
				<p className="px-4 py-3 text-xs font-[450] text-muted-foreground">
					Binary file or diff too large to display
				</p>
			)}
			{!isCollapsed && file.patch && !isNearViewport && (
				<div style={{ height: placeholderHeight }} />
			)}
			{!isCollapsed && file.patch && isNearViewport && (
				<Suspense fallback={<div style={{ height: placeholderHeight }} />}>
					<PatchDiff
						patch={patchString}
						options={diffOptions}
						selectedLines={selectedLines}
						lineAnnotations={allAnnotations}
						renderAnnotation={renderAnnotation}
					/>
				</Suspense>
			)}
		</section>
	);
});

const CHANGE_LABEL: Partial<
	Record<PullFile["status"], { label: string; tone: string }>
> = {
	added: { label: "New", tone: "text-added" },
	removed: { label: "Deleted", tone: "text-removed" },
	renamed: { label: "Renamed", tone: "text-muted-foreground" },
};

function splitPath(path: string) {
	const at = path.lastIndexOf("/");
	return { name: path.slice(at + 1), dir: path.slice(0, at + 1) };
}

/**
 * A file card's 36px header, after Linear's diff view: the file's glyph (it
 * folds the card), name, muted path and what happened to it, copy, the line
 * counts, Viewed and a more menu. It sticks to the top while its lines scroll.
 */
const FileHeader = memo(function FileHeader({
	file,
	isCollapsed,
	onToggleCollapse,
	isViewed,
	onViewedChange,
}: {
	file: PullFile;
	isCollapsed: boolean;
	onToggleCollapse: () => void;
	/** Omit to hide the Viewed checkbox (read-only diffs). */
	isViewed?: boolean;
	onViewedChange: (viewed: boolean) => void;
}) {
	const [copied, setCopied] = useState(false);
	const { name, dir } = splitPath(file.filename);
	const moved =
		file.previousFilename && file.previousFilename !== file.filename
			? splitPath(file.previousFilename)
			: null;
	const change = CHANGE_LABEL[file.status];

	const copyPath = useCallback(() => {
		void navigator.clipboard.writeText(file.filename).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		});
	}, [file.filename]);

	return (
		<div
			className={cn(
				"sticky top-0 z-10 flex h-9 items-center gap-2 rounded-t-[7.5px] bg-surface-0 pr-2 pl-4 text-xs leading-4 font-[450] select-none",
				isCollapsed
					? "rounded-b-[7.5px]"
					: "border-b-[0.5px] border-card-border",
			)}
		>
			<button
				type="button"
				onClick={onToggleCollapse}
				aria-expanded={!isCollapsed}
				aria-label={
					isCollapsed ? "Expand file contents" : "Collapse file contents"
				}
				title={isCollapsed ? "Expand file" : "Collapse file"}
				className="relative flex shrink-0 items-center rounded-sm after:absolute after:-inset-1.5"
			>
				<FileTypeIcon path={file.filename} />
			</button>

			{/* a moved file reads "old → new", the old name struck through when it changed too */}
			{moved ? (
				<>
					<span
						className={cn(
							"min-w-0 shrink truncate text-muted-foreground select-text",
							moved.name !== name && "line-through",
						)}
					>
						{moved.name !== name ? moved.name : moved.dir}
					</span>
					<span aria-hidden className="shrink-0 text-icon-faint">
						→
					</span>
				</>
			) : null}
			<span
				className={cn(
					"max-w-[60%] shrink-0 truncate select-text",
					file.status === "removed"
						? "text-muted-foreground line-through"
						: "text-foreground",
				)}
			>
				{name}
			</span>
			<span className="min-w-0 truncate text-muted-foreground select-text max-sm:hidden">
				{dir}
			</span>
			{change ? (
				<span className={cn("shrink-0 font-medium", change.tone)}>
					{change.label}
				</span>
			) : null}
			<button
				type="button"
				onClick={copyPath}
				aria-label={copied ? "Copied file path" : "Copy file path"}
				title="Copy file path"
				className="relative flex shrink-0 text-muted-foreground transition-colors after:absolute after:-inset-1.5 hover:text-foreground"
			>
				{copied ? (
					<CheckIcon size={12} strokeWidth={2.5} />
				) : (
					<CopyIcon size={12} strokeWidth={2} />
				)}
			</button>

			<span className="ml-auto" />
			<LineCounts
				additions={file.additions}
				deletions={file.deletions}
				className="text-xs"
			/>
			{isViewed !== undefined ? (
				<label className="ml-3 flex h-6 shrink-0 cursor-pointer items-center gap-2 rounded-full px-2 text-muted-foreground transition-colors hover:bg-ghost-hover hover:text-foreground">
					<input
						type="checkbox"
						checked={isViewed}
						onChange={(e) => onViewedChange(e.target.checked)}
						className="size-3.5 cursor-pointer accent-focus"
					/>
					<span className="max-sm:sr-only">Viewed</span>
				</label>
			) : null}
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<PageIconButton
						type="button"
						className="size-6 text-foreground"
						aria-label="File actions"
					>
						<MoreHorizontalIcon size={14} />
					</PageIconButton>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem onSelect={copyPath}>
						<CopyIcon size={14} strokeWidth={2} />
						Copy file path
					</DropdownMenuItem>
					<DropdownMenuItem onSelect={onToggleCollapse}>
						{isCollapsed ? (
							<ChevronDownIcon size={14} strokeWidth={2} />
						) : (
							<ChevronUpIcon size={14} strokeWidth={2} />
						)}
						{isCollapsed ? "Expand file" : "Collapse file"}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
});

function InlineCommentForm({
	isMultiLine,
	startLine,
	endLine,
	onSubmit,
	onCancel,
	mentionConfig,
}: {
	isMultiLine?: boolean;
	startLine?: number;
	endLine?: number;
	onSubmit: (body: string) => void;
	onCancel: () => void;
	mentionConfig?: MentionConfig;
}) {
	const [body, setBody] = useState("");
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	useEffect(() => {
		textareaRef.current?.focus();
	}, []);

	return (
		<div className="my-3 mr-4 flex flex-col gap-2 max-md:ml-3">
			{isMultiLine && startLine != null && endLine != null && (
				<div className="text-xs font-[450] text-muted-foreground">
					Commenting on lines {startLine}–{endLine}
				</div>
			)}
			<MarkdownEditor
				value={body}
				onChange={setBody}
				placeholder="Leave a comment..."
				compact
				mentions={mentionConfig}
				textareaRef={textareaRef}
			/>
			<div className="flex items-center justify-end gap-1.5">
				<button
					type="button"
					onClick={onCancel}
					className="h-7 rounded-full px-2.5 text-xs font-medium text-text-header transition-colors hover:bg-ghost-hover"
				>
					Cancel
				</button>
				<button
					type="button"
					onClick={() => {
						if (body.trim()) onSubmit(body.trim());
					}}
					disabled={!body.trim()}
					className="flex h-7 items-center gap-1.5 rounded-full bg-button px-3 text-xs font-medium text-foreground shadow-button transition-colors hover:bg-button-hover disabled:pointer-events-none disabled:opacity-45"
				>
					Add comment
				</button>
			</div>
		</div>
	);
}

function ReviewCommentBubble({
	comment,
	owner,
	repo,
	pullNumber,
	viewerLogin,
}: {
	comment: PullReviewComment;
	owner: string;
	repo: string;
	pullNumber: number;
	viewerLogin?: string;
}) {
	return (
		<div className="group/comment relative flex flex-col gap-1.5 px-4 py-3">
			<div className="flex h-6 items-center">
				{comment.author ? (
					<img
						src={comment.author.avatarUrl}
						alt={comment.author.login}
						className="size-[18px] rounded-full"
					/>
				) : (
					<div className="size-[18px] rounded-full bg-pill-neutral" />
				)}
				<span className="ml-[9px] text-[13px] font-medium text-foreground">
					{comment.author?.login ?? "Unknown"}
				</span>
				<span className="ml-2 text-[13px] font-[450] text-icon-faint">
					{formatRelativeTime(comment.createdAt)}
				</span>
				<div className="ml-auto">
					<CommentMoreMenu
						commentId={comment.id}
						body={comment.body}
						owner={owner}
						repo={repo}
						number={pullNumber}
						commentType="review"
						isAuthor={
							viewerLogin != null && comment.author?.login === viewerLogin
						}
					/>
				</div>
			</div>
			<Markdown className="pl-[27px] text-text-strong">{comment.body}</Markdown>
		</div>
	);
}

function ReviewCommentThread({
	comment,
	replies,
	owner,
	repo,
	pullNumber,
	viewerLogin,
	threadInfo,
}: {
	comment: PullReviewComment;
	replies?: PullReviewComment[];
	owner: string;
	repo: string;
	pullNumber: number;
	viewerLogin?: string;
	threadInfo?: { threadId: string; isResolved: boolean };
}) {
	const queryClient = useQueryClient();
	const [showReplyForm, setShowReplyForm] = useState(false);
	const [replyBody, setReplyBody] = useState("");
	const [isSending, setIsSending] = useState(false);
	const [isResolving, setIsResolving] = useState(false);

	const handleReply = async () => {
		if (!replyBody.trim()) return;
		setIsSending(true);
		try {
			const result = await replyToReviewComment({
				data: {
					owner,
					repo,
					pullNumber,
					commentId: comment.id,
					body: replyBody.trim(),
				},
			});
			if (result) {
				setReplyBody("");
				setShowReplyForm(false);
				void invalidateGitHubEntities(queryClient, null, [
					pullEntityKey({ owner, repo, pullNumber }),
				]);
			} else {
				toast.error("Failed to send reply");
			}
		} catch {
			toast.error("Failed to send reply");
		} finally {
			setIsSending(false);
		}
	};

	const handleResolve = async () => {
		if (!threadInfo) return;
		setIsResolving(true);
		try {
			const fn = threadInfo.isResolved
				? unresolveReviewThread
				: resolveReviewThread;
			const result = await fn({
				data: { owner, repo, threadId: threadInfo.threadId },
			});
			if (result.ok) {
				void invalidateGitHubEntities(queryClient, null, [
					pullEntityKey({ owner, repo, pullNumber }),
				]);
			} else {
				toast.error(result.error);
			}
		} catch {
			toast.error("Failed to update thread");
		} finally {
			setIsResolving(false);
		}
	};

	return (
		<div className="my-3 mr-4 divide-y-[0.5px] divide-card-border overflow-hidden rounded-lg border-[0.5px] border-card-border bg-surface-0 max-md:ml-3">
			{threadInfo?.isResolved && (
				<div className="flex h-9 items-center gap-1.5 px-4 text-xs font-medium text-pill-ok-text">
					<CheckIcon size={12} strokeWidth={2} />
					Resolved
				</div>
			)}
			<ReviewCommentBubble
				comment={comment}
				owner={owner}
				repo={repo}
				pullNumber={pullNumber}
				viewerLogin={viewerLogin}
			/>
			{replies?.map((reply) => (
				<ReviewCommentBubble
					key={reply.id}
					comment={reply}
					owner={owner}
					repo={repo}
					pullNumber={pullNumber}
					viewerLogin={viewerLogin}
				/>
			))}
			<div className="flex min-h-10 items-center gap-2 px-4 py-2">
				{showReplyForm ? (
					<div className="flex w-full flex-col gap-2">
						<MarkdownEditor
							value={replyBody}
							onChange={setReplyBody}
							placeholder="Write a reply..."
							compact
						/>
						<div className="flex items-center justify-end gap-1.5">
							<button
								type="button"
								onClick={() => {
									setShowReplyForm(false);
									setReplyBody("");
								}}
								className="h-7 rounded-full px-2.5 text-xs font-medium text-text-header transition-colors hover:bg-ghost-hover"
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={() => void handleReply()}
								disabled={!replyBody.trim() || isSending}
								className="flex h-7 items-center gap-1.5 rounded-full bg-button px-3 text-xs font-medium text-foreground shadow-button transition-colors hover:bg-button-hover disabled:pointer-events-none disabled:opacity-45"
							>
								{isSending ? (
									<Spinner className="size-3" />
								) : (
									<CommentIcon size={12} strokeWidth={2} />
								)}
								Reply
							</button>
						</div>
					</div>
				) : (
					<>
						<button
							type="button"
							onClick={() => setShowReplyForm(true)}
							className="-ml-2 flex h-6 items-center gap-1.5 rounded-full px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-ghost-hover hover:text-foreground"
						>
							<CommentIcon size={12} strokeWidth={2} />
							Reply
						</button>
						{threadInfo && (
							<button
								type="button"
								onClick={() => void handleResolve()}
								disabled={isResolving}
								className="-mr-2 ml-auto flex h-6 items-center gap-1.5 rounded-full px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-ghost-hover hover:text-foreground disabled:opacity-45"
							>
								{isResolving ? (
									<Spinner className="size-3" />
								) : (
									<CheckIcon size={12} strokeWidth={2} />
								)}
								{threadInfo.isResolved ? "Unresolve" : "Resolve"}
							</button>
						)}
					</>
				)}
			</div>
		</div>
	);
}

function PendingCommentBubble({
	comment,
	onEdit,
	mentionConfig,
}: {
	comment: PendingComment;
	onEdit: (original: PendingComment, newBody: string) => void;
	mentionConfig?: MentionConfig;
}) {
	const isMultiLine =
		comment.startLine != null && comment.startLine !== comment.line;
	const [isEditing, setIsEditing] = useState(false);
	const [draft, setDraft] = useState(comment.body);

	if (isEditing) {
		return (
			<div className="my-3 mr-4 flex flex-col gap-2 max-md:ml-3">
				<MarkdownEditor
					value={draft}
					onChange={setDraft}
					placeholder="Leave a comment..."
					compact
					mentions={mentionConfig}
				/>
				<div className="flex items-center justify-end gap-1.5">
					<button
						type="button"
						onClick={() => {
							setDraft(comment.body);
							setIsEditing(false);
						}}
						className="h-7 rounded-full px-2.5 text-xs font-medium text-text-header transition-colors hover:bg-ghost-hover"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={() => {
							if (draft.trim()) {
								onEdit(comment, draft.trim());
								setIsEditing(false);
							}
						}}
						disabled={!draft.trim()}
						className="flex h-7 items-center gap-1.5 rounded-full bg-button px-3 text-xs font-medium text-foreground shadow-button transition-colors hover:bg-button-hover disabled:pointer-events-none disabled:opacity-45"
					>
						Update
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="my-3 mr-4 flex flex-col gap-1.5 rounded-lg border-[0.5px] border-dashed border-chip-border bg-surface-0 px-4 py-3 max-md:ml-3">
			<div className="flex h-6 items-center gap-1.5">
				<CommentIcon
					size={12}
					strokeWidth={2}
					className="text-muted-foreground"
				/>
				<span className="text-xs font-medium text-muted-foreground">
					Pending
					{isMultiLine ? ` · lines ${comment.startLine}–${comment.line}` : ""}
				</span>
				<button
					type="button"
					onClick={() => setIsEditing(true)}
					aria-label="Edit pending comment"
					className="-mr-1 ml-auto flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-ghost-hover hover:text-foreground"
				>
					<EditIcon size={12} strokeWidth={2} />
				</button>
			</div>
			<Markdown className="text-text-strong">{comment.body}</Markdown>
		</div>
	);
}
