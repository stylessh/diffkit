import { CommentIcon } from "@diffkit/icons";
import { cn } from "@diffkit/ui/lib/utils";
import { memo, useState } from "react";
import {
	CommentBody,
	EditedMark,
	useCommentEditor,
} from "#/components/details/comment-body";
import { CommentMoreMenu } from "#/components/details/comment-more-menu";
import {
	hasReactions,
	IssueCommentReactionBar,
} from "#/components/details/comment-reaction-bar";
import { CommentReplyForm } from "#/components/details/comment-reply-form";
import type { GitHubQueryScope } from "#/lib/github.query";
import type { IssueComment } from "#/lib/github.types";
import { usePrefersNoHover } from "#/lib/use-prefers-no-hover";
import { RelativeTime } from "./relative-time";

type CommentTarget = {
	owner: string;
	repo: string;
	/** Pull requests take issue comments under their own number. */
	issueNumber: number;
	scope: GitHubQueryScope;
	viewerLogin?: string;
};

function CommentBubble({
	comment,
	owner,
	repo,
	issueNumber,
	scope,
	viewerLogin,
	onReply,
}: CommentTarget & {
	comment: IssueComment;
	onReply: () => void;
}) {
	const [commentActive, setCommentActive] = useState(false);
	const editor = useCommentEditor({
		kind: "issue",
		owner,
		repo,
		number: issueNumber,
		commentId: comment.id,
	});
	const prefersNoHover = usePrefersNoHover();

	const reactionBarProps = comment.graphqlId
		? {
				revealZeroCount: commentActive || prefersNoHover,
				viewerLogin,
				owner,
				repo,
				issueNumber,
				commentId: comment.id,
				commentGraphqlId: comment.graphqlId,
				scope,
				reactions: comment.reactions,
			}
		: null;
	const reacted = hasReactions(comment.reactions);

	return (
		<div
			className="group/comment relative flex flex-col gap-[6.5px] px-[16.5px] pt-[13.5px] pb-3"
			onPointerEnter={() => setCommentActive(true)}
			onPointerLeave={() => setCommentActive(false)}
			onFocusCapture={() => setCommentActive(true)}
			onBlurCapture={(e) => {
				if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
					setCommentActive(false);
				}
			}}
		>
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
					<RelativeTime date={comment.createdAt} />
				</span>
				<EditedMark editedAt={comment.editedAt} />
				<div className="ml-auto flex items-center gap-1">
					{reactionBarProps && !reacted ? (
						<IssueCommentReactionBar
							className="opacity-0 transition-opacity group-hover/comment:opacity-100 focus-within:opacity-100"
							{...reactionBarProps}
						/>
					) : null}
					<button
						type="button"
						onClick={onReply}
						aria-label="Reply"
						className="flex size-7 items-center justify-center rounded-md text-text-header opacity-0 transition-opacity hover:bg-ghost-hover group-hover/comment:opacity-100 focus-visible:opacity-100"
					>
						<CommentIcon size={14} strokeWidth={2} />
					</button>
					<CommentMoreMenu
						commentId={comment.id}
						body={comment.body}
						owner={owner}
						repo={repo}
						number={issueNumber}
						commentType="issue"
						editor={editor}
						isAuthor={
							viewerLogin != null && comment.author?.login === viewerLogin
						}
					/>
				</div>
			</div>
			<div className="relative pl-[27px]">
				<CommentBody
					editor={editor}
					body={comment.body}
					owner={owner}
					repo={repo}
					className="text-[15px] leading-6 text-text-strong"
				/>
				{reactionBarProps && reacted ? (
					<IssueCommentReactionBar className="mt-2.5" {...reactionBarProps} />
				) : null}
			</div>
		</div>
	);
}

/** A top-level comment as a card, with its quoted replies and reply form underneath. */
export const CommentThread = memo(function CommentThread({
	comment,
	replies,
	isFirst,
	...target
}: CommentTarget & {
	comment: IssueComment;
	replies?: IssueComment[];
	isFirst: boolean;
}) {
	const [showReplyForm, setShowReplyForm] = useState(false);
	const openReplyForm = () => setShowReplyForm(true);

	return (
		<div
			className={cn(
				"relative -mx-[8.5px] my-2 flex flex-col rounded-lg border-[0.5px] border-border bg-card shadow-[var(--ln-main-shadow)]",
				isFirst && "mt-0",
			)}
		>
			<CommentBubble comment={comment} onReply={openReplyForm} {...target} />

			{replies && replies.length > 0 && (
				<div className="flex flex-col divide-y-[0.5px] divide-header-rule border-t-[0.5px] border-header-rule">
					{replies.map((reply) => (
						<CommentBubble
							key={reply.id}
							comment={reply}
							onReply={openReplyForm}
							{...target}
						/>
					))}
				</div>
			)}

			{showReplyForm && (
				<div className="border-t-[0.5px] border-header-rule px-3 py-3">
					<CommentReplyForm
						owner={target.owner}
						repo={target.repo}
						issueNumber={target.issueNumber}
						parentAuthor={comment.author?.login ?? "Unknown"}
						parentBody={comment.body}
						parentCommentId={comment.id}
						onClose={() => setShowReplyForm(false)}
					/>
				</div>
			)}
		</div>
	);
});
