import { toast } from "@diffkit/ui/components/sonner";
import { cn } from "@diffkit/ui/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
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

function patchCommentReactions(
	prev: IssuePageData | PullPageData | undefined,
	commentId: number,
	content: CommentReactionContent,
	remove: boolean,
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
		const base = c.reactions ?? { counts: {}, viewerReacted: [] };
		const counts = { ...base.counts };
		const viewerReacted = [...base.viewerReacted];
		if (remove) {
			counts[content] = Math.max(0, (counts[content] ?? 0) - 1);
			const i = viewerReacted.indexOf(content);
			if (i >= 0) {
				viewerReacted.splice(i, 1);
			}
		} else {
			counts[content] = (counts[content] ?? 0) + 1;
			if (!viewerReacted.includes(content)) {
				viewerReacted.push(content);
			}
		}
		return { ...c, reactions: { counts, viewerReacted } };
	});

	if (!changed) {
		return prev;
	}
	return { ...prev, comments };
}

export function IssueCommentReactionBar({
	owner,
	repo,
	issueNumber,
	commentId,
	commentGraphqlId,
	scope,
	reactions,
}: {
	owner: string;
	repo: string;
	issueNumber: number;
	commentId: number;
	commentGraphqlId: string;
	scope: GitHubQueryScope;
	reactions?: CommentReactionSummary;
}) {
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
			queryClient.setQueryData(
				issuePageKey,
				patchCommentReactions(prevIssue, commentId, content, remove),
			);
			queryClient.setQueryData(
				pullPageKey,
				patchCommentReactions(prevPull, commentId, content, remove),
			);
			return { prevIssue, prevPull };
		},
		[commentId, issuePageKey, pullPageKey, queryClient],
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
					commentId,
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

	return (
		<div className="mt-1.5 flex flex-wrap items-center gap-1">
			{QUICK_REACTIONS.map(({ content, emoji }) => {
				const count = reactions?.counts[content] ?? 0;
				const active = reactions?.viewerReacted.includes(content) ?? false;
				return (
					<button
						key={content}
						type="button"
						onClick={() => void handleToggle(content)}
						className={cn(
							"inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors",
							active
								? "border-accent-foreground/30 bg-accent/15 text-foreground"
								: "border-transparent bg-surface-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground",
							count === 0 &&
								"hidden group-hover/comment:inline-flex group-focus-within/comment:inline-flex",
						)}
						aria-label={`React with ${content}`}
					>
						<span aria-hidden>{emoji}</span>
						{count > 0 && (
							<span className="min-w-[1ch] tabular-nums">{count}</span>
						)}
					</button>
				);
			})}
		</div>
	);
}
