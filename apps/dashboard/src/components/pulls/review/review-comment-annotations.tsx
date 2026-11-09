import { CheckIcon, CommentIcon, EditIcon } from "@diffkit/icons";
import {
	MarkdownEditor,
	type MentionConfig,
} from "@diffkit/ui/components/markdown-editor";
import { toast } from "@diffkit/ui/components/sonner";
import { Spinner } from "@diffkit/ui/components/spinner";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
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
import type { PendingComment } from "./review-types";

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
					className="h-7 rounded-md px-2.5 text-xs font-medium text-text-header transition-colors hover:bg-ghost-hover"
				>
					Cancel
				</button>
				<button
					type="button"
					onClick={() => {
						if (body.trim()) onSubmit(body.trim());
					}}
					disabled={!body.trim()}
					className="flex h-7 items-center gap-1.5 rounded-md bg-button px-3 text-xs font-medium text-foreground shadow-button transition-colors hover:bg-button-hover disabled:pointer-events-none disabled:opacity-45"
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
	const editor = useCommentEditor({
		kind: "review",
		owner: owner,
		repo: repo,
		number: pullNumber,
		commentId: comment.id,
	});
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
					className="text-text-strong"
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
	threadInfo?: { threadId: string; isResolved: boolean };
}) {
	const queryClient = useQueryClient();
	const [replyStatus, setReplyStatus] = useState<"closed" | "open" | "sending">(
		"closed",
	);
	const showReplyForm = replyStatus !== "closed";
	const isSending = replyStatus === "sending";
	const [replyBody, setReplyBody] = useState("");
	const [isResolving, setIsResolving] = useState(false);

	const handleReply = async () => {
		if (!replyBody.trim()) return;
		setReplyStatus("sending");
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
				setReplyStatus("closed");
				void invalidateGitHubEntities(queryClient, null, [
					pullEntityKey({ owner, repo, pullNumber }),
				]);
			} else {
				toast.error("Failed to send reply");
				setReplyStatus("open");
			}
		} catch {
			toast.error("Failed to send reply");
			setReplyStatus("open");
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
									setReplyStatus("closed");
									setReplyBody("");
								}}
								className="h-7 rounded-md px-2.5 text-xs font-medium text-text-header transition-colors hover:bg-ghost-hover"
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={() => void handleReply()}
								disabled={!replyBody.trim() || isSending}
								className="flex h-7 items-center gap-1.5 rounded-md bg-button px-3 text-xs font-medium text-foreground shadow-button transition-colors hover:bg-button-hover disabled:pointer-events-none disabled:opacity-45"
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
							onClick={() => setReplyStatus("open")}
							className="-ml-2 flex h-6 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-ghost-hover hover:text-foreground"
						>
							<CommentIcon size={12} strokeWidth={2} />
							Reply
						</button>
						{threadInfo && (
							<button
								type="button"
								onClick={() => void handleResolve()}
								disabled={isResolving}
								className="-mr-2 ml-auto flex h-6 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-ghost-hover hover:text-foreground disabled:opacity-45"
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

export function PendingCommentBubble({
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
						className="h-7 rounded-md px-2.5 text-xs font-medium text-text-header transition-colors hover:bg-ghost-hover"
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
						className="flex h-7 items-center gap-1.5 rounded-md bg-button px-3 text-xs font-medium text-foreground shadow-button transition-colors hover:bg-button-hover disabled:pointer-events-none disabled:opacity-45"
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
					className="-mr-1 ml-auto flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-ghost-hover hover:text-foreground"
				>
					<EditIcon size={12} strokeWidth={2} />
				</button>
			</div>
			<AppMarkdown className="text-text-strong">{comment.body}</AppMarkdown>
		</div>
	);
}
