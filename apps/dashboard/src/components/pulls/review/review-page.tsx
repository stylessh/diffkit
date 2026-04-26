import { FileIcon, GitPullRequestIcon, PanelLeftIcon } from "@diffkit/icons";
import {
	Drawer,
	DrawerContent,
	DrawerTitle,
} from "@diffkit/ui/components/drawer";
import type { MentionConfig } from "@diffkit/ui/components/markdown-editor";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@diffkit/ui/components/resizable";
import { toast } from "@diffkit/ui/components/sonner";
import { cn } from "@diffkit/ui/lib/utils";
import type { SelectedLineRange } from "@pierre/diffs";
import type { DiffLineAnnotation } from "@pierre/diffs/react";
import {
	useInfiniteQuery,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import {
	lazy,
	memo,
	Suspense,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import { getPrStateConfig } from "#/components/pulls/detail/pull-detail-header";
import { FileSearchCard } from "#/components/shared/file-search-card";
import { submitPullReview } from "#/lib/github.functions";
import {
	githubPullFileSummariesQueryOptions,
	githubPullFilesInfiniteQueryOptions,
	githubPullPageQueryOptions,
	githubPullReviewCommentsQueryOptions,
	githubQueryKeys,
	githubRepoCollaboratorsQueryOptions,
	githubReviewThreadStatusesQueryOptions,
	githubViewerQueryOptions,
} from "#/lib/github.query";
import type {
	GitHubActor,
	PullDetail,
	PullFileSummary,
	PullReviewComment,
} from "#/lib/github.types";
import { githubRevalidationSignalKeys } from "#/lib/github-revalidation";
import { useGitHubSignalStream } from "#/lib/use-github-signal-stream";
import { usePageTitle } from "#/lib/use-page-title";
import { useRegisterTab } from "#/lib/use-register-tab";
import { checkPermissionWarning } from "#/lib/warning-store";
import type { ReviewDiffPaneHandle } from "./review-diff-pane";
import {
	type ActiveFileStore,
	createActiveFileStore,
	ReviewVirtualizedFileTree,
} from "./review-file-tree";
import { ReviewSubmitPopover } from "./review-submit-popover";
import type {
	ActiveCommentForm,
	PendingComment,
	ReviewEvent,
} from "./review-types";
import { buildFileTree, encodeFileId } from "./review-utils";

const routeApi = getRouteApi("/_protected/$owner/$repo/review/$pullId");
const reviewDiffPaneImport = import("./review-diff-pane");
const ReviewDiffPane = lazy(() =>
	reviewDiffPaneImport.then((mod) => ({
		default: mod.ReviewDiffPane,
	})),
);

const MD_QUERY = "(min-width: 768px)";
const mdSubscribe = (cb: () => void) => {
	const mql = window.matchMedia(MD_QUERY);
	mql.addEventListener("change", cb);
	return () => mql.removeEventListener("change", cb);
};
const getMdSnapshot = () => window.matchMedia(MD_QUERY).matches;
const getMdServerSnapshot = () => true;

function useIsDesktop() {
	return useSyncExternalStore(mdSubscribe, getMdSnapshot, getMdServerSnapshot);
}

export function ReviewPage() {
	const { user } = routeApi.useRouteContext();
	const { owner, repo, pullId } = routeApi.useParams();
	const navigate = useNavigate();
	const pullNumber = Number(pullId);
	const scope = useMemo(() => ({ userId: user.id }), [user.id]);
	const queryClient = useQueryClient();
	const input = useMemo(
		() => ({ owner, repo, pullNumber }),
		[owner, repo, pullNumber],
	);
	const pageQueryKey = useMemo(
		() => githubQueryKeys.pulls.page(scope, input),
		[scope, input],
	);
	const fileSummariesQueryKey = useMemo(
		() => githubQueryKeys.pulls.fileSummaries(scope, input),
		[scope, input],
	);
	const filesQueryKey = useMemo(
		() => githubQueryKeys.pulls.files(scope, input),
		[scope, input],
	);
	const reviewCommentsQueryKey = useMemo(
		() => githubQueryKeys.pulls.reviewComments(scope, input),
		[scope, input],
	);
	const pullSignalKey = githubRevalidationSignalKeys.pullEntity(input);
	const webhookRefreshTargets = useMemo(
		() => [
			{ queryKey: pageQueryKey, signalKeys: [pullSignalKey] },
			{ queryKey: fileSummariesQueryKey, signalKeys: [pullSignalKey] },
			{ queryKey: filesQueryKey, signalKeys: [pullSignalKey] },
			{ queryKey: reviewCommentsQueryKey, signalKeys: [pullSignalKey] },
		],
		[
			pageQueryKey,
			fileSummariesQueryKey,
			filesQueryKey,
			reviewCommentsQueryKey,
			pullSignalKey,
		],
	);
	const diffPaneRef = useRef<ReviewDiffPaneHandle>(null);

	// Stable store for active file — updates bypass ReviewPage renders entirely
	const activeFileStore = useRef(createActiveFileStore(null)).current;

	const pageQuery = useQuery({
		...githubPullPageQueryOptions(scope, input),
		refetchOnMount: false,
		refetchOnWindowFocus: false,
	});

	const fileSummariesQuery = useInfiniteQuery({
		...githubPullFileSummariesQueryOptions(scope, input),
		refetchOnMount: false,
		refetchOnWindowFocus: false,
	});

	// Auto-fetch remaining pages so the sidebar streams in the whole tree
	// without requiring user interaction. Each page is ~100 files, so for a
	// 3k-file PR this fires ~30 sequential worker calls in the background
	// while the sidebar renders incrementally.
	useEffect(() => {
		if (
			fileSummariesQuery.hasNextPage &&
			!fileSummariesQuery.isFetchingNextPage
		) {
			void fileSummariesQuery.fetchNextPage();
		}
	}, [
		fileSummariesQuery.hasNextPage,
		fileSummariesQuery.isFetchingNextPage,
		fileSummariesQuery.fetchNextPage,
	]);

	const filesQuery = useInfiniteQuery({
		...githubPullFilesInfiniteQueryOptions(scope, input),
		refetchOnMount: false,
		refetchOnWindowFocus: false,
	});

	// Auto-fetch remaining pages of patches in the background so that by the
	// time the user scrolls deeper into the PR, the data is already there.
	// Keeps the initial perPage small so the first-visible files render fast,
	// then streams the rest chunk-by-chunk behind the UI.
	useEffect(() => {
		if (filesQuery.hasNextPage && !filesQuery.isFetchingNextPage) {
			void filesQuery.fetchNextPage();
		}
	}, [
		filesQuery.hasNextPage,
		filesQuery.isFetchingNextPage,
		filesQuery.fetchNextPage,
	]);

	const hasDiffPayload = filesQuery.data !== undefined;
	const reviewCommentsQuery = useQuery({
		...githubPullReviewCommentsQueryOptions(scope, input),
		refetchOnWindowFocus: false,
	});
	const threadStatusesQuery = useQuery({
		...githubReviewThreadStatusesQueryOptions(scope, input),
		refetchOnWindowFocus: false,
	});
	useGitHubSignalStream(webhookRefreshTargets);

	const pr = pageQuery.data?.detail ?? null;
	const sidebarFiles = useMemo(
		() => fileSummariesQuery.data?.pages.flatMap((page) => page.items) ?? [],
		[fileSummariesQuery.data],
	);
	const diffFiles = useMemo(
		() => filesQuery.data?.pages.flatMap((page) => page.files) ?? [],
		[filesQuery.data],
	);
	const reviewComments = reviewCommentsQuery.data ?? [];

	usePageTitle(pr ? `Review: ${pr.title}` : null);

	// ── Mention support for inline comment forms ──────────────────────
	const [mentionActivated, setMentionActivated] = useState(false);
	const viewerQuery = useQuery(githubViewerQueryOptions(scope));
	const collaboratorsQuery = useQuery({
		...githubRepoCollaboratorsQueryOptions(scope, { owner, repo }),
		enabled: mentionActivated,
	});

	const mentionConfig: MentionConfig = useMemo(() => {
		const viewerLogin = viewerQuery.data?.login;
		const seen = new Set<string>();
		const candidates: MentionConfig["candidates"] = [];

		if (viewerLogin) seen.add(viewerLogin);

		const add = (actor: GitHubActor | null | undefined) => {
			if (!actor || seen.has(actor.login)) return;
			seen.add(actor.login);
			candidates.push({
				id: actor.login,
				label: actor.login,
				avatarUrl: actor.avatarUrl,
				secondary: actor.type === "Bot" ? "Bot" : undefined,
			});
		};

		// PR author first
		if (pr) {
			add(pr.author);
			for (const r of pr.requestedReviewers) add(r);
		}

		// Review commenters (most recent first)
		for (let i = reviewComments.length - 1; i >= 0; i--) {
			add(reviewComments[i].author);
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

		return {
			candidates,
			onActivate: () => setMentionActivated(true),
			isLoading: collaboratorsQuery.isLoading && mentionActivated,
		};
	}, [
		viewerQuery.data?.login,
		pr,
		reviewComments,
		collaboratorsQuery.data,
		collaboratorsQuery.isLoading,
		mentionActivated,
	]);

	const [diffStyle, setDiffStyle] = useState<"unified" | "split">("split");
	const [pendingComments, setPendingComments] = useState<PendingComment[]>([]);
	const [activeCommentForm, setActiveCommentForm] =
		useState<ActiveCommentForm | null>(null);
	const [selectedLines, setSelectedLines] = useState<SelectedLineRange | null>(
		null,
	);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [fileSheetOpen, setFileSheetOpen] = useState(false);
	const isDesktop = useIsDesktop();

	useRegisterTab(
		pr
			? {
					type: "review",
					title: pr.title,
					number: pr.number,
					url: `/${owner}/${repo}/review/${pullId}`,
					repo: `${owner}/${repo}`,
					iconColor: getPrStateConfig(pr).color,
					additions: pr.additions,
					deletions: pr.deletions,
					merged: pr.isMerged,
				}
			: null,
	);

	// Diff pane → sidebar active file sync (no ReviewPage re-render)
	const handleActiveFileChange = useCallback(
		(filename: string) => {
			activeFileStore.set(filename);
		},
		[activeFileStore],
	);

	const scrollToFile = useCallback(
		(filename: string) => {
			diffPaneRef.current?.scrollToFile(filename);
			activeFileStore.set(filename);
			setFileSheetOpen(false);
		},
		[activeFileStore],
	);

	const annotationsByFile = useMemo(() => {
		const map = new Map<string, DiffLineAnnotation<PullReviewComment>[]>();
		for (const comment of reviewComments) {
			if (comment.line == null || comment.inReplyToId != null) continue;
			const existing = map.get(comment.path) ?? [];
			existing.push({
				side: comment.side === "LEFT" ? "deletions" : "additions",
				lineNumber: comment.line,
				metadata: comment,
			});
			map.set(comment.path, existing);
		}
		return map;
	}, [reviewComments]);

	const repliesByCommentId = useMemo(() => {
		const map = new Map<number, PullReviewComment[]>();
		for (const comment of reviewComments) {
			if (comment.inReplyToId == null) continue;
			const existing = map.get(comment.inReplyToId) ?? [];
			existing.push(comment);
			map.set(comment.inReplyToId, existing);
		}
		return map;
	}, [reviewComments]);

	const threadInfoByCommentId = useMemo(() => {
		const map = new Map<number, { threadId: string; isResolved: boolean }>();
		for (const t of threadStatusesQuery.data ?? []) {
			map.set(t.firstCommentId, {
				threadId: t.threadId,
				isResolved: t.isResolved,
			});
		}
		return map;
	}, [threadStatusesQuery.data]);

	const pendingCommentsByFile = useMemo(() => {
		const map = new Map<string, PendingComment[]>();
		for (const comment of pendingComments) {
			const existing = map.get(comment.path) ?? [];
			existing.push(comment);
			map.set(comment.path, existing);
		}
		return map;
	}, [pendingComments]);

	// Read totals off the PR node (one cheap GraphQL call) instead of summing
	// streamed file summaries — otherwise the toolbar chip can't show real
	// numbers until every summary page arrives (~seconds for a 3k-file PR).
	const diffStats = {
		totalAdditions: pr?.additions ?? 0,
		totalDeletions: pr?.deletions ?? 0,
	};
	const prChangedFiles = pr?.changedFiles ?? 0;

	const addPendingComment = useCallback((comment: PendingComment) => {
		setPendingComments((previous) => [...previous, comment]);
		setActiveCommentForm(null);
	}, []);

	const handleEditComment = useCallback(
		(original: PendingComment, newBody: string) => {
			setPendingComments((previous) =>
				previous.map((c) =>
					c.path === original.path &&
					c.line === original.line &&
					c.side === original.side &&
					c.startLine === original.startLine
						? { ...c, body: newBody }
						: c,
				),
			);
		},
		[],
	);

	const handleCancelComment = useCallback(() => {
		setActiveCommentForm(null);
		setSelectedLines(null);
	}, []);

	const handleAddComment = useCallback(
		(comment: PendingComment) => {
			addPendingComment(comment);
			setSelectedLines(null);
		},
		[addPendingComment],
	);

	const handleStartComment = useCallback(
		(filename: string, range: SelectedLineRange) => {
			const isMultiLine = range.start !== range.end;
			const startIsSmaller = range.start <= range.end;
			const lineSide = startIsSmaller
				? (range.endSide ?? range.side)
				: range.side;
			const startLineSide = startIsSmaller
				? range.side
				: (range.endSide ?? range.side);
			const toGithubSide = (side: string | undefined) =>
				side === "deletions" ? ("LEFT" as const) : ("RIGHT" as const);

			setActiveCommentForm({
				path: filename,
				line: Math.max(range.start, range.end),
				side: toGithubSide(lineSide),
				...(isMultiLine
					? {
							startLine: Math.min(range.start, range.end),
							startSide: toGithubSide(startLineSide),
						}
					: {}),
			});
			setSelectedLines(range);
		},
		[],
	);

	const handleSubmitReview = useCallback(
		async (body: string, event: ReviewEvent): Promise<boolean> => {
			setIsSubmitting(true);
			try {
				const success = await submitPullReview({
					data: {
						owner,
						repo,
						pullNumber,
						body,
						event,
						comments: pendingComments.map((comment) => ({
							path: comment.path,
							line: comment.line,
							side: comment.side,
							body: comment.body,
							...(comment.startLine != null &&
							comment.startLine !== comment.line
								? {
										startLine: comment.startLine,
										startSide: comment.startSide ?? comment.side,
									}
								: {}),
						})),
					},
				});

				if (success) {
					setPendingComments([]);
					// Only invalidate queries scoped to this specific PR. Invalidating
					// `githubQueryKeys.all` would refetch every GitHub query in the
					// client (other repos, notifications, signals) for no reason.
					void queryClient.invalidateQueries({
						predicate: (query) => {
							const key = query.queryKey;
							if (key[0] !== "github") return false;
							for (let i = 2; i < key.length; i++) {
								const part = key[i];
								if (!part || typeof part !== "object") continue;
								const rec = part as Record<string, unknown>;
								if (
									rec.owner === owner &&
									rec.repo === repo &&
									(rec.pullNumber === pullNumber ||
										rec.issueNumber === pullNumber)
								) {
									return true;
								}
							}
							return false;
						},
					});
					void navigate({
						to: "/$owner/$repo/pull/$pullId",
						params: { owner, repo, pullId },
					});
				} else {
					toast.error("Failed to submit review");
				}

				return success;
			} catch (error) {
				console.error("[submitReview]", error);
				const message =
					error instanceof Error ? error.message : "Unknown error";
				const isAccessRestriction =
					message.includes("OAuth App access restrictions") ||
					message.includes("Insufficient permissions");
				checkPermissionWarning(
					{ ok: false, error: message },
					`${owner}/${repo}`,
				);
				if (!isAccessRestriction) {
					toast.error("Failed to submit review", {
						description: message,
					});
				}
				return false;
			} finally {
				setIsSubmitting(false);
			}
		},
		[navigate, owner, pendingComments, pullId, pullNumber, queryClient, repo],
	);

	// Ref-stable onLoadMore — avoids busting ReviewDiffPane memo
	const filesQueryRef = useRef(filesQuery);
	filesQueryRef.current = filesQuery;
	const handleLoadMore = useCallback(() => {
		const q = filesQueryRef.current;
		if (q.hasNextPage && !q.isFetchingNextPage) {
			void q.fetchNextPage();
		}
	}, []);

	if (pageQuery.error) throw pageQuery.error;
	if (fileSummariesQuery.error) throw fileSummariesQuery.error;
	if (filesQuery.error) throw filesQuery.error;
	if (reviewCommentsQuery.error) throw reviewCommentsQuery.error;

	if (!pr) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="size-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
			</div>
		);
	}

	const sidebarFileCount = sidebarFiles.length;
	const isStreamingSummaries =
		fileSummariesQuery.isFetching || fileSummariesQuery.hasNextPage;

	const diffContent = hasDiffPayload ? (
		<Suspense fallback={<ReviewDiffPanePlaceholder />}>
			<ReviewDiffPane
				ref={diffPaneRef}
				files={diffFiles}
				totalFileCount={sidebarFileCount}
				diffStyle={diffStyle}
				annotationsByFile={annotationsByFile}
				repliesByCommentId={repliesByCommentId}
				owner={owner}
				repo={repo}
				pullNumber={pullNumber}
				pendingCommentsByFile={pendingCommentsByFile}
				hasNextPage={filesQuery.hasNextPage}
				isFetchingNextPage={filesQuery.isFetchingNextPage}
				onLoadMore={handleLoadMore}
				activeCommentForm={activeCommentForm}
				selectedLines={selectedLines}
				onActiveFileChange={handleActiveFileChange}
				onStartComment={handleStartComment}
				onCancelComment={handleCancelComment}
				onAddComment={handleAddComment}
				onEditComment={handleEditComment}
				mentionConfig={mentionConfig}
				viewerLogin={viewerQuery.data?.login}
				threadInfoByCommentId={threadInfoByCommentId}
			/>
		</Suspense>
	) : (
		<ReviewDiffPanePlaceholder />
	);

	return (
		<div className="flex h-full flex-col">
			<ReviewToolbar
				owner={owner}
				repo={repo}
				pullId={pullId}
				pr={pr}
				sidebarFileCount={prChangedFiles}
				diffStats={diffStats}
				diffStyle={diffStyle}
				onSetDiffStyle={setDiffStyle}
				pendingCount={pendingComments.length}
				isSubmitting={isSubmitting}
				onSubmitReview={handleSubmitReview}
				onOpenFileSheet={() => setFileSheetOpen(true)}
				isDesktop={isDesktop}
			/>

			{isDesktop ? (
				<ResizablePanelGroup direction="horizontal" className="flex-1">
					<ResizablePanel defaultSize={20} minSize={12} maxSize={40}>
						<ReviewSidebar
							sidebarFiles={sidebarFiles}
							sidebarFileCount={sidebarFileCount}
							isStreamingSummaries={isStreamingSummaries}
							activeFileStore={activeFileStore}
							onFileClick={scrollToFile}
						/>
					</ResizablePanel>

					<ResizableHandle />

					<ResizablePanel defaultSize={80}>{diffContent}</ResizablePanel>
				</ResizablePanelGroup>
			) : (
				<>
					<div className="flex-1 overflow-hidden">{diffContent}</div>
					<Drawer open={fileSheetOpen} onOpenChange={setFileSheetOpen}>
						<DrawerContent className="max-h-[70dvh]">
							<DrawerTitle className="sr-only">Files</DrawerTitle>
							<ReviewSidebar
								sidebarFiles={sidebarFiles}
								sidebarFileCount={sidebarFileCount}
								isStreamingSummaries={isStreamingSummaries}
								activeFileStore={activeFileStore}
								onFileClick={scrollToFile}
							/>
						</DrawerContent>
					</Drawer>
				</>
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// ReviewToolbar — memoized, only re-renders when its own props change
// ---------------------------------------------------------------------------

const ReviewToolbar = memo(function ReviewToolbar({
	owner,
	repo,
	pullId,
	pr,
	sidebarFileCount,
	diffStats,
	diffStyle,
	onSetDiffStyle,
	pendingCount,
	isSubmitting,
	onSubmitReview,
	onOpenFileSheet,
	isDesktop,
}: {
	owner: string;
	repo: string;
	pullId: string;
	pr: PullDetail;
	sidebarFileCount: number;
	diffStats: { totalAdditions: number; totalDeletions: number };
	diffStyle: "unified" | "split";
	onSetDiffStyle: (style: "unified" | "split") => void;
	pendingCount: number;
	isSubmitting: boolean;
	onSubmitReview: (body: string, event: ReviewEvent) => Promise<boolean>;
	onOpenFileSheet: () => void;
	isDesktop: boolean;
}) {
	const stateConfig = getPrStateConfig(pr);
	const StateIcon = stateConfig.icon;

	return (
		<div className="flex shrink-0 items-center gap-2 border-b bg-surface-0 px-3 py-2 md:gap-3 md:px-4">
			{!isDesktop && (
				<button
					type="button"
					onClick={onOpenFileSheet}
					className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-1 hover:text-foreground"
					aria-label="Open file tree"
				>
					<PanelLeftIcon size={16} strokeWidth={2} />
				</button>
			)}

			<Link
				to="/$owner/$repo/pull/$pullId"
				params={{ owner, repo, pullId }}
				className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
			>
				<GitPullRequestIcon size={14} strokeWidth={2} />
				<span>#{pr.number}</span>
			</Link>

			<div className="hidden mx-1 h-4 w-px bg-border md:block" />

			<div className="hidden min-w-0 items-center gap-2 md:flex">
				<div className={cn("shrink-0", stateConfig.color)}>
					<StateIcon size={14} strokeWidth={2} />
				</div>
				<span className="truncate text-sm font-medium">{pr.title}</span>
			</div>

			<div className="ml-auto flex items-center gap-2 md:gap-3">
				<div className="flex items-center gap-2 text-xs text-muted-foreground">
					<span className="flex items-center gap-1">
						<FileIcon size={13} strokeWidth={2} />
						<span className="font-mono tabular-nums font-medium text-foreground">
							{sidebarFileCount}
						</span>
						<span className="hidden md:inline">
							{" "}
							{sidebarFileCount === 1 ? "file" : "files"}
						</span>
					</span>
					<span className="font-mono tabular-nums font-medium text-green-500">
						+{diffStats.totalAdditions}
					</span>
					<span className="font-mono tabular-nums font-medium text-red-500">
						-{diffStats.totalDeletions}
					</span>
				</div>

				<div className="h-4 w-px bg-border" />

				<div className="hidden items-center rounded-md border bg-surface-1 md:flex">
					<button
						type="button"
						className={cn(
							"rounded-l-md px-2.5 py-1 text-xs font-medium transition-colors",
							diffStyle === "unified"
								? "bg-surface-0 text-foreground shadow-sm"
								: "text-muted-foreground hover:text-foreground",
						)}
						onClick={() => onSetDiffStyle("unified")}
					>
						Unified
					</button>
					<button
						type="button"
						className={cn(
							"rounded-r-md px-2.5 py-1 text-xs font-medium transition-colors",
							diffStyle === "split"
								? "bg-surface-0 text-foreground shadow-sm"
								: "text-muted-foreground hover:text-foreground",
						)}
						onClick={() => onSetDiffStyle("split")}
					>
						Split
					</button>
				</div>

				<div className="hidden h-4 w-px bg-border md:block" />

				<ReviewSubmitPopover
					pendingCount={pendingCount}
					isSubmitting={isSubmitting}
					onSubmit={onSubmitReview}
				/>
			</div>
		</div>
	);
});

// ---------------------------------------------------------------------------
// ReviewSidebar — owns file filter state, reads activeFile from store
// ---------------------------------------------------------------------------

export const ReviewSidebar = memo(function ReviewSidebar({
	sidebarFiles,
	sidebarFileCount,
	isStreamingSummaries = false,
	activeFileStore,
	onFileClick,
}: {
	sidebarFiles: PullFileSummary[];
	sidebarFileCount: number;
	isStreamingSummaries?: boolean;
	activeFileStore: ActiveFileStore;
	onFileClick: (path: string) => void;
}) {
	const fileTree = useMemo(() => buildFileTree(sidebarFiles), [sidebarFiles]);

	const searchEntries = useMemo(
		() =>
			sidebarFiles.map((f) => ({
				path: f.filename,
				name: f.filename.split("/").pop() ?? f.filename,
				type: "file" as const,
			})),
		[sidebarFiles],
	);

	const activeFile = useSyncExternalStore(
		activeFileStore.subscribe,
		activeFileStore.get,
	);

	const handleSearchSelect = useCallback(
		(entry: { path: string }) => {
			onFileClick(entry.path);
			const hash = `#${encodeFileId(entry.path)}`;
			if (window.location.hash !== hash) {
				history.replaceState(null, "", hash);
			}
		},
		[onFileClick],
	);

	return (
		<div className="flex h-full flex-col">
			<FileSearchCard
				entries={searchEntries}
				onSelect={handleSearchSelect}
				activePath={activeFile ?? undefined}
				placeholder="Search files..."
				shortcutKey="f"
			/>

			<ReviewVirtualizedFileTree
				tree={fileTree}
				activeFileStore={activeFileStore}
				onFileClick={onFileClick}
			/>

			<div className="flex items-center gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
				<span>
					{sidebarFileCount} {sidebarFileCount === 1 ? "file" : "files"}
					{isStreamingSummaries ? " loaded…" : " changed"}
				</span>
				{isStreamingSummaries && (
					<output
						aria-label="Loading more files"
						className="ml-auto inline-block size-2.5 shrink-0 animate-spin rounded-full border border-muted-foreground/60 border-t-transparent"
					/>
				)}
			</div>
		</div>
	);
});

function ReviewDiffPanePlaceholder() {
	return <div className="h-full" />;
}
