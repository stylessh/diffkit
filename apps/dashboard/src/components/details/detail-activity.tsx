import {
	CommentIcon,
	GitPullRequestClosedIcon,
	GitPullRequestIcon,
} from "@diffkit/icons";
import {
	MarkdownEditor,
	type MentionCandidate,
} from "@diffkit/ui/components/markdown-editor";
import { toast } from "@diffkit/ui/components/sonner";
import { Spinner } from "@diffkit/ui/components/spinner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { createComment, updatePullState } from "#/lib/github.functions";
import {
	type GitHubQueryScope,
	githubQueryKeys,
	githubRepoCollaboratorsQueryOptions,
	githubViewerQueryOptions,
} from "#/lib/github.query";
import type { GitHubActor } from "#/lib/github.types";
import { checkPermissionWarning } from "#/lib/warning-store";

export function DetailActivityHeader({
	title,
	count,
}: {
	title: string;
	count?: number;
}) {
	return (
		<div className="flex items-center justify-between gap-2 rounded-lg bg-surface-1 px-4 py-2.5">
			<h2 className="text-xs font-medium">{title}</h2>
			{count != null && (
				<span className="text-xs tabular-nums text-muted-foreground">
					{count}
				</span>
			)}
		</div>
	);
}

export function DetailCommentBox({
	owner,
	repo,
	issueNumber,
	scope,
	involvedUsers,
	pullState,
}: {
	owner: string;
	repo: string;
	issueNumber: number;
	scope: GitHubQueryScope;
	involvedUsers?: GitHubActor[];
	pullState?: "open" | "closed";
}) {
	const [value, setValue] = useState("");
	const [isSending, setIsSending] = useState(false);
	const [isTogglingState, setIsTogglingState] = useState(false);
	const [mentionActivated, setMentionActivated] = useState(false);
	const queryClient = useQueryClient();

	const viewerQuery = useQuery(githubViewerQueryOptions(scope));
	const viewerLogin = viewerQuery.data?.login;

	const collaboratorsQuery = useQuery({
		...githubRepoCollaboratorsQueryOptions(scope, { owner, repo }),
		enabled: mentionActivated,
	});

	const mentionCandidates: MentionCandidate[] = useMemo(() => {
		const seen = new Set<string>();
		const candidates: MentionCandidate[] = [];

		// Exclude the current user
		if (viewerLogin) seen.add(viewerLogin);

		// Involved users first (commenters, reviewers, author)
		if (involvedUsers) {
			for (const user of involvedUsers) {
				if (seen.has(user.login)) continue;
				seen.add(user.login);
				candidates.push({
					id: user.login,
					label: user.login,
					avatarUrl: user.avatarUrl,
					secondary: user.type === "Bot" ? "Bot" : undefined,
				});
			}
		}

		// Remaining collaborators
		for (const c of collaboratorsQuery.data ?? []) {
			if (seen.has(c.login)) continue;
			seen.add(c.login);
			candidates.push({
				id: c.login,
				label: c.login,
				avatarUrl: c.avatarUrl,
				secondary: c.type === "Bot" ? "Bot" : undefined,
			});
		}

		return candidates;
	}, [viewerLogin, involvedUsers, collaboratorsQuery.data]);

	const handleSend = async () => {
		if (!value.trim()) return;
		setIsSending(true);
		try {
			const result = await createComment({
				data: { owner, repo, issueNumber, body: value.trim() },
			});
			if (result.ok) {
				setValue("");
				void queryClient.invalidateQueries({
					queryKey: githubQueryKeys.all,
				});
			} else {
				toast.error(result.error);
				checkPermissionWarning(result, `${owner}/${repo}`);
			}
		} catch {
			toast.error("Failed to send comment");
		} finally {
			setIsSending(false);
		}
	};

	const handleTogglePullState = async () => {
		if (!pullState) return;
		const newState = pullState === "open" ? "closed" : "open";
		setIsTogglingState(true);
		try {
			if (value.trim()) {
				await createComment({
					data: { owner, repo, issueNumber, body: value.trim() },
				});
				setValue("");
			}
			const result = await updatePullState({
				data: {
					owner,
					repo,
					pullNumber: issueNumber,
					state: newState,
				},
			});
			if (result.ok) {
				void queryClient.invalidateQueries({
					queryKey: githubQueryKeys.all,
				});
			} else {
				toast.error(result.error);
				checkPermissionWarning(result, `${owner}/${repo}`);
			}
		} catch {
			toast.error(
				`Failed to ${pullState === "open" ? "close" : "reopen"} pull request`,
			);
		} finally {
			setIsTogglingState(false);
		}
	};

	return (
		<div className="flex flex-col gap-2">
			<MarkdownEditor
				value={value}
				onChange={setValue}
				placeholder="Leave a comment..."
				compact
				mentions={{
					candidates: mentionCandidates,
					onActivate: () => setMentionActivated(true),
					isLoading: collaboratorsQuery.isLoading && mentionActivated,
				}}
			/>
			<div className="flex items-center justify-end gap-2">
				{pullState && (
					<button
						type="button"
						disabled={isTogglingState}
						onClick={handleTogglePullState}
						className="flex items-center gap-1.5 rounded-lg border bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground transition-opacity hover:bg-secondary/80 disabled:opacity-40"
					>
						{isTogglingState ? (
							<Spinner size={12} />
						) : pullState === "open" ? (
							<GitPullRequestClosedIcon size={12} strokeWidth={2} />
						) : (
							<GitPullRequestIcon size={12} strokeWidth={2} />
						)}
						{pullState === "open" ? "Close PR" : "Re-open PR"}
					</button>
				)}
				<button
					type="button"
					disabled={!value.trim() || isSending}
					onClick={handleSend}
					className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity disabled:opacity-40"
				>
					{isSending ? (
						<Spinner size={12} />
					) : (
						<CommentIcon size={12} strokeWidth={2} />
					)}
					Send
				</button>
			</div>
		</div>
	);
}
