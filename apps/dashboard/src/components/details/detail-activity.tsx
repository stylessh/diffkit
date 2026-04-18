import {
	ChevronDownIcon,
	CommentIcon,
	GitPullRequestClosedIcon,
	GitPullRequestIcon,
	IssueClosedCompletedIcon,
	IssueClosedNotPlannedIcon,
	IssuesIcon,
} from "@diffkit/icons";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@diffkit/ui/components/dropdown-menu";
import {
	MarkdownEditor,
	type MarkdownEditorHandle,
	type MentionCandidate,
} from "@diffkit/ui/components/markdown-editor";
import { toast } from "@diffkit/ui/components/sonner";
import { Spinner } from "@diffkit/ui/components/spinner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { useCommentMediaUpload } from "#/hooks/use-comment-media-upload";
import {
	createComment,
	updateIssueState,
	updatePullState,
} from "#/lib/github.functions";
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
	issueState,
}: {
	owner: string;
	repo: string;
	issueNumber: number;
	scope: GitHubQueryScope;
	involvedUsers?: GitHubActor[];
	pullState?: "open" | "closed";
	issueState?: "open" | "closed";
}) {
	const [value, setValue] = useState("");
	const [isSending, setIsSending] = useState(false);
	const [isTogglingState, setIsTogglingState] = useState(false);
	const [isTogglingIssueState, setIsTogglingIssueState] = useState(false);
	const [mentionActivated, setMentionActivated] = useState(false);
	const queryClient = useQueryClient();
	const editorRef = useRef<MarkdownEditorHandle>(null);
	const commentActionsRef = useRef<HTMLDivElement>(null);
	const {
		media: mediaUpload,
		onPaste: onMediaPaste,
		pendingUploads,
	} = useCommentMediaUpload(editorRef);
	const hasPendingUploads = pendingUploads > 0;

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
				const commentResult = await createComment({
					data: { owner, repo, issueNumber, body: value.trim() },
				});
				if (!commentResult.ok) {
					toast.error(commentResult.error);
					checkPermissionWarning(commentResult, `${owner}/${repo}`);
					return;
				}
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

	const runIssueStateChange = async (
		next: "open" | "closed",
		closeReason?: "completed" | "not_planned",
	) => {
		setIsTogglingIssueState(true);
		try {
			if (value.trim()) {
				const commentResult = await createComment({
					data: { owner, repo, issueNumber, body: value.trim() },
				});
				if (!commentResult.ok) {
					toast.error(commentResult.error);
					checkPermissionWarning(commentResult, `${owner}/${repo}`);
					return;
				}
				setValue("");
			}
			const result = await updateIssueState({
				data: {
					owner,
					repo,
					issueNumber,
					state: next,
					...(next === "closed" && closeReason ? { closeReason } : {}),
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
			toast.error(`Failed to ${next === "closed" ? "close" : "reopen"} issue`);
		} finally {
			setIsTogglingIssueState(false);
		}
	};

	return (
		<div className="flex flex-col gap-2">
			<MarkdownEditor
				ref={editorRef}
				scrollAnchorRef={commentActionsRef}
				value={value}
				onChange={setValue}
				placeholder="Leave a comment..."
				compact
				media={mediaUpload}
				onPaste={onMediaPaste}
				mentions={{
					candidates: mentionCandidates,
					onActivate: () => setMentionActivated(true),
					isLoading: collaboratorsQuery.isLoading && mentionActivated,
				}}
			/>
			<div
				ref={commentActionsRef}
				className="flex items-center justify-end gap-2 pb-3"
			>
				{issueState &&
					(issueState === "open" ? (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<button
									type="button"
									disabled={isTogglingIssueState}
									className="flex items-center gap-1.5 rounded-lg border bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground transition-opacity hover:bg-secondary/80 disabled:opacity-40"
								>
									{isTogglingIssueState ? (
										<Spinner size={12} />
									) : (
										<>
											<IssuesIcon size={12} strokeWidth={2} />
											<span>Close issue as</span>
											<ChevronDownIcon
												size={12}
												strokeWidth={2}
												className="opacity-70"
											/>
										</>
									)}
								</button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="min-w-[12rem]">
								<DropdownMenuItem
									disabled={isTogglingIssueState}
									className="text-violet-500 focus:bg-violet-500/15 focus:text-violet-500 data-[highlighted]:bg-violet-500/15 data-[highlighted]:text-violet-500"
									onClick={() =>
										void runIssueStateChange("closed", "completed")
									}
								>
									<IssueClosedCompletedIcon
										className="size-4 shrink-0 text-violet-500"
										size={16}
										strokeWidth={2}
									/>
									Close as completed
								</DropdownMenuItem>
								<DropdownMenuItem
									disabled={isTogglingIssueState}
									className="text-muted-foreground focus:bg-muted focus:text-muted-foreground data-[highlighted]:bg-muted data-[highlighted]:text-muted-foreground"
									onClick={() =>
										void runIssueStateChange("closed", "not_planned")
									}
								>
									<IssueClosedNotPlannedIcon
										className="size-4 shrink-0 text-muted-foreground"
										size={16}
										strokeWidth={2}
									/>
									Close as not planned
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					) : (
						<button
							type="button"
							disabled={isTogglingIssueState}
							onClick={() => void runIssueStateChange("open")}
							className="flex items-center gap-1.5 rounded-lg border bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground transition-opacity hover:bg-secondary/80 disabled:opacity-40"
						>
							{isTogglingIssueState ? (
								<Spinner size={12} />
							) : (
								<IssuesIcon size={12} strokeWidth={2} />
							)}
							Re-open issue
						</button>
					))}
				{pullState && (
					<button
						type="button"
						disabled={isTogglingState || hasPendingUploads}
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
					disabled={!value.trim() || isSending || hasPendingUploads}
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
