import { toast } from "@diffkit/ui/components/sonner";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@diffkit/ui/components/tooltip";
import { cn } from "@diffkit/ui/lib/utils";
import NumberFlow from "@number-flow/react";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { Fragment, useCallback, useRef } from "react";
import { toggleIssueCommentReaction } from "#/lib/github.functions";
import { type GitHubQueryScope, githubQueryKeys } from "#/lib/github.query";
import type {
	CommentReactionContent,
	CommentReactionSummary,
	IssuePageData,
	PullPageData,
} from "#/lib/github.types";
import { checkPermissionWarning } from "#/lib/warning-store";

const REACTION_EMOJI: Record<CommentReactionContent, string> = {
	"+1": "👍",
	"-1": "👎",
	laugh: "😄",
	confused: "🙁",
	heart: "❤️",
	hooray: "🎉",
	rocket: "🚀",
	eyes: "👀",
};

/** Matches GitHub reaction types; order is 👍 👎 😄 🎉 🙁 ❤️ 🚀 👀 */
const QUICK_REACTIONS: { content: CommentReactionContent; emoji: string }[] = [
	{ content: "+1", emoji: REACTION_EMOJI["+1"] },
	{ content: "-1", emoji: REACTION_EMOJI["-1"] },
	{ content: "laugh", emoji: REACTION_EMOJI.laugh },
	{ content: "hooray", emoji: REACTION_EMOJI.hooray },
	{ content: "confused", emoji: REACTION_EMOJI.confused },
	{ content: "heart", emoji: REACTION_EMOJI.heart },
	{ content: "rocket", emoji: REACTION_EMOJI.rocket },
	{ content: "eyes", emoji: REACTION_EMOJI.eyes },
];

const reactionSpring = {
	type: "spring" as const,
	duration: 0.22,
	bounce: 0.12,
};

function reactionActorTooltipText(
	logins: string[] | undefined,
	total: number,
): string {
	if (total <= 0) {
		return "";
	}
	if (!logins?.length) {
		return total === 1 ? "1 reaction" : `${total} reactions`;
	}
	const shown = logins.slice(0, 10);
	const rest = total - shown.length;
	return rest > 0 ? `${shown.join(", ")} +${rest}` : shown.join(", ");
}

function applyReactionToggleToSummary(
	base: CommentReactionSummary | undefined,
	content: CommentReactionContent,
	remove: boolean,
	viewerLogin: string | undefined,
): CommentReactionSummary {
	const b = base ?? { counts: {}, viewerReacted: [] };
	const counts = { ...b.counts };
	const viewerReacted = [...b.viewerReacted];
	const userLoginsByContent: Partial<Record<CommentReactionContent, string[]>> =
		{ ...(b.userLoginsByContent ?? {}) };
	const loginsFor = [...(userLoginsByContent[content] ?? [])];

	if (remove) {
		counts[content] = Math.max(0, (counts[content] ?? 0) - 1);
		const i = viewerReacted.indexOf(content);
		if (i >= 0) {
			viewerReacted.splice(i, 1);
		}
		if (viewerLogin) {
			const li = loginsFor.lastIndexOf(viewerLogin);
			if (li >= 0) {
				loginsFor.splice(li, 1);
			}
		}
	} else {
		counts[content] = (counts[content] ?? 0) + 1;
		if (!viewerReacted.includes(content)) {
			viewerReacted.push(content);
		}
		if (viewerLogin && !loginsFor.includes(viewerLogin)) {
			loginsFor.push(viewerLogin);
		}
	}

	if (loginsFor.length === 0) {
		delete userLoginsByContent[content];
	} else {
		userLoginsByContent[content] = loginsFor;
	}

	return {
		counts,
		viewerReacted,
		...(Object.keys(userLoginsByContent).length > 0
			? { userLoginsByContent }
			: {}),
	};
}

function patchCommentReactions(
	prev: IssuePageData | PullPageData | undefined,
	commentId: number,
	content: CommentReactionContent,
	remove: boolean,
	viewerLogin: string | undefined,
): IssuePageData | PullPageData | undefined {
	if (!prev?.comments?.length) {
		return prev;
	}

	let changed = false;
	const comments = prev.comments.map((c) => {
		if (c.id !== commentId) {
			return c;
		}
		changed = true;
		return {
			...c,
			reactions: applyReactionToggleToSummary(
				c.reactions,
				content,
				remove,
				viewerLogin,
			),
		};
	});

	if (!changed) {
		return prev;
	}
	return { ...prev, comments };
}

function patchDetailReactions<T extends IssuePageData | PullPageData>(
	prev: T | undefined,
	content: CommentReactionContent,
	remove: boolean,
	viewerLogin: string | undefined,
): T | undefined {
	if (!prev?.detail) {
		return prev;
	}
	return {
		...prev,
		detail: {
			...prev.detail,
			reactions: applyReactionToggleToSummary(
				prev.detail.reactions,
				content,
				remove,
				viewerLogin,
			),
		},
	};
}

type IssueCommentReactionBarSharedProps = {
	owner: string;
	repo: string;
	issueNumber: number;
	commentGraphqlId: string;
	scope: GitHubQueryScope;
	reactions?: CommentReactionSummary;
	className?: string;
	/** When true, show reactions that have zero total count (hover / focus-within). */
	revealZeroCount: boolean;
	viewerLogin?: string | null;
};

export type IssueCommentReactionBarProps =
	| (IssueCommentReactionBarSharedProps & {
			variant?: "comment";
			commentId: number;
	  })
	| (IssueCommentReactionBarSharedProps & {
			variant: "detail";
			detailPage: "issue" | "pull";
	  });

export function IssueCommentReactionBar(props: IssueCommentReactionBarProps) {
	const {
		owner,
		repo,
		issueNumber,
		commentGraphqlId,
		scope,
		reactions,
		className,
		revealZeroCount,
		viewerLogin,
	} = props;
	const isDetail = props.variant === "detail";
	const detailPage = isDetail ? props.detailPage : undefined;
	const commentId = !isDetail ? props.commentId : undefined;

	const queryClient = useQueryClient();
	const flight = useRef(false);

	const issuePageKey = githubQueryKeys.issues.page(scope, {
		owner,
		repo,
		issueNumber,
	});
	const pullPageKey = githubQueryKeys.pulls.page(scope, {
		owner,
		repo,
		pullNumber: issueNumber,
	});

	const applyOptimistic = useCallback(
		(content: CommentReactionContent, remove: boolean) => {
			const prevIssue = queryClient.getQueryData<IssuePageData>(issuePageKey);
			const prevPull = queryClient.getQueryData<PullPageData>(pullPageKey);
			const viewer = viewerLogin ?? undefined;
			if (isDetail && detailPage === "issue") {
				queryClient.setQueryData(
					issuePageKey,
					patchDetailReactions(prevIssue, content, remove, viewer),
				);
			} else if (isDetail && detailPage === "pull") {
				queryClient.setQueryData(
					pullPageKey,
					patchDetailReactions(prevPull, content, remove, viewer),
				);
			} else if (!isDetail && commentId != null) {
				queryClient.setQueryData(
					issuePageKey,
					patchCommentReactions(prevIssue, commentId, content, remove, viewer),
				);
				queryClient.setQueryData(
					pullPageKey,
					patchCommentReactions(prevPull, commentId, content, remove, viewer),
				);
			}
			return { prevIssue, prevPull };
		},
		[
			commentId,
			detailPage,
			isDetail,
			issuePageKey,
			pullPageKey,
			queryClient,
			viewerLogin,
		],
	);

	const rollback = useCallback(
		(snapshot: {
			prevIssue: IssuePageData | undefined;
			prevPull: PullPageData | undefined;
		}) => {
			queryClient.setQueryData(issuePageKey, snapshot.prevIssue);
			queryClient.setQueryData(pullPageKey, snapshot.prevPull);
		},
		[issuePageKey, pullPageKey, queryClient],
	);

	const handleToggle = async (content: CommentReactionContent) => {
		if (flight.current) {
			return;
		}
		const remove = reactions?.viewerReacted.includes(content) ?? false;
		flight.current = true;
		const snapshot = applyOptimistic(content, remove);
		try {
			const result = await toggleIssueCommentReaction({
				data: {
					owner,
					repo,
					issueNumber,
					commentId: props.variant === "detail" ? 0 : props.commentId,
					commentGraphqlId,
					content,
					remove,
				},
			});
			if (!result.ok) {
				rollback(snapshot);
				toast.error(result.error);
				checkPermissionWarning(result, `${owner}/${repo}`);
			}
		} catch {
			rollback(snapshot);
			toast.error("Failed to update reaction");
		} finally {
			flight.current = false;
		}
	};

	const counts = reactions?.counts ?? {};
	const orderedReactions = [
		...QUICK_REACTIONS.filter((item) => (counts[item.content] ?? 0) > 0),
		...(revealZeroCount
			? QUICK_REACTIONS.filter((item) => (counts[item.content] ?? 0) === 0)
			: []),
	];

	return (
		<LayoutGroup>
			<motion.div
				layout
				className={cn("flex flex-wrap items-center gap-1", className)}
				transition={reactionSpring}
			>
				<AnimatePresence initial={false} mode="popLayout">
					{orderedReactions.map(({ content, emoji }) => {
						const count = counts[content] ?? 0;
						const active = reactions?.viewerReacted.includes(content) ?? false;
						const tooltipText = reactionActorTooltipText(
							reactions?.userLoginsByContent?.[content],
							count,
						);
						const chip = (
							<motion.button
								key={content}
								type="button"
								layout
								initial={{ opacity: 0, scale: 0.82 }}
								animate={{ opacity: 1, scale: 1 }}
								exit={{ opacity: 0, scale: 0.82 }}
								transition={reactionSpring}
								onClick={() => void handleToggle(content)}
								className={cn(
									"relative inline-flex h-6 items-center gap-2 rounded-full border px-2.5 text-xs transition-colors",
									"border-transparent text-muted-foreground hover:bg-surface-2 hover:text-foreground",
									active
										? "bg-surface-2 hover:bg-surface-1 hover:text-foreground"
										: "bg-surface-1 hover:bg-surface-2 hover:text-foreground",
								)}
								aria-label={`React with ${content}`}
							>
								<span
									aria-hidden
									className={cn(content === "eyes" && "translate-y-px")}
								>
									{emoji}
								</span>
								<AnimatePresence initial={false} mode="popLayout">
									{count > 0 ? (
										<motion.span
											key="count"
											layout
											initial={{ opacity: 0, scale: 0.88 }}
											animate={{ opacity: 1, scale: 1 }}
											exit={{ opacity: 0, scale: 0.88 }}
											transition={reactionSpring}
											className="inline-flex min-w-[1ch] items-center"
										>
											<NumberFlow value={count} className="tabular-nums" />
										</motion.span>
									) : null}
								</AnimatePresence>
							</motion.button>
						);
						return count > 0 ? (
							<Tooltip key={content} delayDuration={300}>
								<TooltipTrigger asChild>{chip}</TooltipTrigger>
								<TooltipContent
									side="top"
									className="max-w-xs text-xs leading-snug"
								>
									{tooltipText}
								</TooltipContent>
							</Tooltip>
						) : (
							<Fragment key={content}>{chip}</Fragment>
						);
					})}
				</AnimatePresence>
			</motion.div>
		</LayoutGroup>
	);
}
