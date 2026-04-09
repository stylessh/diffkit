import {
	CloseIcon,
	CommentIcon,
	FileIcon,
	FolderIcon,
	GitBranchIcon,
	GitMergeIcon,
	GitPullRequestClosedIcon,
	GitPullRequestDraftIcon,
	GitPullRequestIcon,
	SearchIcon,
	TickIcon,
} from "@diffkit/icons";
import { Markdown } from "@diffkit/ui/components/markdown";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@diffkit/ui/components/popover";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@diffkit/ui/components/resizable";
import { vercelDark, vercelLight } from "@diffkit/ui/lib/shiki-themes";
import { cn } from "@diffkit/ui/lib/utils";
import type { SelectedLineRange } from "@pierre/diffs";
import type { DiffLineAnnotation, PatchDiffProps } from "@pierre/diffs/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTheme } from "next-themes";
import {
	type ComponentType,
	type LazyExoticComponent,
	lazy,
	Suspense,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { formatRelativeTime } from "#/components/pulls/pull-request-row";
import { submitPullReview } from "#/lib/github.functions";
import {
	githubPullFilesQueryOptions,
	githubPullPageQueryOptions,
	githubPullReviewCommentsQueryOptions,
	githubQueryKeys,
} from "#/lib/github.query";
import type {
	PullDetail,
	PullFile,
	PullReviewComment,
} from "#/lib/github.types";
import { buildSeo, formatPageTitle, summarizeText } from "#/lib/seo";
import { useHasMounted } from "#/lib/use-has-mounted";
import { useRegisterTab } from "#/lib/use-register-tab";

// Lazy-load PatchDiff so @pierre/diffs (which bundles all shiki language grammars)
// is excluded from the server bundle, keeping it under the CF Workers 3 MiB limit.
// During SSR, return a no-op component to avoid stubbed-shiki runtime errors.
type ReviewPatchDiffComponent = ComponentType<PatchDiffProps<ReviewAnnotation>>;

const PatchDiff: LazyExoticComponent<ReviewPatchDiffComponent> = lazy(() =>
	import.meta.env.SSR
		? Promise.resolve({
				default: (() => null) as ReviewPatchDiffComponent,
			})
		: import("@pierre/diffs/react").then((mod) => ({
				default: mod.PatchDiff as ReviewPatchDiffComponent,
			})),
);

// Register custom themes lazily on the client to avoid pulling shiki into the server bundle.
// import.meta.env.SSR is statically replaced by Vite so the import is fully tree-shaken from SSR.
if (!import.meta.env.SSR) {
	import("@pierre/diffs").then(({ registerCustomTheme }) => {
		registerCustomTheme("vercel-light", () => Promise.resolve(vercelLight));
		registerCustomTheme("vercel-dark", () => Promise.resolve(vercelDark));
	});
}

export const Route = createFileRoute("/_protected/$owner/$repo/review/$pullId")(
	{
		loader: async ({ context, params }) => {
			const pullNumber = Number(params.pullId);
			const scope = { userId: context.user.id };
			const input = { owner: params.owner, repo: params.repo, pullNumber };
			const pageOptions = githubPullPageQueryOptions(scope, input);
			const filesOptions = githubPullFilesQueryOptions(scope, input);
			const commentsOptions = githubPullReviewCommentsQueryOptions(
				scope,
				input,
			);

			const pageData =
				context.queryClient.getQueryData(pageOptions.queryKey) ??
				(await context.queryClient.ensureQueryData(pageOptions));

			if (
				context.queryClient.getQueryData(filesOptions.queryKey) === undefined
			) {
				await context.queryClient.ensureQueryData(filesOptions);
			}

			if (
				context.queryClient.getQueryData(commentsOptions.queryKey) === undefined
			) {
				await context.queryClient.ensureQueryData(commentsOptions);
			}

			return pageData;
		},
		head: ({ loaderData, match, params }) => {
			const pull = loaderData?.detail;
			const title = pull
				? formatPageTitle(`Review PR #${pull.number}: ${pull.title}`)
				: formatPageTitle(`Review PR #${params.pullId}`);

			return buildSeo({
				path: match.pathname,
				title,
				description: pull
					? summarizeText(
							pull.body,
							`Private code review workspace for pull request #${pull.number} in ${params.owner}/${params.repo}.`,
						)
					: `Private code review workspace for pull request #${params.pullId} in ${params.owner}/${params.repo}.`,
				robots: "noindex",
			});
		},
		component: ReviewPage,
	},
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PendingComment = {
	path: string;
	line: number;
	startLine?: number;
	side: "LEFT" | "RIGHT";
	startSide?: "LEFT" | "RIGHT";
	body: string;
};

type ReviewAnnotation = PullReviewComment | PendingComment;
type ReviewEvent = "APPROVE" | "REQUEST_CHANGES" | "COMMENT";

type FileTreeNode = {
	name: string;
	path: string;
	type: "file" | "directory";
	status?: PullFile["status"];
	additions?: number;
	deletions?: number;
	children: FileTreeNode[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPrStateConfig(pr: PullDetail) {
	if (pr.isDraft) {
		return {
			icon: GitPullRequestDraftIcon,
			color: "text-muted-foreground",
			label: "Draft",
			badgeClass: "bg-muted text-muted-foreground",
		};
	}
	if (pr.isMerged || pr.mergedAt) {
		return {
			icon: GitMergeIcon,
			color: "text-purple-500",
			label: "Merged",
			badgeClass: "bg-purple-500/10 text-purple-500",
		};
	}
	if (pr.state === "closed") {
		return {
			icon: GitPullRequestClosedIcon,
			color: "text-red-500",
			label: "Closed",
			badgeClass: "bg-red-500/10 text-red-500",
		};
	}
	return {
		icon: GitPullRequestIcon,
		color: "text-green-500",
		label: "Open",
		badgeClass: "bg-green-500/10 text-green-500",
	};
}

function buildFileTree(files: PullFile[]): FileTreeNode[] {
	const root: FileTreeNode = {
		name: "",
		path: "",
		type: "directory",
		children: [],
	};

	for (const file of files) {
		const parts = file.filename.split("/");
		let current = root;

		for (let i = 0; i < parts.length; i++) {
			const part = parts[i];
			const isFile = i === parts.length - 1;

			let child = current.children.find((c) => c.name === part);
			if (!child) {
				child = {
					name: part,
					path: parts.slice(0, i + 1).join("/"),
					type: isFile ? "file" : "directory",
					status: isFile ? file.status : undefined,
					additions: isFile ? file.additions : undefined,
					deletions: isFile ? file.deletions : undefined,
					children: [],
				};
				current.children.push(child);
			}
			current = child;
		}
	}

	// Collapse single-child directories
	function collapse(node: FileTreeNode): FileTreeNode {
		if (
			node.type === "directory" &&
			node.children.length === 1 &&
			node.children[0].type === "directory"
		) {
			const child = node.children[0];
			return collapse({
				...child,
				name: `${node.name}/${child.name}`,
				children: child.children,
			});
		}
		return {
			...node,
			children: node.children.map(collapse),
		};
	}

	// Sort: directories first, then files, alphabetically
	function sortTree(nodes: FileTreeNode[]): FileTreeNode[] {
		return nodes
			.map((n) => ({ ...n, children: sortTree(n.children) }))
			.sort((a, b) => {
				if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
				return a.name.localeCompare(b.name);
			});
	}

	return sortTree(root.children.map(collapse));
}

function buildPatchString(file: PullFile): string {
	if (!file.patch) return "";
	const header = `diff --git a/${file.previousFilename ?? file.filename} b/${file.filename}\n--- a/${file.previousFilename ?? file.filename}\n+++ b/${file.filename}\n`;
	return header + file.patch;
}

function encodeFileId(filename: string): string {
	return `diff-${filename.replaceAll("/", "-").replaceAll(".", "-")}`;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

function ReviewPage() {
	const { user } = Route.useRouteContext();
	const { owner, repo, pullId } = Route.useParams();
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

	// Diff style state
	const [diffStyle, setDiffStyle] = useState<"unified" | "split">("unified");

	// Pending comments state
	const [pendingComments, setPendingComments] = useState<PendingComment[]>([]);
	const [activeCommentForm, setActiveCommentForm] = useState<{
		path: string;
		line: number;
		startLine?: number;
		side: "LEFT" | "RIGHT";
		startSide?: "LEFT" | "RIGHT";
	} | null>(null);

	// Track selected line range for highlighting during gutter drag
	const [selectedLines, setSelectedLines] = useState<SelectedLineRange | null>(
		null,
	);

	// Active file tracking
	const [activeFile, setActiveFile] = useState<string | null>(null);
	const diffPanelRef = useRef<HTMLDivElement>(null);

	// File tree filter
	const [fileFilter, setFileFilter] = useState("");

	// Tab registration
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

	// Build file tree
	const fileTree = useMemo(() => buildFileTree(files), [files]);

	// Filtered files for tree
	const filteredTree = useMemo(() => {
		if (!fileFilter) return fileTree;
		const lower = fileFilter.toLowerCase();

		function filterNodes(nodes: FileTreeNode[]): FileTreeNode[] {
			return nodes
				.map((node) => {
					if (node.type === "file") {
						return node.name.toLowerCase().includes(lower) ? node : null;
					}
					const filtered = filterNodes(node.children);
					return filtered.length > 0 ? { ...node, children: filtered } : null;
				})
				.filter(Boolean) as FileTreeNode[];
		}

		return filterNodes(fileTree);
	}, [fileTree, fileFilter]);

	// Scroll to file on click
	const scrollToFile = useCallback((filename: string) => {
		const element = document.getElementById(encodeFileId(filename));
		if (element) {
			element.scrollIntoView({ behavior: "smooth", block: "start" });
			setActiveFile(filename);
		}
	}, []);

	// Intersection observer for active file tracking
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
			const el = document.getElementById(encodeFileId(file.filename));
			if (el) observer.observe(el);
		}

		return () => observer.disconnect();
	}, [files]);

	// Build annotations map per file
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

	// Add pending comment
	const addPendingComment = useCallback((comment: PendingComment) => {
		setPendingComments((prev) => [...prev, comment]);
		setActiveCommentForm(null);
	}, []);

	// Submit review
	const [isSubmitting, setIsSubmitting] = useState(false);
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
						comments: pendingComments.map((c) => ({
							path: c.path,
							line: c.line,
							side: c.side,
							body: c.body,
							...(c.startLine != null && c.startLine !== c.line
								? { startLine: c.startLine, startSide: c.startSide ?? c.side }
								: {}),
						})),
					},
				});

				if (success) {
					setPendingComments([]);
					queryClient.invalidateQueries({
						queryKey: githubQueryKeys.all,
					});
				}
			} finally {
				setIsSubmitting(false);
			}
		},
		[owner, repo, pullNumber, pendingComments, queryClient],
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

	const totalAdditions = files.reduce((s, f) => s + f.additions, 0);
	const totalDeletions = files.reduce((s, f) => s + f.deletions, 0);

	return (
		<div className="flex h-full flex-col">
			{/* Toolbar */}
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

					{/* Diff style toggle */}
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

					{/* Submit review button */}
					<ReviewSubmitPopover
						pendingCount={pendingComments.length}
						isSubmitting={isSubmitting}
						onSubmit={handleSubmitReview}
					/>
				</div>
			</div>

			{/* Main content: file tree + diffs */}
			<ResizablePanelGroup direction="horizontal" className="flex-1">
				{/* File tree sidebar */}
				<ResizablePanel
					defaultSize={20}
					minSize={12}
					maxSize={40}
					className="border-r"
				>
					<div className="flex h-full flex-col">
						{/* Filter */}
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
									onChange={(e) => setFileFilter(e.target.value)}
									className="ml-2 w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
								/>
							</div>
						</div>

						{/* Tree */}
						<div className="flex-1 overflow-auto py-1">
							{filteredTree.map((node) => (
								<FileTreeNodeComponent
									key={node.path}
									node={node}
									depth={0}
									activeFile={activeFile}
									onFileClick={scrollToFile}
								/>
							))}
						</div>

						{/* Summary */}
						<div className="border-t px-3 py-2 text-xs text-muted-foreground">
							{files.length} {files.length === 1 ? "file" : "files"} changed
						</div>
					</div>
				</ResizablePanel>

				<ResizableHandle />

				{/* Diff panel */}
				<ResizablePanel defaultSize={80}>
					<div ref={diffPanelRef} className="h-full overflow-auto">
						<div className="flex flex-col gap-4 p-4">
							{files.map((file) => (
								<FileDiffBlock
									key={file.filename}
									file={file}
									diffStyle={diffStyle}
									annotations={annotationsByFile.get(file.filename) ?? []}
									pendingComments={pendingComments.filter(
										(c) => c.path === file.filename,
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
										const side = range.side === "deletions" ? "LEFT" : "RIGHT";
										const isMultiLine = range.start !== range.end;
										setActiveCommentForm({
											path: file.filename,
											line: Math.max(range.start, range.end),
											side,
											...(isMultiLine
												? {
														startLine: Math.min(range.start, range.end),
														startSide:
															(range.endSide ?? range.side) === "deletions"
																? "LEFT"
																: "RIGHT",
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

// ---------------------------------------------------------------------------
// File Tree Node
// ---------------------------------------------------------------------------

function FileTreeNodeComponent({
	node,
	depth,
	activeFile,
	onFileClick,
}: {
	node: FileTreeNode;
	depth: number;
	activeFile: string | null;
	onFileClick: (path: string) => void;
}) {
	const [isOpen, setIsOpen] = useState(true);

	if (node.type === "directory") {
		return (
			<div>
				<button
					type="button"
					className="flex w-full items-center gap-1.5 px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-surface-1 hover:text-foreground"
					style={{ paddingLeft: `${depth * 12 + 12}px` }}
					onClick={() => setIsOpen(!isOpen)}
				>
					<svg
						aria-hidden="true"
						className={cn(
							"size-3 shrink-0 text-muted-foreground/60 transition-transform",
							isOpen && "rotate-90",
						)}
						viewBox="0 0 16 16"
						fill="currentColor"
					>
						<path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z" />
					</svg>
					<FolderIcon
						size={14}
						strokeWidth={2}
						className="shrink-0 text-muted-foreground"
					/>
					<span className="truncate font-medium">{node.name}</span>
				</button>
				{isOpen && (
					<div>
						{node.children.map((child) => (
							<FileTreeNodeComponent
								key={child.path}
								node={child}
								depth={depth + 1}
								activeFile={activeFile}
								onFileClick={onFileClick}
							/>
						))}
					</div>
				)}
			</div>
		);
	}

	const isActive = activeFile === node.path;

	return (
		<button
			type="button"
			className={cn(
				"flex w-full items-center gap-1.5 px-3 py-1.5 text-[13px] transition-colors hover:bg-surface-1",
				isActive ? "bg-surface-1 text-foreground" : "text-muted-foreground",
			)}
			style={{ paddingLeft: `${depth * 12 + 12 + 18}px` }}
			onClick={() => onFileClick(node.path)}
		>
			<FileIcon
				size={14}
				strokeWidth={2}
				className="shrink-0 text-muted-foreground"
			/>
			<span
				className={cn("truncate", node.status === "removed" && "line-through")}
			>
				{node.name}
			</span>
			{(node.additions != null || node.deletions != null) && (
				<span className="ml-auto flex shrink-0 items-center gap-1 font-mono tabular-nums">
					{node.additions != null && node.additions > 0 && (
						<span className="text-green-500">+{node.additions}</span>
					)}
					{node.deletions != null && node.deletions > 0 && (
						<span className="text-red-500">-{node.deletions}</span>
					)}
				</span>
			)}
		</button>
	);
}

// ---------------------------------------------------------------------------
// File Diff Block
// ---------------------------------------------------------------------------

function FileDiffBlock({
	file,
	diffStyle,
	annotations,
	pendingComments,
	activeCommentForm,
	selectedLines,
	onGutterClick,
	onCancelComment,
	onAddComment,
}: {
	file: PullFile;
	diffStyle: "unified" | "split";
	annotations: DiffLineAnnotation<PullReviewComment>[];
	pendingComments: PendingComment[];
	activeCommentForm: {
		path: string;
		line: number;
		startLine?: number;
		side: "LEFT" | "RIGHT";
		startSide?: "LEFT" | "RIGHT";
	} | null;
	selectedLines: SelectedLineRange | null;
	onGutterClick: (range: SelectedLineRange) => void;
	onCancelComment: () => void;
	onAddComment: (comment: PendingComment) => void;
}) {
	const [isCollapsed, setIsCollapsed] = useState(false);
	const { resolvedTheme } = useTheme();
	const isDark = resolvedTheme === "dark";

	// Combine existing review comments and pending comments into annotations
	const allAnnotations = useMemo(() => {
		const result: DiffLineAnnotation<ReviewAnnotation>[] = [...annotations];

		for (const pending of pendingComments) {
			result.push({
				side: pending.side === "LEFT" ? "deletions" : "additions",
				lineNumber: pending.line,
				metadata: pending,
			});
		}

		// Add active comment form as an annotation
		if (activeCommentForm) {
			result.push({
				side: activeCommentForm.side === "LEFT" ? "deletions" : "additions",
				lineNumber: activeCommentForm.line,
				metadata: {
					path: activeCommentForm.path,
					line: activeCommentForm.line,
					startLine: activeCommentForm.startLine,
					side: activeCommentForm.side,
					startSide: activeCommentForm.startSide,
					body: "__FORM__",
				} satisfies PendingComment,
			});
		}

		return result;
	}, [annotations, pendingComments, activeCommentForm]);

	const mutedFg = isDark
		? "oklch(0.705 0.015 286.067)"
		: "oklch(0.552 0.016 285.938)";

	const diffOptions = useMemo(
		() => ({
			diffStyle,
			theme: {
				dark: "vercel-dark" as const,
				light: "vercel-light" as const,
			},
			lineDiffType: "word" as const,
			hunkSeparators: "line-info" as const,
			overflow: "scroll" as const,
			disableFileHeader: true,
			enableGutterUtility: true,
			enableLineSelection: true,
			onGutterUtilityClick: onGutterClick,
			unsafeCSS: [
				`:host { color-scheme: ${isDark ? "dark" : "light"}; ${isDark ? "" : "--diffs-light-bg: oklch(0.967 0.001 286.375);"} }`,
				`:host { --diffs-font-family: 'Geist Mono Variable', 'SF Mono', ui-monospace, 'Cascadia Code', monospace; }`,
				`:host { --diffs-selection-base: ${mutedFg}; }`,
				`[data-utility-button] { background-color: ${mutedFg}; }`,
				`[data-line-annotation] { font-family: 'Inter Variable', 'Inter', 'Avenir Next', ui-sans-serif, system-ui, sans-serif; }`,
				`[data-line-annotation] code { font-family: var(--diffs-font-family, var(--diffs-font-fallback)); }`,
				isDark
					? `:host { --diffs-bg-addition-override: color-mix(in lab, var(--diffs-bg) 92%, var(--diffs-addition-base)); --diffs-bg-addition-number-override: color-mix(in lab, var(--diffs-bg) 88%, var(--diffs-addition-base)); --diffs-bg-addition-emphasis-override: color-mix(in lab, var(--diffs-bg) 75%, var(--diffs-addition-base)); --diffs-bg-deletion-override: color-mix(in lab, var(--diffs-bg) 92%, var(--diffs-deletion-base)); --diffs-bg-deletion-number-override: color-mix(in lab, var(--diffs-bg) 88%, var(--diffs-deletion-base)); --diffs-bg-deletion-emphasis-override: color-mix(in lab, var(--diffs-bg) 75%, var(--diffs-deletion-base)); }`
					: `:host { --diffs-bg-addition-override: color-mix(in lab, var(--diffs-bg) 82%, var(--diffs-addition-base)); --diffs-bg-addition-number-override: color-mix(in lab, var(--diffs-bg) 78%, var(--diffs-addition-base)); --diffs-bg-deletion-override: color-mix(in lab, var(--diffs-bg) 82%, var(--diffs-deletion-base)); --diffs-bg-deletion-number-override: color-mix(in lab, var(--diffs-bg) 78%, var(--diffs-deletion-base)); }`,
			].join("\n"),
		}),
		[diffStyle, onGutterClick, isDark, mutedFg],
	);

	if (!file.patch) {
		return (
			<div id={encodeFileId(file.filename)} data-filename={file.filename}>
				<FileHeader
					file={file}
					isCollapsed={isCollapsed}
					onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
				/>
				{!isCollapsed && (
					<div className="flex items-center justify-center rounded-b-lg border border-t-0 bg-surface-0 py-8 text-sm text-muted-foreground">
						Binary file or diff too large to display
					</div>
				)}
			</div>
		);
	}

	const patchString = buildPatchString(file);

	return (
		<div id={encodeFileId(file.filename)} data-filename={file.filename}>
			<FileHeader
				file={file}
				isCollapsed={isCollapsed}
				onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
			/>
			{!isCollapsed && (
				<div className="px-2 pb-2">
					<Suspense>
						<PatchDiff
							patch={patchString}
							options={diffOptions}
							selectedLines={selectedLines}
							lineAnnotations={allAnnotations}
							renderAnnotation={(
								annotation: DiffLineAnnotation<ReviewAnnotation>,
							) => {
								const data = annotation.metadata as
									| PendingComment
									| PullReviewComment
									| null;
								if (!data) return null;

								// Pending comment form
								if ("body" in data && data.body === "__FORM__") {
									const formData = data as PendingComment;
									return (
										<InlineCommentForm
											isMultiLine={
												formData.startLine != null &&
												formData.startLine !== formData.line
											}
											startLine={formData.startLine}
											endLine={formData.line}
											onSubmit={(body) =>
												onAddComment({
													path: file.filename,
													line: formData.line,
													startLine: formData.startLine,
													side: formData.side,
													startSide: formData.startSide,
													body,
												})
											}
											onCancel={onCancelComment}
										/>
									);
								}

								// Pending comment display
								if ("body" in data && !("id" in data)) {
									return (
										<PendingCommentBubble comment={data as PendingComment} />
									);
								}

								// Existing review comment
								if ("id" in data) {
									return (
										<ReviewCommentBubble comment={data as PullReviewComment} />
									);
								}

								return null;
							}}
						/>
					</Suspense>
				</div>
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// File Header
// ---------------------------------------------------------------------------

function FileHeader({
	file,
	isCollapsed,
	onToggleCollapse,
}: {
	file: PullFile;
	isCollapsed: boolean;
	onToggleCollapse: () => void;
}) {
	return (
		<div className="sticky top-2 z-10 flex items-center gap-2 rounded-lg border bg-surface-1 px-3 py-2">
			<button
				type="button"
				onClick={onToggleCollapse}
				className="flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
			>
				<svg
					aria-hidden="true"
					className={cn(
						"size-3 shrink-0 transition-transform",
						!isCollapsed && "rotate-90",
					)}
					viewBox="0 0 16 16"
					fill="currentColor"
				>
					<path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z" />
				</svg>
			</button>

			<span className="truncate text-xs font-medium font-mono">
				{file.previousFilename && file.previousFilename !== file.filename ? (
					<>
						<span className="text-muted-foreground line-through">
							{file.previousFilename}
						</span>
						<span className="mx-1 text-muted-foreground">→</span>
						{file.filename}
					</>
				) : (
					file.filename
				)}
			</span>

			<span className="ml-auto flex items-center gap-2 font-mono text-xs tabular-nums">
				{file.additions > 0 && (
					<span className="font-medium text-green-500">+{file.additions}</span>
				)}
				{file.deletions > 0 && (
					<span className="font-medium text-red-500">-{file.deletions}</span>
				)}
			</span>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Inline Comment Form
// ---------------------------------------------------------------------------

function InlineCommentForm({
	isMultiLine,
	startLine,
	endLine,
	onSubmit,
	onCancel,
}: {
	isMultiLine?: boolean;
	startLine?: number;
	endLine?: number;
	onSubmit: (body: string) => void;
	onCancel: () => void;
}) {
	const [body, setBody] = useState("");
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	useEffect(() => {
		textareaRef.current?.focus();
	}, []);

	return (
		<div className="mx-2 my-1 flex flex-col gap-2 rounded-lg border bg-surface-0 p-3">
			{isMultiLine && startLine != null && endLine != null && (
				<div className="text-xs text-muted-foreground">
					Commenting on lines {startLine}–{endLine}
				</div>
			)}
			<textarea
				ref={textareaRef}
				value={body}
				onChange={(e) => setBody(e.target.value)}
				placeholder="Leave a comment..."
				className="min-h-[60px] w-full resize-y rounded-md border bg-background px-3 py-2 text-xs outline-none placeholder:text-muted-foreground focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
			/>
			<div className="flex items-center justify-end gap-2">
				<button
					type="button"
					onClick={onCancel}
					className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
				>
					Cancel
				</button>
				<button
					type="button"
					onClick={() => {
						if (body.trim()) onSubmit(body.trim());
					}}
					disabled={!body.trim()}
					className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity disabled:opacity-50"
				>
					Add comment
				</button>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Comment Bubbles
// ---------------------------------------------------------------------------

function ReviewCommentBubble({ comment }: { comment: PullReviewComment }) {
	return (
		<div className="mx-2 my-1 rounded-lg border bg-surface-0 p-3">
			<div className="mb-2 flex items-center gap-2">
				{comment.author && (
					<>
						<img
							src={comment.author.avatarUrl}
							alt={comment.author.login}
							className="size-5 rounded-full border border-border"
						/>
						<span className="text-xs font-medium">{comment.author.login}</span>
					</>
				)}
				<span className="text-xs text-muted-foreground">
					{formatRelativeTime(comment.createdAt)}
				</span>
			</div>
			<div className="text-xs">
				<Markdown>{comment.body}</Markdown>
			</div>
		</div>
	);
}

function PendingCommentBubble({ comment }: { comment: PendingComment }) {
	const isMultiLine =
		comment.startLine != null && comment.startLine !== comment.line;

	return (
		<div className="mx-2 my-1 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
			<div className="mb-1 flex items-center gap-1.5 text-xs text-yellow-600 dark:text-yellow-400">
				<CommentIcon size={12} strokeWidth={2} />
				<span className="font-medium">
					Pending
					{isMultiLine ? ` (lines ${comment.startLine}–${comment.line})` : ""}
				</span>
			</div>
			<div className="text-xs">
				<Markdown>{comment.body}</Markdown>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Review Submit Popover
// ---------------------------------------------------------------------------

function ReviewSubmitPopover({
	pendingCount,
	isSubmitting,
	onSubmit,
}: {
	pendingCount: number;
	isSubmitting: boolean;
	onSubmit: (body: string, event: ReviewEvent) => void;
}) {
	const [body, setBody] = useState("");
	const [event, setEvent] = useState<ReviewEvent>("COMMENT");
	const [isOpen, setIsOpen] = useState(false);

	const handleSubmit = () => {
		onSubmit(body, event);
		setBody("");
		setIsOpen(false);
	};

	const reviewOptions: Array<{
		value: ReviewEvent;
		label: string;
		description: string;
		icon: typeof CommentIcon;
		color: string;
	}> = [
		{
			value: "COMMENT",
			label: "Comment",
			description: "Submit general feedback without explicit approval.",
			icon: CommentIcon,
			color: "text-foreground",
		},
		{
			value: "APPROVE",
			label: "Approve",
			description: "Submit feedback and approve merging these changes.",
			icon: TickIcon,
			color: "text-green-500",
		},
		{
			value: "REQUEST_CHANGES",
			label: "Request changes",
			description: "Submit feedback suggesting changes.",
			icon: GitBranchIcon,
			color: "text-red-500",
		},
	];

	return (
		<Popover open={isOpen} onOpenChange={setIsOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700"
				>
					Submit review
					{pendingCount > 0 && (
						<span className="flex size-4 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold">
							{pendingCount}
						</span>
					)}
				</button>
			</PopoverTrigger>

			<PopoverContent align="end" className="w-96 p-0" sideOffset={8}>
				<div className="flex flex-col">
					<div className="flex items-center justify-between border-b px-4 py-3">
						<h3 className="text-sm font-semibold">Finish your review</h3>
						<button
							type="button"
							className="text-muted-foreground transition-colors hover:text-foreground"
							onClick={() => setIsOpen(false)}
						>
							<CloseIcon size={14} strokeWidth={2} />
						</button>
					</div>

					<div className="p-4">
						<textarea
							value={body}
							onChange={(e) => setBody(e.target.value)}
							placeholder="Leave a comment"
							className="min-h-[80px] w-full resize-y rounded-md border bg-background px-3 py-2 text-xs outline-none placeholder:text-muted-foreground focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
						/>
					</div>

					<div className="flex flex-col gap-1 border-t px-4 py-3">
						{reviewOptions.map((option) => {
							const Icon = option.icon;
							return (
								<label
									key={option.value}
									className="flex cursor-pointer items-start gap-3 rounded-md p-2 transition-colors hover:bg-surface-1"
								>
									<input
										type="radio"
										name="review-event"
										value={option.value}
										checked={event === option.value}
										onChange={() => setEvent(option.value)}
										className="mt-0.5"
									/>
									<div className="flex flex-col gap-0.5">
										<span
											className={cn(
												"flex items-center gap-1.5 text-xs font-semibold",
												option.color,
											)}
										>
											<Icon size={13} strokeWidth={2} />
											{option.label}
										</span>
										<span className="text-[11px] text-muted-foreground">
											{option.description}
										</span>
									</div>
								</label>
							);
						})}
					</div>

					<div className="flex items-center justify-between border-t px-4 py-3">
						<button
							type="button"
							onClick={() => setIsOpen(false)}
							className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={handleSubmit}
							disabled={isSubmitting}
							className="rounded-md bg-green-600 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
						>
							{isSubmitting
								? "Submitting..."
								: `Submit review${pendingCount > 0 ? ` (${pendingCount})` : ""}`}
						</button>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}
