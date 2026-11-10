import {
	CheckIcon,
	ChevronDownIcon,
	ChevronUpIcon,
	CommentIcon,
} from "@diffkit/icons";
import { MarkdownEditor } from "@diffkit/ui/components/markdown-editor";
import { toast } from "@diffkit/ui/components/sonner";
import { Spinner } from "@diffkit/ui/components/spinner";
import type { DiffLineAnnotation } from "@pierre/diffs/react";
import { useQueryClient } from "@tanstack/react-query";
import {
	memo,
	type SetStateAction,
	Suspense,
	useMemo,
	useReducer,
	useState,
} from "react";
import { SkeletonBox } from "skullet/react";
import {
	CommentBody,
	EditedMark,
	useCommentEditor,
} from "#/components/details/comment-body";
import { CommentMoreMenu } from "#/components/details/comment-more-menu";
import { RelativeTime } from "#/components/details/timeline/relative-time";
import { LazyReviewCommentPatch } from "#/components/diffs/lazy-diff-code-view";
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
import { trimDiffHunk } from "./trim-diff-hunk";

export type ReviewThreadInfo = { threadId: string; isResolved: boolean };

type PullRef = { owner: string; repo: string; pullNumber: number };

const DIFF_LINE_HEIGHT_PX = 20;

const PATCH_OPTIONS = {
	diffStyle: "unified",
	lineDiffType: "none",
	hunkSeparators: "line-info",
	overflow: "scroll",
	disableFileHeader: true,
	unsafeCSS: [
		`:host { --diffs-font-family: 'Geist Mono Variable', 'SF Mono', ui-monospace, 'Cascadia Code', monospace; }`,
		`[data-diff] { border: none; border-radius: 0; overflow: hidden; }`,
		`[data-line-annotation] { font-family: 'Inter Variable', 'Inter', 'Avenir Next', ui-sans-serif, system-ui, sans-serif; }`,
		`[data-line-annotation] code { font-family: var(--diffs-font-family, var(--diffs-font-fallback)); }`,
		`[data-annotation-content] { background-color: transparent; }`,
	].join("\n"),
} as const;

/** What the thread's footer is busy with; replying and resolving never overlap on screen. */
type ThreadActivity =
	| { status: "idle" }
	| { status: "replying"; body: string }
	| { status: "sending"; body: string }
	| { status: "resolving" };

type ThreadEvent =
	| { type: "reply-opened" }
	| { type: "reply-edited"; body: SetStateAction<string> }
	| { type: "reply-cancelled" }
	| { type: "reply-submitted" }
	| { type: "reply-sent" }
	| { type: "reply-failed" }
	| { type: "resolve-started" }
	| { type: "resolve-settled" };

function threadReducer(
	state: ThreadActivity,
	event: ThreadEvent,
): ThreadActivity {
	switch (event.type) {
		case "reply-opened":
			return state.status === "idle" || state.status === "resolving"
				? { status: "replying", body: "" }
				: state;
		case "reply-edited":
			return state.status === "replying"
				? {
						status: "replying",
						body:
							typeof event.body === "function"
								? event.body(state.body)
								: event.body,
					}
				: state;
		case "reply-cancelled":
			return state.status === "replying" || state.status === "sending"
				? { status: "idle" }
				: state;
		case "reply-submitted":
			return state.status === "replying"
				? { status: "sending", body: state.body }
				: state;
		case "reply-sent":
			return state.status === "sending" ? { status: "idle" } : state;
		case "reply-failed":
			return state.status === "sending"
				? { status: "replying", body: state.body }
				: state;
		case "resolve-started":
			return state.status === "idle" ? { status: "resolving" } : state;
		case "resolve-settled":
			return state.status === "resolving" ? { status: "idle" } : state;
	}
}

function ReviewCommentBubble({
	comment,
	owner,
	repo,
	pullNumber,
	viewerLogin,
}: PullRef & {
	comment: PullReviewComment;
	viewerLogin?: string;
}) {
	const editor = useCommentEditor({
		kind: "review",
		owner,
		repo,
		number: pullNumber,
		commentId: comment.id,
	});
	return (
		<div className="group/comment relative px-3 py-2.5">
			<div className="mb-1.5 flex items-center gap-1.5">
				{comment.author ? (
					<img
						src={comment.author.avatarUrl}
						alt={comment.author.login}
						className="size-4 rounded-full ring-[0.5px] ring-chip-border"
					/>
				) : (
					<div className="size-4 rounded-full bg-surface-2" />
				)}
				<span className="text-[13px] font-medium">
					{comment.author?.login ?? "Unknown"}
				</span>
				<span className="text-[13px] text-muted-foreground">
					<RelativeTime date={comment.createdAt} />
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
			<CommentBody
				editor={editor}
				body={comment.body}
				owner={owner}
				repo={repo}
				className="text-[15px] leading-6 text-text-strong"
			/>
		</div>
	);
}

/** One inline review thread: its trimmed diff hunk with the comment, replies and reply/resolve actions on the commented line. */
export const ReviewCommentThread = memo(function ReviewCommentThread({
	comment,
	replies,
	owner,
	repo,
	pullNumber,
	viewerLogin,
	threadInfo,
}: PullRef & {
	comment: PullReviewComment;
	replies?: PullReviewComment[];
	viewerLogin?: string;
	threadInfo?: ReviewThreadInfo;
}) {
	const queryClient = useQueryClient();
	const [activity, dispatch] = useReducer(threadReducer, { status: "idle" });
	const [isCollapsed, setIsCollapsed] = useState(
		threadInfo?.isResolved ?? false,
	);

	const patch = useMemo(() => {
		const trimmed = trimDiffHunk(
			comment.diffHunk,
			comment.line,
			comment.startLine,
			comment.side,
		);
		return `--- a/${comment.path}\n+++ b/${comment.path}\n${trimmed}`;
	}, [
		comment.diffHunk,
		comment.line,
		comment.startLine,
		comment.side,
		comment.path,
	]);

	const lineAnnotations = useMemo(
		() =>
			comment.line == null
				? []
				: [
						{
							side:
								comment.side === "LEFT"
									? ("deletions" as const)
									: ("additions" as const),
							lineNumber: comment.line,
							metadata: comment,
						},
					],
		[comment],
	);

	const refreshPull = () =>
		void invalidateGitHubEntities(queryClient, null, [
			pullEntityKey({ owner, repo, pullNumber }),
		]);

	const sendReply = async (body: string) => {
		dispatch({ type: "reply-submitted" });
		try {
			const result = await replyToReviewComment({
				data: { owner, repo, pullNumber, commentId: comment.id, body },
			});
			if (result) {
				dispatch({ type: "reply-sent" });
				refreshPull();
			} else {
				toast.error("Failed to send reply");
				dispatch({ type: "reply-failed" });
			}
		} catch {
			toast.error("Failed to send reply");
			dispatch({ type: "reply-failed" });
		}
	};

	const toggleResolved = async (thread: ReviewThreadInfo) => {
		dispatch({ type: "resolve-started" });
		try {
			const mutate = thread.isResolved
				? unresolveReviewThread
				: resolveReviewThread;
			const result = await mutate({
				data: { owner, repo, threadId: thread.threadId },
			});
			if (result.ok) {
				if (!thread.isResolved) setIsCollapsed(true);
				refreshPull();
			} else {
				toast.error(result.error);
			}
		} catch {
			toast.error("Failed to update thread");
		} finally {
			dispatch({ type: "resolve-settled" });
		}
	};

	const footerActionClassName =
		"flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground";

	const renderAnnotation = (
		annotation: DiffLineAnnotation<PullReviewComment>,
	) => {
		const root = annotation.metadata;
		if (!root) return null;
		const bubbleProps = { owner, repo, pullNumber, viewerLogin };
		return (
			<div className="m-2 divide-y-[0.5px] overflow-hidden rounded-lg border-[0.5px] bg-surface-0">
				<ReviewCommentBubble comment={root} {...bubbleProps} />
				{replies?.map((reply) => (
					<ReviewCommentBubble
						key={reply.id}
						comment={reply}
						{...bubbleProps}
					/>
				))}
				<div className="flex items-center gap-2 px-3 py-2">
					{activity.status === "replying" || activity.status === "sending" ? (
						<div className="flex w-full flex-col gap-2">
							<MarkdownEditor
								value={activity.body}
								onChange={(body) => dispatch({ type: "reply-edited", body })}
								placeholder="Write a reply..."
								compact
							/>
							<div className="flex items-center justify-end gap-2">
								<button
									type="button"
									onClick={() => dispatch({ type: "reply-cancelled" })}
									className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
								>
									Cancel
								</button>
								<button
									type="button"
									onClick={() => void sendReply(activity.body.trim())}
									disabled={
										!activity.body.trim() || activity.status === "sending"
									}
									className="flex h-7 items-center gap-1.5 rounded-md bg-indigo px-3 text-xs font-medium text-indigo-foreground shadow-solid transition-colors hover:bg-indigo/90 disabled:opacity-50"
								>
									{activity.status === "sending" ? (
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
								onClick={() => dispatch({ type: "reply-opened" })}
								className={footerActionClassName}
							>
								<CommentIcon size={12} strokeWidth={2} />
								Reply
							</button>
							{threadInfo && (
								<button
									type="button"
									onClick={() => void toggleResolved(threadInfo)}
									disabled={activity.status === "resolving"}
									className={`ml-auto ${footerActionClassName}`}
								>
									{activity.status === "resolving" ? (
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
	};

	return (
		<div className="overflow-hidden rounded-lg border-[0.5px]">
			<div className="flex items-center gap-1.5 bg-surface-1 px-3 py-2 text-[13px] text-muted-foreground">
				{threadInfo?.isResolved && (
					<span className="flex items-center gap-1 text-xs font-medium text-success">
						<CheckIcon size={12} strokeWidth={2} />
						Resolved
					</span>
				)}
				<span className="min-w-0 truncate font-mono text-xs font-medium text-foreground">
					{comment.path}
				</span>
				<button
					type="button"
					onClick={() => setIsCollapsed(!isCollapsed)}
					className="ml-auto shrink-0 text-muted-foreground transition-colors hover:text-foreground"
					aria-label={isCollapsed ? "Expand thread" : "Collapse thread"}
				>
					{isCollapsed ? (
						<ChevronDownIcon size={14} strokeWidth={2} />
					) : (
						<ChevronUpIcon size={14} strokeWidth={2} />
					)}
				</button>
			</div>
			{!isCollapsed && comment.diffHunk && (
				<Suspense
					fallback={
						<SkeletonBox
							width="100%"
							height={(patch.split("\n").length - 3) * DIFF_LINE_HEIGHT_PX}
							radius={0}
						/>
					}
				>
					<LazyReviewCommentPatch
						patch={patch}
						options={PATCH_OPTIONS}
						lineAnnotations={lineAnnotations}
						renderAnnotation={renderAnnotation}
					/>
				</Suspense>
			)}
		</div>
	);
});
