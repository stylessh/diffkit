import { ArrowUpIcon, CheckIcon, CommentIcon, EditIcon } from "@diffkit/icons";
import {
	MarkdownEditor,
	type MentionConfig,
} from "@diffkit/ui/components/markdown-editor";
import { toast } from "@diffkit/ui/components/sonner";
import { Spinner } from "@diffkit/ui/components/spinner";
import { cn } from "@diffkit/ui/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	type Dispatch,
	type ReactNode,
	type SetStateAction,
	useEffect,
	useRef,
	useState,
} from "react";
import {
	CommentBody,
	EditedMark,
	useCommentEditor,
} from "#/components/details/comment-body";
import { CommentMoreMenu } from "#/components/details/comment-more-menu";
import { AppMarkdown } from "#/components/markdown/app-markdown";
import { formatRelativeTime } from "#/lib/format-relative-time";
import {
	replyToReviewComment,
	resolveReviewThread,
	unresolveReviewThread,
} from "#/lib/github.functions";
import type { PullReviewComment } from "#/lib/github.types";
import {
	invalidateGitHubEntities,
	pullEntityKey,
} from "#/lib/github-query-updates";
import {
	isMultiLineComment,
	type PendingComment,
	type ReviewThreadState,
} from "./review-types";

const ANNOTATION_FRAME = "my-2.5 mr-4 ml-2 max-w-[46rem]";
const CARD =
	"rounded-lg border-[0.5px] border-border bg-card shadow-[var(--ln-main-shadow)]";
const BODY_TEXT = "text-[15px] leading-6 text-text-strong";
const GHOST_BUTTON =
	"flex h-6 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-text-header transition-colors hover:bg-ghost-hover disabled:pointer-events-none disabled:opacity-45";

/**
 * One row that grows with its text. The arrow or mod+Enter sends; Escape
 * cancels, and so does leaving the field while `dismissOnBlur` holds.
 */
function AnnotationComposer({
	value,
	onChange,
	placeholder,
	submitLabel,
	isSubmitting = false,
	autoFocus = false,
	dismissOnBlur = false,
	onSubmit,
	onCancel,
	actions,
	mentionConfig,
	bare,
}: {
	value: string;
	onChange: Dispatch<SetStateAction<string>>;
	placeholder: string;
	submitLabel: string;
	isSubmitting?: boolean;
	autoFocus?: boolean;
	dismissOnBlur?: boolean;
	onSubmit: () => void;
	onCancel?: () => void;
	actions?: ReactNode;
	mentionConfig?: MentionConfig;
	bare?: boolean;
}) {
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const canSubmit = value.trim().length > 0 && !isSubmitting;

	useEffect(() => {
		const field = textareaRef.current;
		if (!autoFocus || !field) return;
		field.focus();
		field.setSelectionRange(field.value.length, field.value.length);
	}, [autoFocus]);

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: watches focus leaving the composer, not an interaction of its own
		<div
			onBlur={(event) => {
				// Switching windows blurs the field too; that is not leaving it.
				if (!dismissOnBlur || !document.hasFocus()) return;
				if (event.currentTarget.contains(event.relatedTarget)) return;
				onCancel?.();
			}}
		>
			<MarkdownEditor
				value={value}
				onChange={onChange}
				placeholder={placeholder}
				compact
				inline
				mentions={mentionConfig}
				textareaRef={textareaRef}
				bare={bare}
				onKeyDown={(event) => {
					if (event.key === "Escape") onCancel?.();
					if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
						event.preventDefault();
						if (canSubmit) onSubmit();
					}
				}}
				footer={
					<>
						{actions}
						<button
							type="button"
							aria-label={submitLabel}
							title={submitLabel}
							onClick={onSubmit}
							disabled={!canSubmit}
							className="flex size-6 shrink-0 items-center justify-center rounded-full bg-composer-send text-text-header transition-colors enabled:hover:text-foreground disabled:text-muted-foreground"
						>
							{isSubmitting ? (
								<Spinner size={12} />
							) : (
								<ArrowUpIcon size={14} strokeWidth={2} />
							)}
						</button>
					</>
				}
			/>
		</div>
	);
}

export function InlineCommentForm({
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
		<div className={ANNOTATION_FRAME}>
			<AnnotationComposer
				autoFocus
				value={body}
				onChange={setBody}
				placeholder={
					isMultiLine && startLine != null && endLine != null
						? `Comment on lines ${startLine}–${endLine}...`
						: "Leave a comment..."
				}
				submitLabel="Add comment"
				dismissOnBlur={body.trim() === ""}
				onSubmit={() => onSubmit(body.trim())}
				onCancel={onCancel}
				mentionConfig={mentionConfig}
			/>
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
	const editor = useCommentEditor({
		kind: "review",
		owner: owner,
		repo: repo,
		number: pullNumber,
		commentId: comment.id,
	});
	return (
		<div className="group/comment relative flex flex-col gap-1.5 px-4 py-2.5">
			<div className="flex h-[19px] items-center gap-[9px]">
				{comment.author ? (
					<img
						src={comment.author.avatarUrl}
						alt={comment.author.login}
						className="size-[18px] rounded-full ring-[0.5px] ring-chip-border"
					/>
				) : (
					<div className="size-[18px] rounded-full bg-group" />
				)}
				<span className="text-[13px] font-medium text-foreground">
					{comment.author?.login ?? "Unknown"}
				</span>
				<span className="-ml-0.5 text-[13px] font-[450] text-muted-foreground">
					{formatRelativeTime(comment.createdAt)}
				</span>
				<EditedMark editedAt={comment.editedAt} />
				<div className="ml-auto">
					<CommentMoreMenu
						commentId={comment.id}
						body={comment.body}
						owner={owner}
						repo={repo}
						number={pullNumber}
						commentType="review"
						editor={editor}
						isAuthor={
							viewerLogin != null && comment.author?.login === viewerLogin
						}
					/>
				</div>
			</div>
			<div className="pl-[27px]">
				<CommentBody
					editor={editor}
					body={comment.body}
					owner={owner}
					repo={repo}
					className={BODY_TEXT}
				/>
			</div>
		</div>
	);
}

export function ReviewCommentThread({
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
	threadInfo?: ReviewThreadState;
}) {
	const queryClient = useQueryClient();
	const [replyBody, setReplyBody] = useState("");
	const refreshPull = () =>
		void invalidateGitHubEntities(queryClient, null, [
			pullEntityKey({ owner, repo, pullNumber }),
		]);

	const reply = useMutation({
		mutationFn: (body: string) =>
			replyToReviewComment({
				data: { owner, repo, pullNumber, commentId: comment.id, body },
			}),
		onSuccess(sent) {
			if (!sent) {
				toast.error("Failed to send reply");
				return;
			}
			setReplyBody("");
			refreshPull();
		},
		onError: () => toast.error("Failed to send reply"),
	});

	const toggleResolved = useMutation({
		mutationFn: ({ threadId, isResolved }: ReviewThreadState) =>
			(isResolved ? unresolveReviewThread : resolveReviewThread)({
				data: { owner, repo, threadId },
			}),
		onSuccess(result) {
			if (result.ok) refreshPull();
			else toast.error(result.error);
		},
		onError: () => toast.error("Failed to update thread"),
	});

	const sendReply = () => {
		const body = replyBody.trim();
		if (body) reply.mutate(body);
	};

	return (
		<div
			className={cn(
				ANNOTATION_FRAME,
				CARD,
				"overflow-hidden has-[[data-thread-reply]_[data-keyboard-focus]]:shadow-[0_0_0_1px_var(--ln-focus),var(--ln-main-shadow)]",
			)}
		>
			<div className="py-1">
				{threadInfo?.isResolved && (
					<div className="flex px-4 pt-2.5">
						<span className="inline-flex h-5 items-center gap-1 rounded-full bg-pill-ok px-2 text-[11px] font-medium text-pill-ok-text">
							<CheckIcon size={11} strokeWidth={2.5} />
							Resolved
						</span>
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
			</div>
			<div data-thread-reply className="border-t-[0.5px] border-border">
				<AnnotationComposer
					value={replyBody}
					onChange={setReplyBody}
					placeholder="Write a reply..."
					submitLabel="Reply"
					isSubmitting={reply.isPending}
					onSubmit={sendReply}
					actions={
						threadInfo ? (
							<button
								type="button"
								onClick={() => toggleResolved.mutate(threadInfo)}
								disabled={toggleResolved.isPending}
								className={GHOST_BUTTON}
							>
								{toggleResolved.isPending ? (
									<Spinner className="size-3" />
								) : (
									<CheckIcon size={12} strokeWidth={2} />
								)}
								{threadInfo.isResolved ? "Unresolve" : "Resolve"}
							</button>
						) : null
					}
					bare
				/>
			</div>
		</div>
	);
}

function PendingCommentEditor({
	comment,
	onSave,
	onCancel,
	mentionConfig,
}: {
	comment: PendingComment;
	onSave: (body: string) => void;
	onCancel: () => void;
	mentionConfig?: MentionConfig;
}) {
	const [draft, setDraft] = useState(comment.body);
	return (
		<div className={ANNOTATION_FRAME}>
			<AnnotationComposer
				autoFocus
				value={draft}
				onChange={setDraft}
				placeholder="Leave a comment..."
				submitLabel="Update comment"
				dismissOnBlur={draft === comment.body}
				onSubmit={() => onSave(draft.trim())}
				onCancel={onCancel}
				mentionConfig={mentionConfig}
			/>
		</div>
	);
}

export function PendingCommentBubble({
	comment,
	onEdit,
	mentionConfig,
}: {
	comment: PendingComment;
	onEdit: (original: PendingComment, newBody: string) => void;
	mentionConfig?: MentionConfig;
}) {
	const [isEditing, setIsEditing] = useState(false);

	if (isEditing) {
		return (
			<PendingCommentEditor
				comment={comment}
				onSave={(body) => {
					onEdit(comment, body);
					setIsEditing(false);
				}}
				onCancel={() => setIsEditing(false)}
				mentionConfig={mentionConfig}
			/>
		);
	}

	return (
		<div
			className={cn(ANNOTATION_FRAME, CARD, "flex flex-col gap-1.5 px-4 py-3")}
		>
			<div className="flex h-5 items-center gap-2">
				<span className="inline-flex h-5 items-center gap-1 rounded-full bg-pill-warning px-2 text-[11px] font-medium text-pill-warning-text">
					<CommentIcon size={11} strokeWidth={2} />
					Pending
				</span>
				{isMultiLineComment(comment) ? (
					<span className="text-xs font-[450] text-muted-foreground">
						Lines {comment.startLine}–{comment.line}
					</span>
				) : null}
				<button
					type="button"
					onClick={() => setIsEditing(true)}
					aria-label="Edit pending comment"
					className="-mr-1.5 ml-auto flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-ghost-hover hover:text-foreground"
				>
					<EditIcon size={12} strokeWidth={2} />
				</button>
			</div>
			<AppMarkdown className={BODY_TEXT}>{comment.body}</AppMarkdown>
		</div>
	);
}
