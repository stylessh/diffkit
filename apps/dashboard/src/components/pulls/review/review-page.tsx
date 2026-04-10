import { FileIcon, GitPullRequestIcon, SearchIcon } from "@diffkit/icons";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@diffkit/ui/components/resizable";
import { cn } from "@diffkit/ui/lib/utils";
import type { SelectedLineRange } from "@pierre/diffs";
import type { DiffLineAnnotation } from "@pierre/diffs/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getPrStateConfig } from "#/components/pulls/detail/pull-detail-header";
import { submitPullReview } from "#/lib/github.functions";
import {
	githubPullFilesQueryOptions,
	githubPullPageQueryOptions,
	githubPullReviewCommentsQueryOptions,
	githubQueryKeys,
} from "#/lib/github.query";
import type { PullReviewComment } from "#/lib/github.types";
import { useHasMounted } from "#/lib/use-has-mounted";
import { useRegisterTab } from "#/lib/use-register-tab";
import { ReviewFileDiffBlock } from "./review-file-diff-block";
import { ReviewFileTreeNode } from "./review-file-tree";
import { ReviewSubmitPopover } from "./review-submit-popover";
import type {
	ActiveCommentForm,
	FileTreeNode,
	PendingComment,
	ReviewEvent,
} from "./review-types";
import { buildFileTree, encodeFileId } from "./review-utils";

const routeApi = getRouteApi("/_protected/$owner/$repo/review/$pullId");

export function ReviewPage() {
	const { user } = routeApi.useRouteContext();
	const { owner, repo, pullId } = routeApi.useParams();
	const pullNumber = Number(pullId);
	const scope = { userId: user.id };
	const hasMounted = useHasMounted();
	const queryClient = useQueryClient();
	const input = { owner, repo, pullNumber };

	const pageQuery = useQuery({
		...githubPullPageQueryOptions(scope, input),
		enabled: hasMounted,
	});

	const filesQuery = useQuery({
		...githubPullFilesQueryOptions(scope, input),
		enabled: hasMounted,
	});

	const reviewCommentsQuery = useQuery({
		...githubPullReviewCommentsQueryOptions(scope, input),
		enabled: hasMounted,
	});

	const pr = pageQuery.data?.detail;
	const files = filesQuery.data ?? [];
	const reviewComments = reviewCommentsQuery.data ?? [];

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

	const diffPanelRef = useRef<HTMLDivElement>(null);

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

	const fileTree = useMemo(() => buildFileTree(files), [files]);

	const filteredTree = useMemo(() => {
		if (!fileFilter) return fileTree;
		const lower = fileFilter.toLowerCase();

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
	}, [fileFilter, fileTree]);

	const scrollToFile = useCallback((filename: string) => {
		const element = document.getElementById(encodeFileId(filename));
		if (element) {
			element.scrollIntoView({ behavior: "smooth", block: "start" });
			setActiveFile(filename);
		}
	}, []);

	useEffect(() => {
		const panel = diffPanelRef.current;
		if (!panel || files.length === 0) return;

		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						const filename = entry.target.getAttribute("data-filename");
						if (filename) setActiveFile(filename);
					}
				}
			},
			{
				root: panel,
				rootMargin: "-10% 0px -80% 0px",
				threshold: 0,
			},
		);

		for (const file of files) {
			const element = document.getElementById(encodeFileId(file.filename));
			if (element) observer.observe(element);
		}

		return () => observer.disconnect();
	}, [files]);

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

	const addPendingComment = useCallback((comment: PendingComment) => {
		setPendingComments((previous) => [...previous, comment]);
		setActiveCommentForm(null);
	}, []);

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

	if (!pr) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="size-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
			</div>
		);
	}

	const stateConfig = getPrStateConfig(pr);
	const StateIcon = stateConfig.icon;
	const totalAdditions = files.reduce((sum, file) => sum + file.additions, 0);
	const totalDeletions = files.reduce((sum, file) => sum + file.deletions, 0);

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
								{files.length}
							</span>{" "}
							{files.length === 1 ? "file" : "files"}
						</span>
						<span className="font-mono tabular-nums font-medium text-green-500">
							+{totalAdditions}
						</span>
						<span className="font-mono tabular-nums font-medium text-red-500">
							-{totalDeletions}
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
							{files.length} {files.length === 1 ? "file" : "files"} changed
						</div>
					</div>
				</ResizablePanel>

				<ResizableHandle />

				<ResizablePanel defaultSize={80}>
					<div ref={diffPanelRef} className="h-full overflow-auto">
						<div className="flex flex-col gap-4 p-4">
							{files.map((file) => (
								<ReviewFileDiffBlock
									key={file.filename}
									file={file}
									diffStyle={diffStyle}
									annotations={annotationsByFile.get(file.filename) ?? []}
									pendingComments={pendingComments.filter(
										(comment) => comment.path === file.filename,
									)}
									activeCommentForm={
										activeCommentForm?.path === file.filename
											? activeCommentForm
											: null
									}
									selectedLines={
										activeCommentForm?.path === file.filename
											? selectedLines
											: null
									}
									onGutterClick={(range) => {
										const isMultiLine = range.start !== range.end;
										const startIsSmaller = range.start <= range.end;
										const lineSide = startIsSmaller
											? (range.endSide ?? range.side)
											: range.side;
										const startLineSide = startIsSmaller
											? range.side
											: (range.endSide ?? range.side);
										const toGithubSide = (s: string | undefined) =>
											s === "deletions"
												? ("LEFT" as const)
												: ("RIGHT" as const);
										setActiveCommentForm({
											path: file.filename,
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
									}}
									onCancelComment={() => {
										setActiveCommentForm(null);
										setSelectedLines(null);
									}}
									onAddComment={(comment) => {
										addPendingComment(comment);
										setSelectedLines(null);
									}}
								/>
							))}

							{files.length === 0 && !filesQuery.isLoading && (
								<div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
									No files changed in this pull request.
								</div>
							)}
						</div>
					</div>
				</ResizablePanel>
			</ResizablePanelGroup>
		</div>
	);
}
