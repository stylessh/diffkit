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
	Suspense,
	useCallback,
	useDeferredValue,
	useEffect,
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
import type { PullReviewComment } from "#/lib/github.types";
import { useHasMounted } from "#/lib/use-has-mounted";
import { useRegisterTab } from "#/lib/use-register-tab";
import type { ReviewDiffPaneHandle } from "./review-diff-pane";
import { ReviewFileTreeNode } from "./review-file-tree";
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
const ReviewDiffPane = lazy(() =>
	import("./review-diff-pane").then((mod) => ({
		default: mod.ReviewDiffPane,
	})),
);

export function ReviewPage() {
	const { user } = routeApi.useRouteContext();
	const loaderData = routeApi.useLoaderData();
	const { owner, repo, pullId } = routeApi.useParams();
	const pullNumber = Number(pullId);
	const scope = { userId: user.id };
	const hasMounted = useHasMounted();
	const queryClient = useQueryClient();
	const input = { owner, repo, pullNumber };
	const diffPaneRef = useRef<ReviewDiffPaneHandle>(null);
	const [shouldLoadReviewComments, setShouldLoadReviewComments] =
		useState(false);

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

	const filesQuery = useInfiniteQuery({
		queryKey: githubQueryKeys.pulls.files(scope, input),
		initialPageParam: 1,
		enabled: hasMounted,
		queryFn: ({ pageParam }) =>
			getPullFiles({
				data: {
					...input,
					page: pageParam,
					perPage: PULL_FILES_PAGE_SIZE,
				},
			}),
		getNextPageParam: (lastPage) => lastPage.nextPage ?? undefined,
		refetchOnMount: false,
		refetchOnWindowFocus: false,
	});

	const reviewCommentsQuery = useQuery({
		...githubPullReviewCommentsQueryOptions(scope, input),
		enabled: shouldLoadReviewComments,
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
	const hasDiffPayload = filesQuery.data !== undefined;

	const [diffStyle, setDiffStyle] = useState<"unified" | "split">("unified");
	const [pendingComments, setPendingComments] = useState<PendingComment[]>([]);
	const [activeCommentForm, setActiveCommentForm] =
		useState<ActiveCommentForm | null>(null);
	const [selectedLines, setSelectedLines] = useState<SelectedLineRange | null>(
		null,
	);
	const [activeFile, setActiveFile] = useState<string | null>(null);
	const [fileFilter, setFileFilter] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const deferredFileFilter = useDeferredValue(fileFilter);

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

	const scrollToFile = useCallback((filename: string) => {
		diffPaneRef.current?.scrollToFile(filename);
		setActiveFile(filename);
	}, []);

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

	useEffect(() => {
		if (!hasMounted || !hasDiffPayload || shouldLoadReviewComments) return;

		const timeoutId = window.setTimeout(() => {
			setShouldLoadReviewComments(true);
		}, 250);

		return () => window.clearTimeout(timeoutId);
	}, [hasDiffPayload, hasMounted, shouldLoadReviewComments]);

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

	const stateConfig = getPrStateConfig(pr);
	const StateIcon = stateConfig.icon;
	const sidebarFileCount = sidebarFiles.length;

	return (
		<div className="flex h-full flex-col">
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
							onClick={() => setDiffStyle("unified")}
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
							onClick={() => setDiffStyle("split")}
						>
							Split
						</button>
					</div>

					<div className="h-4 w-px bg-border" />

					<ReviewSubmitPopover
						pendingCount={pendingComments.length}
						isSubmitting={isSubmitting}
						onSubmit={handleSubmitReview}
					/>
				</div>
			</div>

			<ResizablePanelGroup direction="horizontal" className="flex-1">
				<ResizablePanel defaultSize={20} minSize={12} maxSize={40}>
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
									activeFile={activeFile}
									onFileClick={scrollToFile}
								/>
							))}
						</div>

						<div className="border-t px-3 py-2 text-xs text-muted-foreground">
							{sidebarFileCount} {sidebarFileCount === 1 ? "file" : "files"}{" "}
							changed
						</div>
					</div>
				</ResizablePanel>

				<ResizableHandle />

				<ResizablePanel defaultSize={80}>
					{hasMounted && hasDiffPayload ? (
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
								onLoadMore={() => {
									if (
										filesQuery.hasNextPage &&
										!filesQuery.isFetchingNextPage
									) {
										void filesQuery.fetchNextPage();
									}
								}}
								activeCommentForm={activeCommentForm}
								selectedLines={selectedLines}
								onActiveFileChange={setActiveFile}
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

function ReviewDiffPanePlaceholder() {
	return <div className="h-full" />;
}
