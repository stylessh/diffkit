import { LayoutAlignBottomIcon, TextWrapIcon } from "@diffkit/icons";
import { LineCounts } from "@diffkit/ui/components/detail-layout";
import {
	Drawer,
	DrawerContent,
	DrawerNoDrag,
	DrawerTitle,
} from "@diffkit/ui/components/drawer";
import type { MentionConfig } from "@diffkit/ui/components/markdown-editor";
import {
	MOBILE_ACTION_BAR_CLEARANCE,
	MobileActionBar,
	MobileActionButton,
	MobileActionGroup,
	mobilePrimaryActionClassName,
} from "@diffkit/ui/components/mobile-action-bar";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@diffkit/ui/components/resizable";
import { toast } from "@diffkit/ui/components/sonner";
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
	memo,
	Suspense,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import type {
	DiffCodeViewHandle,
	DiffReview,
} from "#/components/diffs/diff-code-view";
import {
	LazyDiffCodeView,
	preloadDiffCodeView,
} from "#/components/diffs/lazy-diff-code-view";
import { getPrStateConfig } from "#/components/pulls/detail/pull-detail-header";
import { PullStackBadge } from "#/components/pulls/stack/pull-stack-badge";
import { FileSearchCard } from "#/components/shared/file-search-card";
import { usePullDiffFiles } from "#/lib/diffs/use-pull-diff-files";
import { submitPullReview } from "#/lib/github.functions";
import {
	githubPullFileSummariesQueryOptions,
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
import {
	invalidateGitHubEntities,
	pullEntityKey,
} from "#/lib/github-query-updates";
import { usePageTitle } from "#/lib/use-page-title";
import { useRegisterTab } from "#/lib/use-register-tab";
import { checkPermissionWarning } from "#/lib/warning-store";
import { ReviewCommitList } from "./review-commit-list";
import {
	DiffDisplayOptions,
	type DiffStyle,
	type DiffView,
} from "./review-diff-toolbar";
import {
	type ActiveFileStore,
	createActiveFileStore,
	ReviewFileTree,
} from "./review-file-tree";
import { ReviewSubmitPopover } from "./review-submit-popover";
import type {
	ActiveCommentForm,
	PendingComment,
	ReviewEvent,
} from "./review-types";
import { encodeFileId } from "./review-utils";
import {
	createViewedFilesStore,
	type ViewedFilesStore,
} from "./viewed-files-store";

const EMPTY_COMMITS: PullCommit[] = [];

const routeApi = getRouteApi("/_protected/$owner/$repo/review/$pullId");

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
	const diffPaneRef = useRef<DiffCodeViewHandle>(null);
	useEffect(() => {
		void preloadDiffCodeView();
	}, []);

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

	const reviewCommentsQuery = useQuery(
		githubPullReviewCommentsQueryOptions(scope, input),
	);
	const threadStatusesQuery = useQuery(
		githubReviewThreadStatusesQueryOptions(scope, input),
	);

	const pr = pageQuery.data?.detail ?? null;

	// Repos without the GitHub App get no change feed, so a push only shows up
	// when the page query refetches on focus; follow its head commit here.
	const headSha = pr?.headSha;
	const lastHeadShaRef = useRef(headSha);
	useEffect(() => {
		if (!headSha) return;
		const previousHeadSha = lastHeadShaRef.current;
		lastHeadShaRef.current = headSha;
		if (previousHeadSha && previousHeadSha !== headSha) {
			void queryClient.invalidateQueries({ queryKey: fileSummariesQueryKey });
		}
	}, [headSha, queryClient, fileSummariesQueryKey]);

	const sidebarFiles = useMemo(
		() => fileSummariesQuery.data?.pages.flatMap((page) => page.items) ?? [],
		[fileSummariesQuery.data],
	);
	const diff = usePullDiffFiles(scope, {
		owner,
		repo,
		pullNumber,
		headSha,
		baseRefName: pr?.baseRefName,
	});
	const reviewComments = reviewCommentsQuery.data ?? [];
	// biome-ignore lint/correctness/useExhaustiveDependencies: a new head commit starts the viewed ticks over
	const viewedFiles = useMemo(() => createViewedFilesStore(), [diff.revision]);

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
	// Phones start wrapped: a long line otherwise scrolls the whole diff sideways.
	const [wrapLines, setWrapLines] = useState(() => !getMdSnapshot());
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
					void invalidateGitHubEntities(queryClient, scope, [
						pullEntityKey({ owner, repo, pullNumber }),
					]);
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
		[
			navigate,
			owner,
			pendingComments,
			pullId,
			pullNumber,
			queryClient,
			repo,
			scope,
		],
	);

	const viewerLogin = viewerQuery.data?.login;
	const review = useMemo(
		(): DiffReview => ({
			owner,
			repo,
			pullNumber,
			threadsByFile: annotationsByFile,
			pendingCommentsByFile,
			activeCommentForm,
			selectedLines,
			repliesByCommentId,
			threadInfoByCommentId,
			mentionConfig,
			viewerLogin,
			viewedFiles,
			onStartComment: handleStartComment,
			onCancelComment: handleCancelComment,
			onAddComment: handleAddComment,
			onEditComment: handleEditComment,
		}),
		[
			owner,
			repo,
			pullNumber,
			annotationsByFile,
			pendingCommentsByFile,
			activeCommentForm,
			selectedLines,
			repliesByCommentId,
			threadInfoByCommentId,
			mentionConfig,
			viewerLogin,
			viewedFiles,
			handleStartComment,
			handleCancelComment,
			handleAddComment,
			handleEditComment,
		],
	);

	if (pageQuery.error) throw pageQuery.error;
	if (fileSummariesQuery.error) throw fileSummariesQuery.error;
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

	const diffFiles = diff.files;
	const diffContent = (
		<div className="relative h-full min-h-0">
			{diffFiles.phase === "error" ? (
				<p className="px-4 py-10 text-center text-[13px] font-[450] text-muted-foreground">
					{diffFiles.error.message}
				</p>
			) : diffFiles.phase === "complete" && diffFiles.files.length === 0 ? (
				<p className="px-4 py-10 text-center text-[13px] font-[450] text-muted-foreground">
					No files changed in this pull request.
				</p>
			) : diffFiles.phase === "waiting" ? (
				<ReviewDiffPanePlaceholder />
			) : (
				<Suspense fallback={<ReviewDiffPanePlaceholder />}>
					<LazyDiffCodeView
						ref={diffPaneRef}
						revision={diff.revision}
						files={diffFiles.files}
						diffStyle={isDesktop ? diffStyle : "unified"}
						wrapLines={wrapLines}
						review={review}
						onActiveFileChange={handleActiveFileChange}
						footer={
							diffFiles.phase === "streaming" || !isDesktop ? (
								<div className={MOBILE_ACTION_BAR_CLEARANCE}>
									{diffFiles.phase === "streaming" ? (
										<p className="px-4 py-3 text-xs font-[450] text-muted-foreground">
											Loaded {diffFiles.files.length} of {prChangedFiles} files…
										</p>
									) : null}
								</div>
							) : undefined
						}
					/>
				</Suspense>
			)}
		</div>
	);

	const toolbar = (
		<ReviewTabs
			stack={<PullStackBadge owner={owner} repo={repo} pr={pr} />}
			owner={owner}
			repo={repo}
			pullId={pullId}
			changedFiles={prChangedFiles}
			additions={pr.additions}
			deletions={pr.deletions}
			diffStyle={diffStyle}
			onSetDiffStyle={setDiffStyle}
			wrapLines={wrapLines}
			onWrapLinesChange={setWrapLines}
			pendingCount={pendingComments.length}
			isSubmitting={isSubmitting}
			onSubmitReview={handleSubmitReview}
			isDesktop={isDesktop}
		/>
	);
	const changesPanel = (
		<ReviewChangesPanel
			view={diffView}
			onViewChange={setDiffView}
			fileCount={prChangedFiles}
			commitCount={pr.commits}
			commits={<ReviewCommitList commits={commits} owner={owner} repo={repo} />}
			files={
				<ReviewSidebar
					sidebarFiles={sidebarFiles}
					sidebarFileCount={sidebarFileCount}
					isStreamingSummaries={isStreamingSummaries}
					activeFileStore={activeFileStore}
					viewedFiles={viewedFiles}
					onFileClick={scrollToFile}
				/>
			}
		/>
	);

	if (!isDesktop) {
		return (
			<div className="relative flex h-full min-h-0 flex-col">
				{toolbar}
				<div className="min-h-0 flex-1 overflow-hidden border-t-[0.5px] border-header-rule">
					{diffContent}
				</div>
				<MobileActionBar label="Review actions">
					<MobileActionGroup>
						<MobileActionButton
							icon={<LayoutAlignBottomIcon size={15} strokeWidth={2} />}
							count={prChangedFiles}
							onClick={() => setFileSheetOpen(true)}
						>
							Files
						</MobileActionButton>
						<MobileActionButton
							icon={<TextWrapIcon size={15} strokeWidth={2} />}
							active={wrapLines}
							aria-pressed={wrapLines}
							onClick={() => setWrapLines((wrap) => !wrap)}
						>
							Wrap
						</MobileActionButton>
					</MobileActionGroup>
					<ReviewSubmitPopover
						pendingCount={pendingComments.length}
						isSubmitting={isSubmitting}
						onSubmit={handleSubmitReview}
						triggerClassName={mobilePrimaryActionClassName}
					/>
				</MobileActionBar>
				<Drawer open={fileSheetOpen} onOpenChange={setFileSheetOpen}>
					<DrawerContent className="h-[70dvh]">
						<DrawerTitle className="sr-only">Changes</DrawerTitle>
						<DrawerNoDrag>{changesPanel}</DrawerNoDrag>
					</DrawerContent>
				</Drawer>
			</div>
		);
	}

	return (
		<ResizablePanelGroup direction="horizontal" className="h-full min-h-0">
			<ResizablePanel defaultSize={77}>
				<div className="flex h-full min-h-0 flex-col">
					{toolbar}
					<div className="min-h-0 flex-1 border-t-[0.5px] border-header-rule">
						{diffContent}
					</div>
				</div>
			</ResizablePanel>

			<ResizableHandle />

			<ResizablePanel defaultSize={23} minSize={14} maxSize={40}>
				{changesPanel}
			</ResizablePanel>
		</ResizablePanelGroup>
	);
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

const ReviewTabs = memo(function ReviewTabs({
	stack,
	owner,
	repo,
	pullId,
	changedFiles,
	additions,
	deletions,
	diffStyle,
	onSetDiffStyle,
	wrapLines,
	onWrapLinesChange,
	pendingCount,
	isSubmitting,
	onSubmitReview,
	isDesktop,
}: {
	stack: React.ReactNode;
	owner: string;
	repo: string;
	pullId: string;
	changedFiles: number;
	additions: number;
	deletions: number;
	diffStyle: DiffStyle;
	onSetDiffStyle: (style: DiffStyle) => void;
	wrapLines: boolean;
	onWrapLinesChange: (wrap: boolean) => void;
	pendingCount: number;
	isSubmitting: boolean;
	onSubmitReview: (body: string, event: ReviewEvent) => Promise<boolean>;
	isDesktop: boolean;
}) {
	return (
		<ViewTabs
			label="Pull request views"
			actions={
				<>
					{stack}
					{/* Phones carry these in the floating action bar instead. */}
					{isDesktop ? (
						<>
							<DiffDisplayOptions
								raised
								diffStyle={diffStyle}
								onDiffStyleChange={onSetDiffStyle}
								wrapLines={wrapLines}
								onWrapLinesChange={onWrapLinesChange}
							/>
							<ReviewSubmitPopover
								pendingCount={pendingCount}
								isSubmitting={isSubmitting}
								onSubmit={onSubmitReview}
							/>
						</>
					) : null}
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
					<LineCounts
						additions={additions}
						deletions={deletions}
						className="ml-1.5 text-xs max-md:hidden"
					/>
				</Link>
			</ViewTab>
		</ViewTabs>
	);
});

function ReviewChangesPanel({
	view,
	onViewChange,
	fileCount,
	commitCount,
	files,
	commits,
}: {
	view: DiffView;
	onViewChange: (view: DiffView) => void;
	fileCount: number;
	commitCount: number;
	files: React.ReactNode;
	commits: React.ReactNode;
}) {
	return (
		<aside aria-label="Changes" className="flex h-full min-h-0 flex-col">
			<ViewTabs label="Changes" className="px-3">
				<ViewTab
					active={view === "files"}
					onClick={() => onViewChange("files")}
				>
					Files
					<ViewTabCount>{fileCount}</ViewTabCount>
				</ViewTab>
				<ViewTab
					active={view === "commits"}
					onClick={() => onViewChange("commits")}
				>
					Commits
					<ViewTabCount>{commitCount}</ViewTabCount>
				</ViewTab>
			</ViewTabs>
			<div className="min-h-0 flex-1">{view === "files" ? files : commits}</div>
		</aside>
	);
}

// ---------------------------------------------------------------------------
// ReviewSidebar — owns file filter state, reads activeFile from store
// ---------------------------------------------------------------------------

export const ReviewSidebar = memo(function ReviewSidebar({
	sidebarFiles,
	sidebarFileCount,
	isStreamingSummaries = false,
	activeFileStore,
	viewedFiles,
	onFileClick,
}: {
	sidebarFiles: PullFileSummary[];
	sidebarFileCount: number;
	isStreamingSummaries?: boolean;
	activeFileStore: ActiveFileStore;
	viewedFiles?: ViewedFilesStore;
	onFileClick: (path: string) => void;
}) {
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

	const revealFile = useCallback(
		(path: string) => {
			onFileClick(path);
			const hash = `#${encodeFileId(path)}`;
			if (window.location.hash !== hash) {
				history.replaceState(null, "", hash);
			}
		},
		[onFileClick],
	);
	const handleSearchSelect = useCallback(
		(entry: { path: string }) => revealFile(entry.path),
		[revealFile],
	);

	return (
		<div className="flex h-full min-h-0 flex-col">
			<FileSearchCard
				entries={searchEntries}
				onSelect={handleSearchSelect}
				activePath={activeFile ?? undefined}
				placeholder="Search files..."
				shortcutKey="f"
			/>

			<ReviewFileTree
				files={sidebarFiles}
				activeFileStore={activeFileStore}
				onFileClick={revealFile}
			/>

			<div className="flex h-9 shrink-0 items-center gap-2 border-t-[0.5px] border-header-rule px-4 text-xs font-[450] text-muted-foreground">
				{isStreamingSummaries ? (
					<>
						<span className="tabular-nums">
							{sidebarFileCount} {sidebarFileCount === 1 ? "file" : "files"}{" "}
							loaded…
						</span>
						<output
							aria-label="Loading more files"
							className="ml-auto inline-block size-2.5 shrink-0 animate-spin rounded-full border-[0.5px] border-muted-foreground/60 border-t-transparent"
						/>
					</>
				) : viewedFiles ? (
					<ViewedProgress viewedFiles={viewedFiles} total={sidebarFileCount} />
				) : (
					<span className="tabular-nums">
						{sidebarFileCount} {sidebarFileCount === 1 ? "file" : "files"}{" "}
						changed
					</span>
				)}
			</div>
		</div>
	);
});

function ViewedProgress({
	viewedFiles,
	total,
}: {
	viewedFiles: ViewedFilesStore;
	total: number;
}) {
	const viewed = useSyncExternalStore(
		viewedFiles.subscribe,
		viewedFiles.count,
		() => 0,
	);
	return (
		<>
			<span className="tabular-nums">
				{viewed} of {total} viewed
			</span>
			<span
				role="progressbar"
				aria-label="Files viewed"
				aria-valuemin={0}
				aria-valuemax={total}
				aria-valuenow={viewed}
				className="ml-auto h-1 w-16 shrink-0 overflow-hidden rounded-full bg-pill-neutral"
			>
				<span
					className="block h-full rounded-full bg-pill-ok-text transition-[width] duration-200"
					style={{ width: total > 0 ? `${(viewed / total) * 100}%` : 0 }}
				/>
			</span>
		</>
	);
}

function ReviewDiffPanePlaceholder() {
	return <div className="h-full" />;
}
