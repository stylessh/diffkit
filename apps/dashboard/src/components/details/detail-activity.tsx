import {
	ArrowUpIcon,
	ChevronDownIcon,
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
	githubRepoCollaboratorsQueryOptions,
	githubViewerQueryOptions,
} from "#/lib/github.query";
import type { GitHubActor } from "#/lib/github.types";
import {
	invalidateGitHubEntities,
	issueEntityKey,
	pullEntityKey,
	pullOrIssueEntityKeys,
	removePullFromOpenViews,
} from "#/lib/github-query-updates";
import { checkPermissionWarning } from "#/lib/warning-store";

export function DetailActivityHeader({
	title,
	count,
}: {
	title: string;
	count?: number;
}) {
	return (
		<div className="flex items-center justify-between gap-2 border-t-[0.5px] border-header-rule pt-6 pb-4">
			<h2 className="text-[15px] leading-[1.5] font-semibold text-foreground">
				{title}
			</h2>
			{count != null && (
				<span className="text-[13px] tabular-nums text-muted-foreground">
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
	stateToggle,
}: {
	owner: string;
	repo: string;
	issueNumber: number;
	scope: GitHubQueryScope;
	involvedUsers?: GitHubActor[];
	/** Omitted when the item can't be closed or reopened (e.g. a merged PR). */
	stateToggle?: { kind: "pull" | "issue"; state: "open" | "closed" };
}) {
	const [value, setValue] = useState("");
	const [pendingAction, setPendingAction] = useState<
		"send" | "toggle-state" | null
	>(null);
	const isBusy = pendingAction !== null;
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

		if (viewerLogin) seen.add(viewerLogin);

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
		setPendingAction("send");
		try {
			const result = await createComment({
				data: { owner, repo, issueNumber, body: value.trim() },
			});
			if (result.ok) {
				setValue("");
				void invalidateGitHubEntities(
					queryClient,
					scope,
					pullOrIssueEntityKeys({ owner, repo, number: issueNumber }),
				);
			} else {
				toast.error(result.error);
				checkPermissionWarning(result, `${owner}/${repo}`);
			}
		} catch {
			toast.error("Failed to send comment");
		} finally {
			setPendingAction(null);
		}
	};

	const handleTogglePullState = async () => {
		if (stateToggle?.kind !== "pull") return;
		const pullState = stateToggle.state;
		const newState = pullState === "open" ? "closed" : "open";
		setPendingAction("toggle-state");
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
				if (newState === "closed") {
					removePullFromOpenViews(queryClient, scope, {
						owner,
						repo,
						pullNumber: issueNumber,
					});
				}
				void invalidateGitHubEntities(queryClient, scope, [
					pullEntityKey({ owner, repo, pullNumber: issueNumber }),
				]);
			} else {
				toast.error(result.error);
				checkPermissionWarning(result, `${owner}/${repo}`);
			}
		} catch {
			toast.error(
				`Failed to ${pullState === "open" ? "close" : "reopen"} pull request`,
			);
		} finally {
			setPendingAction(null);
		}
	};

	const runIssueStateChange = async (
		next: "open" | "closed",
		closeReason?: "completed" | "not_planned",
	) => {
		setPendingAction("toggle-state");
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
				void invalidateGitHubEntities(queryClient, scope, [
					issueEntityKey({ owner, repo, issueNumber }),
				]);
			} else {
				toast.error(result.error);
				checkPermissionWarning(result, `${owner}/${repo}`);
			}
		} catch {
			toast.error(`Failed to ${next === "closed" ? "close" : "reopen"} issue`);
		} finally {
			setPendingAction(null);
		}
	};

	return (
		<div className="-mx-3 flex flex-col">
			<MarkdownEditor
				ref={editorRef}
				scrollAnchorRef={commentActionsRef}
				value={value}
				onChange={setValue}
				placeholder="Leave a comment…"
				compact
				media={mediaUpload}
				onPaste={onMediaPaste}
				mentions={{
					candidates: mentionCandidates,
					onActivate: () => setMentionActivated(true),
					isLoading: collaboratorsQuery.isLoading && mentionActivated,
				}}
				footer={
					<div ref={commentActionsRef} className="flex items-center gap-2">
						{stateToggle?.kind === "issue" &&
							(stateToggle.state === "open" ? (
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<button
											type="button"
											disabled={isBusy}
											className="flex h-7 items-center gap-1.5 rounded-full bg-button px-2.5 text-xs font-medium text-text-header shadow-button transition-colors hover:bg-button-hover hover:text-foreground disabled:opacity-40"
										>
											{pendingAction === "toggle-state" ? (
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
											disabled={isBusy}
											className="text-merged focus:bg-pill-merged focus:text-merged data-[highlighted]:bg-pill-merged data-[highlighted]:text-merged"
											onClick={() =>
												void runIssueStateChange("closed", "completed")
											}
										>
											<IssueClosedCompletedIcon
												className="size-4 shrink-0 text-merged"
												size={16}
												strokeWidth={2}
											/>
											Close as completed
										</DropdownMenuItem>
										<DropdownMenuItem
											disabled={isBusy}
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
									disabled={isBusy}
									onClick={() => void runIssueStateChange("open")}
									className="flex h-7 items-center gap-1.5 rounded-full bg-button px-2.5 text-xs font-medium text-text-header shadow-button transition-colors hover:bg-button-hover hover:text-foreground disabled:opacity-40"
								>
									{pendingAction === "toggle-state" ? (
										<Spinner size={12} />
									) : (
										<IssuesIcon size={12} strokeWidth={2} />
									)}
									Re-open issue
								</button>
							))}
						{stateToggle?.kind === "pull" && (
							<button
								type="button"
								disabled={isBusy || hasPendingUploads}
								onClick={handleTogglePullState}
								className="flex h-7 items-center gap-1.5 rounded-full bg-button px-2.5 text-xs font-medium text-text-header shadow-button transition-colors hover:bg-button-hover hover:text-foreground disabled:opacity-40"
							>
								{pendingAction === "toggle-state" ? (
									<Spinner size={12} />
								) : stateToggle.state === "open" ? (
									<GitPullRequestClosedIcon size={12} strokeWidth={2} />
								) : (
									<GitPullRequestIcon size={12} strokeWidth={2} />
								)}
								{stateToggle.state === "open" ? "Close PR" : "Re-open PR"}
							</button>
						)}
						<button
							type="button"
							aria-label="Send comment"
							title="Send comment"
							disabled={!value.trim() || isBusy || hasPendingUploads}
							onClick={handleSend}
							className="flex size-7 items-center justify-center rounded-full bg-send text-text-strong shadow-send transition-opacity hover:text-foreground disabled:opacity-40"
						>
							{pendingAction === "send" ? (
								<Spinner size={12} />
							) : (
								<ArrowUpIcon size={14} strokeWidth={2} />
							)}
						</button>
					</div>
				}
			/>
		</div>
	);
}
