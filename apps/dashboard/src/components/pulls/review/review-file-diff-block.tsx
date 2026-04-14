import { CheckIcon, CommentIcon, CopyIcon, EditIcon } from "@diffkit/icons";
import { Markdown } from "@diffkit/ui/components/markdown";
import {
	MarkdownEditor,
	type MentionConfig,
} from "@diffkit/ui/components/markdown-editor";
import { toast } from "@diffkit/ui/components/sonner";
import { Spinner } from "@diffkit/ui/components/spinner";
import { quickhubDark, quickhubLight } from "@diffkit/ui/lib/diffs-themes";
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
	useMemo,
	useState,
} from "react";
import { CommentMoreMenu } from "#/components/details/comment-more-menu";
import { formatRelativeTime } from "#/lib/format-relative-time";
import {
	replyToReviewComment,
	resolveReviewThread,
	unresolveReviewThread,
} from "#/lib/github.functions";
import { githubQueryKeys } from "#/lib/github.query";
import type { PullFile, PullReviewComment } from "#/lib/github.types";
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

function estimateDiffHeight(
	patch: string | undefined,
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

const PatchDiff: LazyExoticComponent<ReviewPatchDiffComponent> = lazy(() =>
	import.meta.env.SSR
		? Promise.resolve({
				default: (() => null) as ReviewPatchDiffComponent,
			})
		: import("@pierre/diffs/react").then((mod) => ({
				default: mod.PatchDiff as ReviewPatchDiffComponent,
			})),
);

let themesRegistered = false;
if (!import.meta.env.SSR && !themesRegistered) {
	themesRegistered = true;
	import("@pierre/diffs").then(({ registerCustomTheme }) => {
		registerCustomTheme("quickhub-light", () => Promise.resolve(quickhubLight));
		registerCustomTheme("quickhub-dark", () => Promise.resolve(quickhubDark));
	});
}

export const ReviewFileDiffBlock = memo(function ReviewFileDiffBlock({
	id,
	file,
	diffStyle,
	isNearViewport,
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
}: {
	id: string;
	file: PullFile;
	diffStyle: "unified" | "split";
	isNearViewport: boolean;
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
}) {
	const [isCollapsed, setIsCollapsed] = useState(false);
	const { resolvedTheme } = useTheme();
	const isDark = resolvedTheme === "dark";
	const handleGutterUtilityClick = useCallback(
		(range: SelectedLineRange) => onGutterClick(file.filename, range),
		[file.filename, onGutterClick],
	);

	const allAnnotations = useMemo(() => {
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
	}, [annotations, pendingComments, activeCommentForm]);

	const useWordDiff =
		file.changes <= LARGE_PATCH_CHANGE_THRESHOLD &&
		(file.patch?.length ?? 0) <= LARGE_PATCH_CHAR_THRESHOLD;

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
			overflow: "scroll" as const,
			disableFileHeader: true,
			enableGutterUtility: true,
			enableLineSelection: true,
			onGutterUtilityClick: handleGutterUtilityClick,
			unsafeCSS: [
				`:host { color-scheme: ${isDark ? "dark" : "light"}; }`,
				`:host { --diffs-font-family: 'Geist Mono Variable', 'SF Mono', ui-monospace, 'Cascadia Code', monospace; }`,
				`[data-line-annotation] { font-family: 'Inter Variable', 'Inter', 'Avenir Next', ui-sans-serif, system-ui, sans-serif; }`,
				`[data-line-annotation] code { font-family: var(--diffs-font-family, var(--diffs-font-fallback)); }`,
				`[data-annotation-content] { background-color: transparent; }`,
				`[data-diff] { border: 1px solid var(--border); border-top: 0; border-radius: 0 0 4px 4px; overflow: hidden; }`,
			].join("\n"),
		}),
		[diffStyle, handleGutterUtilityClick, isDark, useWordDiff],
	);
	const patchString = useMemo(() => buildPatchString(file), [file]);

	if (!file.patch) {
		return (
			<div id={id} data-filename={file.filename}>
				<FileHeader
					file={file}
					isCollapsed={isCollapsed}
					onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
				/>
				{!isCollapsed && (
					<div className="px-2 pb-2">
						<div className="flex items-center justify-center rounded-b-lg border border-t-0 bg-surface-0 py-8 text-sm text-muted-foreground">
							Binary file or diff too large to display
						</div>
					</div>
				)}
			</div>
		);
	}

	return (
		<div id={id} data-filename={file.filename}>
			<FileHeader
				file={file}
				isCollapsed={isCollapsed}
				onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
			/>
			{!isCollapsed && !isNearViewport && (
				<div
					className="px-2 pb-2"
					style={{
						height: estimateDiffHeight(file.patch, diffStyle),
					}}
				/>
			)}
			{!isCollapsed && isNearViewport && (
				<div className="px-2 pb-2">
					<Suspense>
						<PatchDiff
							patch={patchString}
							options={diffOptions}
							selectedLines={selectedLines}
							lineAnnotations={allAnnotations}
							renderAnnotation={(
								annotation: DiffLineAnnotation<ReviewAnnotation>,
							) => {
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
												formData.startLine != null &&
												formData.startLine !== formData.line
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
							}}
						/>
					</Suspense>
				</div>
			)}
		</div>
	);
});

function FileHeader({
	file,
	isCollapsed,
	onToggleCollapse,
}: {
	file: PullFile;
	isCollapsed: boolean;
	onToggleCollapse: () => void;
}) {
	const [copied, setCopied] = useState(false);

	return (
		<div className="sticky top-2 z-10 flex items-center gap-2 rounded-lg border bg-surface-1 px-3 py-2 select-none">
			<button
				type="button"
				onClick={onToggleCollapse}
				className="flex shrink-0 items-center text-muted-foreground transition-colors hover:text-foreground"
				aria-label={isCollapsed ? "Expand file" : "Collapse file"}
			>
				<svg
					aria-hidden="true"
					className={cn(
						"size-3 shrink-0 transition-transform",
						!isCollapsed && "rotate-90",
					)}
					viewBox="0 0 16 16"
					fill="currentColor"
				>
					<path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z" />
				</svg>
			</button>

			{/* biome-ignore lint/a11y/noStaticElementInteractions: span stops propagation so text selection doesn't trigger collapse */}
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard users use the collapse button; this only prevents mouse click bubbling */}
			<span
				className="min-w-0 flex-1 cursor-text truncate font-mono text-xs font-medium select-text"
				onClick={(e) => e.stopPropagation()}
			>
				{file.previousFilename && file.previousFilename !== file.filename ? (
					<>
						<span className="text-muted-foreground line-through">
							{file.previousFilename}
						</span>
						<span className="mx-1 text-muted-foreground">→</span>
						{file.filename}
					</>
				) : (
					file.filename
				)}
			</span>

			<button
				type="button"
				onClick={(e) => {
					e.stopPropagation();
					void navigator.clipboard.writeText(file.filename).then(() => {
						setCopied(true);
						setTimeout(() => setCopied(false), 1500);
					});
				}}
				className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
				aria-label="Copy file path"
			>
				{copied ? (
					<CheckIcon size={12} strokeWidth={2.5} />
				) : (
					<CopyIcon size={12} strokeWidth={2} />
				)}
			</button>

			<span className="ml-auto flex items-center gap-2 font-mono text-xs tabular-nums">
				{file.additions > 0 && (
					<span className="font-medium text-green-500">+{file.additions}</span>
				)}
				{file.deletions > 0 && (
					<span className="font-medium text-red-500">-{file.deletions}</span>
				)}
			</span>
		</div>
	);
}

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

	return (
		<div className="mx-2 my-1 flex flex-col gap-2">
			{isMultiLine && startLine != null && endLine != null && (
				<div className="text-xs text-muted-foreground">
					Commenting on lines {startLine}–{endLine}
				</div>
			)}
			<MarkdownEditor
				value={body}
				onChange={setBody}
				placeholder="Leave a comment..."
				compact
				mentions={mentionConfig}
			/>
			<div className="flex items-center justify-end gap-2">
				<button
					type="button"
					onClick={onCancel}
					className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
				>
					Cancel
				</button>
				<button
					type="button"
					onClick={() => {
						if (body.trim()) onSubmit(body.trim());
					}}
					disabled={!body.trim()}
					className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity disabled:opacity-50"
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
		<div className="group/comment relative px-3 py-2.5">
			<div className="mb-1.5 flex items-center gap-1.5">
				{comment.author ? (
					<img
						src={comment.author.avatarUrl}
						alt={comment.author.login}
						className="size-4 rounded-full border border-border"
					/>
				) : (
					<div className="size-4 rounded-full bg-surface-2" />
				)}
				<span className="text-[13px] font-medium">
					{comment.author?.login ?? "Unknown"}
				</span>
				<span className="text-[13px] text-muted-foreground">
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
			<Markdown className="text-muted-foreground">{comment.body}</Markdown>
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
				void queryClient.invalidateQueries({
					queryKey: githubQueryKeys.all,
				});
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
				void queryClient.invalidateQueries({ queryKey: githubQueryKeys.all });
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
		<div className="m-2 divide-y rounded-lg border bg-surface-0">
			{threadInfo?.isResolved && (
				<div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-600 dark:text-green-400">
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
			<div className="flex items-center gap-2 px-3 py-2">
				{showReplyForm ? (
					<div className="flex w-full flex-col gap-2">
						<MarkdownEditor
							value={replyBody}
							onChange={setReplyBody}
							placeholder="Write a reply..."
							compact
						/>
						<div className="flex items-center justify-end gap-2">
							<button
								type="button"
								onClick={() => {
									setShowReplyForm(false);
									setReplyBody("");
								}}
								className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={() => void handleReply()}
								disabled={!replyBody.trim() || isSending}
								className="flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity disabled:opacity-50"
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
							className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
						>
							<CommentIcon size={12} strokeWidth={2} />
							Reply
						</button>
						{threadInfo && (
							<button
								type="button"
								onClick={() => void handleResolve()}
								disabled={isResolving}
								className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
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
			<div className="mx-2 my-1 flex flex-col gap-2">
				<MarkdownEditor
					value={draft}
					onChange={setDraft}
					placeholder="Leave a comment..."
					compact
					mentions={mentionConfig}
				/>
				<div className="flex items-center justify-end gap-2">
					<button
						type="button"
						onClick={() => {
							setDraft(comment.body);
							setIsEditing(false);
						}}
						className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
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
						className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity disabled:opacity-50"
					>
						Update
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="mx-2 my-1 rounded-lg border border-dashed bg-surface-0 px-3 py-2.5">
			<div className="mb-1.5 flex items-center gap-1.5">
				<CommentIcon
					size={12}
					strokeWidth={2}
					className="text-muted-foreground"
				/>
				<span className="text-[13px] font-medium text-muted-foreground">
					Pending
					{isMultiLine ? ` · lines ${comment.startLine}–${comment.line}` : ""}
				</span>
				<button
					type="button"
					onClick={() => setIsEditing(true)}
					className="ml-auto flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-1 hover:text-foreground"
				>
					<EditIcon size={12} strokeWidth={2} />
				</button>
			</div>
			<Markdown className="text-muted-foreground">{comment.body}</Markdown>
		</div>
	);
}
