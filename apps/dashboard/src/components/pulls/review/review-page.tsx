import { LayoutAlignBottomIcon, TextWrapIcon } from "@diffkit/icons";
import {
	Drawer,
	DrawerContent,
	DrawerNoDrag,
	DrawerTitle,
} from "@diffkit/ui/components/drawer";
import {
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
import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Skeleton, SkeletonBox } from "skullet/react";
import type {
	DiffCodeViewHandle,
	DiffReview,
} from "#/components/diffs/diff-code-view";
import { preloadDiffCodeView } from "#/components/diffs/lazy-diff-code-view";
import { getPrStateConfig } from "#/components/pulls/detail/pull-detail-header";
import { SAMPLE_PULL_PAGE } from "#/components/pulls/detail/pull-detail-samples";
import { PullStackBadge } from "#/components/pulls/stack/pull-stack-badge";
import type { DiffStyle } from "#/lib/diffs/use-diff-options";
import { usePullDiffFiles } from "#/lib/diffs/use-pull-diff-files";
import {
	githubPullPageQueryOptions,
	githubPullReviewCommentsQueryOptions,
	githubReviewThreadStatusesQueryOptions,
	githubViewerQueryOptions,
} from "#/lib/github.query";
import type { PullFileSummary, PullReviewComment } from "#/lib/github.types";
import { usePageTitle } from "#/lib/use-page-title";
import { useRegisterTab } from "#/lib/use-register-tab";
import { ReviewChangesPanel } from "./review-changes-panel";
import { ReviewCommitList } from "./review-commit-list";
import { ReviewDiffPane } from "./review-diff-pane";
import { DiffDisplayOptions, type DiffView } from "./review-diff-toolbar";
import { useReviewDraft } from "./review-draft";
import {
	createActiveFileStore,
	ReviewFileTreeSkeleton,
} from "./review-file-tree";
import { SAMPLE_REVIEW_FILES } from "./review-samples";
import {
	FilesLoadedProgress,
	ReviewSidebar,
	ViewedProgress,
} from "./review-sidebar";
import { ReviewSubmitPopover } from "./review-submit-popover";
import { ReviewTabs } from "./review-tabs";
import type { PendingComment } from "./review-types";
import { isDesktopViewport, useIsDesktop } from "./use-is-desktop";
import { useReviewFileSummaries } from "./use-review-file-summaries";
import { useReviewMentions } from "./use-review-mentions";
import { useReviewThreads } from "./use-review-threads";
import { useSubmitReview } from "./use-submit-review";
import { createViewedFilesStore } from "./viewed-files-store";

export { ReviewSidebar } from "./review-sidebar";

const NO_REVIEW_COMMENTS: PullReviewComment[] = [];
const NO_FILES: PullFileSummary[] = [];
const COLD_FILE_TREE = <ReviewFileTreeSkeleton files={SAMPLE_REVIEW_FILES} />;
const COLD_FILE_STATUS = <SkeletonBox width={96} height={12} radius={4} />;

const routeApi = getRouteApi("/_protected/$owner/$repo/review/$pullId");

function groupByPath(comments: readonly PendingComment[]) {
	const byPath = new Map<string, PendingComment[]>();
	for (const comment of comments) {
		const existing = byPath.get(comment.path);
		if (existing) existing.push(comment);
		else byPath.set(comment.path, [comment]);
	}
	return byPath;
}

export function ReviewPage() {
	const { user } = routeApi.useRouteContext();
	const { owner, repo, pullId } = routeApi.useParams();
	const pullNumber = Number(pullId);
	const scope = useMemo(() => ({ userId: user.id }), [user.id]);
	const input = useMemo(
		() => ({ owner, repo, pullNumber }),
		[owner, repo, pullNumber],
	);
	const isDesktop = useIsDesktop();

	useEffect(() => {
		void preloadDiffCodeView();
	}, []);

	const pageQuery = useQuery(githubPullPageQueryOptions(scope, input));
	const reviewCommentsQuery = useQuery(
		githubPullReviewCommentsQueryOptions(scope, input),
	);
	const threadStatusesQuery = useQuery(
		githubReviewThreadStatusesQueryOptions(scope, input),
	);
	const viewerQuery = useQuery(githubViewerQueryOptions(scope));

	const pr = pageQuery.data?.detail ?? undefined;
	const reviewComments = reviewCommentsQuery.data ?? NO_REVIEW_COMMENTS;
	const viewerLogin = viewerQuery.data?.login;

	const summaries = useReviewFileSummaries(scope, input, pr?.headSha);
	const diff = usePullDiffFiles(scope, {
		owner,
		repo,
		pullNumber,
		headSha: pr?.headSha,
		baseRefName: pr?.baseRefName,
	});

	usePageTitle(pr ? `Review: ${pr.title}` : null);
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

	const [diffStyle, setDiffStyle] = useState<DiffStyle>("split");
	const [diffView, setDiffView] = useState<DiffView>("files");
	// Phones start wrapped: a long line otherwise scrolls the whole diff sideways.
	const [wrapLines, setWrapLines] = useState(() => !isDesktopViewport());
	const [fileSheetOpen, setFileSheetOpen] = useState(false);

	const diffPaneRef = useRef<DiffCodeViewHandle>(null);
	const activeFileStore = useRef(createActiveFileStore(null)).current;
	// biome-ignore lint/correctness/useExhaustiveDependencies: a new head commit starts the viewed ticks over
	const viewedFiles = useMemo(() => createViewedFilesStore(), [diff.revision]);

	const scrollToFile = useCallback(
		(filename: string) => {
			diffPaneRef.current?.scrollToFile(filename);
			activeFileStore.set(filename);
			setFileSheetOpen(false);
		},
		[activeFileStore],
	);

	const { draft, actions: draftActions } = useReviewDraft();
	const threads = useReviewThreads(reviewComments, threadStatusesQuery.data);
	const mentionConfig = useReviewMentions({
		scope,
		owner,
		repo,
		pr,
		reviewComments,
		viewerLogin,
	});
	const { submit: submitReview, isSubmitting } = useSubmitReview({
		scope,
		owner,
		repo,
		pullNumber,
		pending: draft.pending,
		onSubmitted: draftActions.submitted,
	});

	const pendingCommentsByFile = useMemo(
		() => groupByPath(draft.pending),
		[draft.pending],
	);
	const review = useMemo(
		(): DiffReview => ({
			owner,
			repo,
			pullNumber,
			...threads,
			pendingCommentsByFile,
			composing: draft.composing,
			mentionConfig,
			viewerLogin,
			viewedFiles,
			onStartComment: draftActions.compose,
			onCancelComment: draftActions.cancel,
			onAddComment: draftActions.add,
			onEditComment: draftActions.edit,
		}),
		[
			owner,
			repo,
			pullNumber,
			threads,
			pendingCommentsByFile,
			draft.composing,
			mentionConfig,
			viewerLogin,
			viewedFiles,
			draftActions,
		],
	);

	const sidebarFiles = summaries.status === "cold" ? NO_FILES : summaries.files;
	const sidebarFileCount = sidebarFiles.length;
	const expectedFileCount = Math.max(pr?.changedFiles ?? 0, sidebarFileCount);
	const sidebarStatus = useMemo(() => {
		switch (summaries.status) {
			case "cold":
				return COLD_FILE_STATUS;
			case "loading-more":
				return (
					<FilesLoadedProgress
						loaded={sidebarFileCount}
						total={expectedFileCount}
					/>
				);
			case "complete":
				return (
					<ViewedProgress viewedFiles={viewedFiles} total={sidebarFileCount} />
				);
		}
	}, [summaries.status, sidebarFileCount, expectedFileCount, viewedFiles]);

	if (pageQuery.error) throw pageQuery.error;
	if (reviewCommentsQuery.error) throw reviewCommentsQuery.error;

	const submitPopover = (triggerClassName?: string) => (
		<ReviewSubmitPopover
			pendingCount={draft.pending.length}
			isSubmitting={isSubmitting}
			onSubmit={submitReview}
			triggerClassName={triggerClassName}
		/>
	);

	const toolbar = (
		<ReviewTabs
			owner={owner}
			repo={repo}
			pullId={pullId}
			pr={pr}
			actions={
				<>
					{pr ? <PullStackBadge owner={owner} repo={repo} pr={pr} /> : null}
					{isDesktop ? (
						<>
							<DiffDisplayOptions
								raised
								diffStyle={diffStyle}
								onDiffStyleChange={setDiffStyle}
								wrapLines={wrapLines}
								onWrapLinesChange={setWrapLines}
							/>
							{submitPopover()}
						</>
					) : null}
				</>
			}
		/>
	);

	const diffPane = (
		<div className="relative h-full min-h-0">
			<ReviewDiffPane
				ref={diffPaneRef}
				revision={diff.revision}
				diff={diff.files}
				expectedFileCount={pr?.changedFiles ?? 0}
				diffStyle={isDesktop ? diffStyle : "unified"}
				wrapLines={wrapLines}
				review={review}
				clearsMobileActionBar={!isDesktop}
				onActiveFileChange={activeFileStore.set}
			/>
		</div>
	);

	const changesPanel = (
		<ReviewChangesPanel
			view={diffView}
			onViewChange={setDiffView}
			fileCount={pr?.changedFiles}
			commitCount={pr?.commits}
			commits={
				<Skeleton loading={!pageQuery.data} label="Loading commits">
					<ReviewCommitList
						commits={(pageQuery.data ?? SAMPLE_PULL_PAGE).commits}
						owner={owner}
						repo={repo}
					/>
				</Skeleton>
			}
			files={
				<ReviewSidebar
					sidebarFiles={sidebarFiles}
					sidebarFileCount={sidebarFileCount}
					activeFileStore={activeFileStore}
					onFileClick={scrollToFile}
					status={sidebarStatus}
					tree={summaries.status === "cold" ? COLD_FILE_TREE : undefined}
				/>
			}
		/>
	);

	if (!isDesktop) {
		return (
			<div className="relative flex h-full min-h-0 flex-col">
				{toolbar}
				<div className="min-h-0 flex-1 overflow-hidden border-t-[0.5px] border-header-rule">
					{diffPane}
				</div>
				<MobileActionBar label="Review actions">
					<MobileActionGroup>
						<MobileActionButton
							icon={<LayoutAlignBottomIcon size={15} strokeWidth={2} />}
							count={pr?.changedFiles}
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
					{submitPopover(mobilePrimaryActionClassName)}
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
						{diffPane}
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
