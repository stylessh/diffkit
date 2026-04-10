import { FileIcon, GitPullRequestIcon, SearchIcon } from "@diffkit/icons";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@diffkit/ui/components/resizable";
import { cn } from "@diffkit/ui/lib/utils";
import type { SelectedLineRange } from "@pierre/diffs";
import type { DiffLineAnnotation } from "@pierre/diffs/react";
import {
	useInfiniteQuery,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import {
	lazy,
	memo,
	Suspense,
	useCallback,
	useDeferredValue,
	useMemo,
	useRef,
	useState,
} from "react";
import { getPrStateConfig } from "#/components/pulls/detail/pull-detail-header";
import { getPullFiles, submitPullReview } from "#/lib/github.functions";
import {
	githubPullFileSummariesQueryOptions,
	githubPullPageQueryOptions,
	githubPullReviewCommentsQueryOptions,
	githubQueryKeys,
} from "#/lib/github.query";
import type {
	PullDetail,
	PullFileSummary,
	PullReviewComment,
} from "#/lib/github.types";
import { useRegisterTab } from "#/lib/use-register-tab";
import type { ReviewDiffPaneHandle } from "./review-diff-pane";
import {
	type ActiveFileStore,
	createActiveFileStore,
	ReviewFileTreeNode,
} from "./review-file-tree";
import { ReviewSubmitPopover } from "./review-submit-popover";
import type {
	ActiveCommentForm,
	FileTreeNode,
	PendingComment,
	ReviewEvent,
} from "./review-types";
import { buildFileTree } from "./review-utils";

const routeApi = getRouteApi("/_protected/$owner/$repo/review/$pullId");
const PULL_FILES_PAGE_SIZE = 50;
const reviewDiffPaneImport = import("./review-diff-pane");
const ReviewDiffPane = lazy(() =>
	reviewDiffPaneImport.then((mod) => ({
		default: mod.ReviewDiffPane,
	})),
);

export function ReviewPage() {
	const { user } = routeApi.useRouteContext();
	const loaderData = routeApi.useLoaderData();
	const { owner, repo, pullId } = routeApi.useParams();
	const pullNumber = Number(pullId);
	const scope = { userId: user.id };
	const queryClient = useQueryClient();
	const input = { owner, repo, pullNumber };
	const diffPaneRef = useRef<ReviewDiffPaneHandle>(null);

	// Stable store for active file — updates bypass ReviewPage renders entirely
	const activeFileStore = useRef(createActiveFileStore(null)).current;

	const pageQuery = useQuery({
		...githubPullPageQueryOptions(scope, input),
		refetchOnMount: false,
		refetchOnWindowFocus: false,
	});

	const fileSummariesQuery = useQuery({
		...githubPullFileSummariesQueryOptions(scope, input),
		refetchOnMount: false,
		refetchOnWindowFocus: false,
	});

	const firstFilesPage = loaderData?.firstFilesPage ?? null;
	const filesQuery = useInfiniteQuery({
		queryKey: githubQueryKeys.pulls.files(scope, input),
		initialPageParam: 1,
		queryFn: ({ pageParam }) =>
			getPullFiles({
				data: {
					...input,
					page: pageParam,
					perPage: PULL_FILES_PAGE_SIZE,
				},
			}),
		getNextPageParam: (lastPage) => lastPage.nextPage ?? undefined,
		...(firstFilesPage
			? {
					initialData: {
						pages: [firstFilesPage],
						pageParams: [1],
					},
				}
			: {}),
		refetchOnMount: false,
		refetchOnWindowFocus: false,
	});

	const hasDiffPayload = filesQuery.data !== undefined;
	const reviewCommentsQuery = useQuery({
		...githubPullReviewCommentsQueryOptions(scope, input),
		enabled: hasDiffPayload,
		refetchOnWindowFocus: false,
	});

	const pr = pageQuery.data?.detail ?? loaderData?.pageData?.detail ?? null;
	const sidebarFiles =
		fileSummariesQuery.data ?? loaderData?.fileSummaries ?? [];
	const diffFiles = useMemo(
		() => filesQuery.data?.pages.flatMap((page) => page.files) ?? [],
		[filesQuery.data],
	);
	const reviewComments = reviewCommentsQuery.data ?? [];

	const [diffStyle, setDiffStyle] = useState<"unified" | "split">("unified");
	const [pendingComments, setPendingComments] = useState<PendingComment[]>([]);
	const [activeCommentForm, setActiveCommentForm] =
		useState<ActiveCommentForm | null>(null);
	const [selectedLines, setSelectedLines] = useState<SelectedLineRange | null>(
		null,
	);
	const [isSubmitting, setIsSubmitting] = useState(false);

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
		},
		[activeFileStore],
	);

	const annotationsByFile = useMemo(() => {
		const map = new Map<string, DiffLineAnnotation<PullReviewComment>[]>();
		for (const comment of reviewComments) {
			if (comment.line == null) continue;
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

	const pendingCommentsByFile = useMemo(() => {
		const map = new Map<string, PendingComment[]>();
		for (const comment of pendingComments) {
			const existing = map.get(comment.path) ?? [];
			existing.push(comment);
			map.set(comment.path, existing);
		}
		return map;
	}, [pendingComments]);

	const diffStats = useMemo(() => {
		let totalAdditions = 0;
		let totalDeletions = 0;
		for (const file of sidebarFiles) {
			totalAdditions += file.additions;
			totalDeletions += file.deletions;
		}
		return { totalAdditions, totalDeletions };
	}, [sidebarFiles]);

	const addPendingComment = useCallback((comment: PendingComment) => {
		setPendingComments((previous) => [...previous, comment]);
		setActiveCommentForm(null);
	}, []);

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
		async (body: string, event: ReviewEvent) => {
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
					void queryClient.invalidateQueries({
						queryKey: githubQueryKeys.all,
					});
				}
			} finally {
				setIsSubmitting(false);
			}
		},
		[owner, pendingComments, pullNumber, queryClient, repo],
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

	return (
		<div className="flex h-full flex-col">
			<ReviewToolbar
				owner={owner}
				repo={repo}
				pullId={pullId}
				pr={pr}
				sidebarFileCount={sidebarFileCount}
				diffStats={diffStats}
				diffStyle={diffStyle}
				onSetDiffStyle={setDiffStyle}
				pendingCount={pendingComments.length}
				isSubmitting={isSubmitting}
				onSubmitReview={handleSubmitReview}
			/>

			<ResizablePanelGroup direction="horizontal" className="flex-1">
				<ResizablePanel defaultSize={20} minSize={12} maxSize={40}>
					<ReviewSidebar
						sidebarFiles={sidebarFiles}
						sidebarFileCount={sidebarFileCount}
						activeFileStore={activeFileStore}
						onFileClick={scrollToFile}
					/>
				</ResizablePanel>

				<ResizableHandle />

				<ResizablePanel defaultSize={80}>
					{hasDiffPayload ? (
						<Suspense fallback={<ReviewDiffPanePlaceholder />}>
							<ReviewDiffPane
								ref={diffPaneRef}
								files={diffFiles}
								totalFileCount={sidebarFileCount}
								diffStyle={diffStyle}
								annotationsByFile={annotationsByFile}
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
							/>
						</Suspense>
					) : (
						<ReviewDiffPanePlaceholder />
					)}
				</ResizablePanel>
			</ResizablePanelGroup>
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
	onSubmitReview: (body: string, event: ReviewEvent) => Promise<void>;
}) {
	const stateConfig = getPrStateConfig(pr);
	const StateIcon = stateConfig.icon;

	return (
		<div className="flex shrink-0 items-center gap-3 border-b bg-surface-0 px-4 py-2">
			<Link
				to="/$owner/$repo/pull/$pullId"
				params={{ owner, repo, pullId }}
				className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
			>
				<GitPullRequestIcon size={14} strokeWidth={2} />
				<span>#{pr.number}</span>
			</Link>

			<div className="mx-1 h-4 w-px bg-border" />

			<div className="flex min-w-0 items-center gap-2">
				<div className={cn("shrink-0", stateConfig.color)}>
					<StateIcon size={14} strokeWidth={2} />
				</div>
				<span className="truncate text-sm font-medium">{pr.title}</span>
			</div>

			<div className="ml-auto flex items-center gap-3">
				<div className="flex items-center gap-2 text-xs text-muted-foreground">
					<span className="flex items-center gap-1">
						<FileIcon size={13} strokeWidth={2} />
						<span className="font-mono tabular-nums font-medium text-foreground">
							{sidebarFileCount}
						</span>{" "}
						{sidebarFileCount === 1 ? "file" : "files"}
					</span>
					<span className="font-mono tabular-nums font-medium text-green-500">
						+{diffStats.totalAdditions}
					</span>
					<span className="font-mono tabular-nums font-medium text-red-500">
						-{diffStats.totalDeletions}
					</span>
				</div>

				<div className="h-4 w-px bg-border" />

				<div className="flex items-center rounded-md border bg-surface-1">
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

				<div className="h-4 w-px bg-border" />

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

const ReviewSidebar = memo(function ReviewSidebar({
	sidebarFiles,
	sidebarFileCount,
	activeFileStore,
	onFileClick,
}: {
	sidebarFiles: PullFileSummary[];
	sidebarFileCount: number;
	activeFileStore: ActiveFileStore;
	onFileClick: (path: string) => void;
}) {
	const [fileFilter, setFileFilter] = useState("");
	const deferredFileFilter = useDeferredValue(fileFilter);

	const fileTree = useMemo(() => buildFileTree(sidebarFiles), [sidebarFiles]);

	const filteredTree = useMemo(() => {
		if (!deferredFileFilter) return fileTree;
		const lower = deferredFileFilter.toLowerCase();

		function filterNodes(nodes: FileTreeNode[]): FileTreeNode[] {
			return nodes
				.map((node) => {
					if (node.type === "file") {
						return node.name.toLowerCase().includes(lower) ? node : null;
					}

					const filteredChildren = filterNodes(node.children);
					return filteredChildren.length > 0
						? { ...node, children: filteredChildren }
						: null;
				})
				.filter(Boolean) as FileTreeNode[];
		}

		return filterNodes(fileTree);
	}, [deferredFileFilter, fileTree]);

	return (
		<div className="flex h-full flex-col">
			<div className="px-3 py-2">
				<div className="relative flex items-center rounded-md border bg-surface-0 px-2.5 py-1.5">
					<SearchIcon
						size={13}
						strokeWidth={2}
						className="shrink-0 text-muted-foreground"
					/>
					<input
						type="text"
						placeholder="Filter files..."
						value={fileFilter}
						onChange={(event) => setFileFilter(event.target.value)}
						className="ml-2 w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
					/>
				</div>
			</div>

			<div className="flex-1 overflow-auto py-1">
				{filteredTree.map((node) => (
					<ReviewFileTreeNode
						key={node.path}
						node={node}
						depth={0}
						activeFileStore={activeFileStore}
						onFileClick={onFileClick}
					/>
				))}
			</div>

			<div className="border-t px-3 py-2 text-xs text-muted-foreground">
				{sidebarFileCount} {sidebarFileCount === 1 ? "file" : "files"} changed
			</div>
		</div>
	);
});

function ReviewDiffPanePlaceholder() {
	return <div className="h-full" />;
}
