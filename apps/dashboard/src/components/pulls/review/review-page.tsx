import { PanelLeftIcon } from "@diffkit/icons";
import {
	Drawer,
	DrawerContent,
	DrawerTitle,
} from "@diffkit/ui/components/drawer";
import type { MentionConfig } from "@diffkit/ui/components/markdown-editor";
import { PageIconButton } from "@diffkit/ui/components/page-header";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@diffkit/ui/components/resizable";
import { toast } from "@diffkit/ui/components/sonner";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@diffkit/ui/components/tooltip";
import {
	ViewTab,
	ViewTabCount,
	ViewTabs,
} from "@diffkit/ui/components/view-tabs";
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
	type ReactNode,
	Suspense,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import { DetailPageHeader } from "#/components/details/detail-page";
import { getPrStateConfig } from "#/components/pulls/detail/pull-detail-header";
import { PullStackBadge } from "#/components/pulls/stack/pull-stack-badge";
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
	PullCommit,
	PullFileSummary,
	PullReviewComment,
} from "#/lib/github.types";
import { usePageTitle } from "#/lib/use-page-title";
import { useRegisterTab } from "#/lib/use-register-tab";
import { checkPermissionWarning } from "#/lib/warning-store";
import type { ReviewDiffPaneHandle } from "./review-diff-pane";
import {
	DiffCommitList,
	type DiffStyle,
	DiffToolbar,
	type DiffView,
} from "./review-diff-toolbar";
import {
	type ActiveFileStore,
	createActiveFileStore,
	ReviewVirtualizedFileTree,
} from "./review-file-tree";
import { SplitDiffGlyph, UnifiedDiffGlyph } from "./review-icons";
import { ReviewSubmitPopover } from "./review-submit-popover";
import type {
	ActiveCommentForm,
	PendingComment,
	ReviewEvent,
} from "./review-types";
import { buildFileTree, encodeFileId } from "./review-utils";

const EMPTY_COMMITS: PullCommit[] = [];

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
	const fileSummariesQueryKey = useMemo(
		() => githubQueryKeys.pulls.fileSummaries(scope, input),
		[scope, input],
	);
	const filesQueryKey = useMemo(
		() => githubQueryKeys.pulls.files(scope, input),
		[scope, input],
	);
	const diffPaneRef = useRef<ReviewDiffPaneHandle>(null);

	// Stable store for active file — updates bypass ReviewPage renders entirely
	const activeFileStore = useRef(createActiveFileStore(null)).current;

	const pageQuery = useQuery(githubPullPageQueryOptions(scope, input));

	const fileSummariesQuery = useInfiniteQuery(
		githubPullFileSummariesQueryOptions(scope, input),
	);

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

	const filesQuery = useInfiniteQuery(
		githubPullFilesInfiniteQueryOptions(scope, input),
	);

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
	const reviewCommentsQuery = useQuery(
		githubPullReviewCommentsQueryOptions(scope, input),
	);
	const threadStatusesQuery = useQuery(
		githubReviewThreadStatusesQueryOptions(scope, input),
	);

	const pr = pageQuery.data?.detail ?? null;

	// The diff queries are large paginated payloads, so they don't poll. The
	// page query does (detail tier); when it reports a new head commit, refetch
	// the diff so the review reflects the push.
	const headSha = pr?.headSha;
	const lastHeadShaRef = useRef(headSha);
	useEffect(() => {
		if (!headSha) return;
		const previousHeadSha = lastHeadShaRef.current;
		lastHeadShaRef.current = headSha;
		if (previousHeadSha && previousHeadSha !== headSha) {
			void queryClient.invalidateQueries({ queryKey: fileSummariesQueryKey });
			void queryClient.invalidateQueries({ queryKey: filesQueryKey });
		}
	}, [headSha, queryClient, fileSummariesQueryKey, filesQueryKey]);

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

	const [diffStyle, setDiffStyle] = useState<DiffStyle>("split");
	const [diffView, setDiffView] = useState<DiffView>("files");
	const [wrapLines, setWrapLines] = useState(false);
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

	const prChangedFiles = pr?.changedFiles ?? 0;
	const commits = pageQuery.data?.commits ?? EMPTY_COMMITS;

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

	const toolbar = (
		<DiffToolbar
			view={diffView}
			onViewChange={setDiffView}
			fileCount={prChangedFiles}
			commitCount={pr.commits}
			commentCount={reviewComments.length}
			diffStyle={diffStyle}
			onDiffStyleChange={setDiffStyle}
			wrapLines={wrapLines}
			onWrapLinesChange={setWrapLines}
		/>
	);

	const diffContent = hasDiffPayload ? (
		<Suspense fallback={<ReviewDiffPanePlaceholder toolbar={toolbar} />}>
			<ReviewDiffPane
				ref={diffPaneRef}
				files={diffFiles}
				totalFileCount={sidebarFileCount}
				diffStyle={diffStyle}
				wrapLines={wrapLines}
				toolbar={toolbar}
				alternateView={
					diffView === "commits" ? (
						<DiffCommitList commits={commits} owner={owner} repo={repo} />
					) : undefined
				}
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
		<ReviewDiffPanePlaceholder toolbar={toolbar} />
	);

	const stateConfig = getPrStateConfig(pr);

	return (
		<div className="flex h-full min-h-0 flex-col">
			<DetailPageHeader
				collectionHref="/pulls"
				collectionLabel="Pull Requests"
				owner={owner}
				repo={repo}
				number={pr.number}
				icon={stateConfig.icon}
				iconClassName={stateConfig.color}
				title={pr.title}
				actions={<PullStackBadge owner={owner} repo={repo} pr={pr} />}
			/>
			<ReviewTabs
				owner={owner}
				repo={repo}
				pullId={pullId}
				changedFiles={prChangedFiles}
				diffStyle={diffStyle}
				onSetDiffStyle={setDiffStyle}
				pendingCount={pendingComments.length}
				isSubmitting={isSubmitting}
				onSubmitReview={handleSubmitReview}
				onOpenFileSheet={() => setFileSheetOpen(true)}
				isDesktop={isDesktop}
			/>

			{isDesktop ? (
				<ResizablePanelGroup direction="horizontal" className="min-h-0 flex-1">
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
					<div className="min-h-0 flex-1 overflow-hidden">{diffContent}</div>
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
// ---------------------------------------------------------------------------

const ReviewTabs = memo(function ReviewTabs({
	owner,
	repo,
	pullId,
	changedFiles,
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
	changedFiles: number;
	diffStyle: DiffStyle;
	onSetDiffStyle: (style: DiffStyle) => void;
	pendingCount: number;
	isSubmitting: boolean;
	onSubmitReview: (body: string, event: ReviewEvent) => Promise<boolean>;
	onOpenFileSheet: () => void;
	isDesktop: boolean;
}) {
	const nextStyle = diffStyle === "split" ? "unified" : "split";
	const diffStyleLabel =
		nextStyle === "unified" ? "Show unified diff" : "Show split diff";

	return (
		<ViewTabs
			label="Pull request views"
			actions={
				<>
					{!isDesktop ? (
						<PageIconButton
							raised
							type="button"
							onClick={onOpenFileSheet}
							aria-label="Open file tree"
						>
							<PanelLeftIcon size={14} strokeWidth={2} />
						</PageIconButton>
					) : (
						<Tooltip>
							<TooltipTrigger asChild>
								<PageIconButton
									raised
									type="button"
									onClick={() => onSetDiffStyle(nextStyle)}
									aria-label={diffStyleLabel}
								>
									{diffStyle === "split" ? (
										<SplitDiffGlyph />
									) : (
										<UnifiedDiffGlyph />
									)}
								</PageIconButton>
							</TooltipTrigger>
							<TooltipContent>{diffStyleLabel}</TooltipContent>
						</Tooltip>
					)}
					<ReviewSubmitPopover
						pendingCount={pendingCount}
						isSubmitting={isSubmitting}
						onSubmit={onSubmitReview}
					/>
				</>
			}
		>
			<ViewTab asChild>
				<Link
					to="/$owner/$repo/pull/$pullId"
					params={{ owner, repo, pullId }}
					activeOptions={{ exact: true }}
				>
					Overview
				</Link>
			</ViewTab>
			<ViewTab asChild>
				<Link
					to="/$owner/$repo/review/$pullId"
					params={{ owner, repo, pullId }}
				>
					Files changed
					<ViewTabCount>{changedFiles}</ViewTabCount>
				</Link>
			</ViewTab>
		</ViewTabs>
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

			<div className="flex h-9 shrink-0 items-center gap-2 border-t-[0.5px] border-header-rule px-4 text-xs font-[450] text-muted-foreground">
				<span className="tabular-nums">
					{sidebarFileCount} {sidebarFileCount === 1 ? "file" : "files"}
					{isStreamingSummaries ? " loaded…" : " changed"}
				</span>
				{isStreamingSummaries && (
					<output
						aria-label="Loading more files"
						className="ml-auto inline-block size-2.5 shrink-0 animate-spin rounded-full border-[0.5px] border-muted-foreground/60 border-t-transparent"
					/>
				)}
			</div>
		</div>
	);
});

function ReviewDiffPanePlaceholder({ toolbar }: { toolbar?: ReactNode }) {
	return (
		<div className="h-full overflow-hidden px-[14px] max-md:px-2">
			{toolbar}
		</div>
	);
}
