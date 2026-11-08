import { FileIcon, GitCommitIcon, PanelLeftIcon } from "@diffkit/icons";
import {
	Drawer,
	DrawerContent,
	DrawerTitle,
} from "@diffkit/ui/components/drawer";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@diffkit/ui/components/resizable";
import { cn } from "@diffkit/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import {
	lazy,
	memo,
	Suspense,
	useCallback,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import { createActiveFileStore } from "#/components/pulls/review/review-file-tree";
import { ReviewSidebar } from "#/components/pulls/review/review-page";
import {
	type GitHubQueryScope,
	githubRepoCommitQueryOptions,
} from "#/lib/github.query";
import type { PullFileSummary, RepoCommitDetail } from "#/lib/github.types";
import { useRegisterTab } from "#/lib/use-register-tab";
import type { CommitDiffPaneHandle } from "./commit-diff-pane";

const routeApi = getRouteApi("/_protected/$owner/$repo/commit/$sha");

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

const commitDiffPaneImport = import("./commit-diff-pane");
const CommitDiffPane = lazy(() =>
	commitDiffPaneImport.then((mod) => ({ default: mod.CommitDiffPane })),
);

function CommitDiffPanePlaceholder() {
	return <div className="h-full" />;
}

export function CommitPage() {
	const { user } = routeApi.useRouteContext();
	const { owner, repo, sha } = routeApi.useParams();
	const scope = useMemo(
		() => ({ userId: user.id }) satisfies GitHubQueryScope,
		[user.id],
	);
	const isDesktop = useIsDesktop();
	const [diffStyle, setDiffStyle] = useState<"unified" | "split">("unified");
	const [fileSheetOpen, setFileSheetOpen] = useState(false);
	const activeFileStore = useRef(createActiveFileStore(null)).current;
	const diffPaneRef = useRef<CommitDiffPaneHandle>(null);

	const commitQuery = useQuery(
		githubRepoCommitQueryOptions(scope, { owner, repo, sha }),
	);

	const commit = commitQuery.data;

	const sidebarFiles = useMemo<PullFileSummary[]>(
		() =>
			commit?.files.map((f) => ({
				filename: f.filename,
				status: f.status,
				additions: f.additions,
				deletions: f.deletions,
				changes: f.changes,
				previousFilename: f.previousFilename,
			})) ?? [],
		[commit?.files],
	);

	const diffStats = useMemo(() => {
		if (!commit) return { totalAdditions: 0, totalDeletions: 0 };
		return commit.files.reduce(
			(acc, file) => ({
				totalAdditions: acc.totalAdditions + file.additions,
				totalDeletions: acc.totalDeletions + file.deletions,
			}),
			{ totalAdditions: 0, totalDeletions: 0 },
		);
	}, [commit]);

	useRegisterTab(
		commit
			? {
					type: "commit",
					title: commit.message.split("\n")[0],
					url: `/${owner}/${repo}/commit/${sha}`,
					repo: `${owner}/${repo}`,
					iconColor: "text-muted-foreground",
					tabId: `commit:${owner}/${repo}@${commit.sha}`,
					additions: diffStats.totalAdditions,
					deletions: diffStats.totalDeletions,
				}
			: null,
	);

	const handleActiveFileChange = useCallback(
		(filename: string) => {
			activeFileStore.set(filename);
		},
		[activeFileStore],
	);

	const scrollToFile = useCallback((path: string) => {
		diffPaneRef.current?.scrollToFile(path);
	}, []);

	if (commitQuery.error) throw commitQuery.error;

	if (commitQuery.isPending) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="size-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
			</div>
		);
	}

	if (!commit) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
				<p>Commit not found or you do not have access.</p>
				<Link
					to="/$owner/$repo"
					params={{ owner, repo }}
					className="text-foreground underline-offset-4 hover:underline"
				>
					Back to repository
				</Link>
			</div>
		);
	}

	const sidebarFileCount = sidebarFiles.length;

	const diffContent = (
		<Suspense fallback={<CommitDiffPanePlaceholder />}>
			<CommitDiffPane
				ref={diffPaneRef}
				files={commit.files}
				diffStyle={diffStyle}
				onActiveFileChange={handleActiveFileChange}
			/>
		</Suspense>
	);

	return (
		<div className="flex h-full flex-col">
			<CommitToolbar
				owner={owner}
				repo={repo}
				commit={commit}
				sidebarFileCount={sidebarFileCount}
				diffStats={diffStats}
				diffStyle={diffStyle}
				onSetDiffStyle={setDiffStyle}
				onOpenFileSheet={() => setFileSheetOpen(true)}
				isDesktop={isDesktop}
			/>

			{isDesktop ? (
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

const CommitToolbar = memo(function CommitToolbar({
	owner,
	repo,
	commit,
	sidebarFileCount,
	diffStats,
	diffStyle,
	onSetDiffStyle,
	onOpenFileSheet,
	isDesktop,
}: {
	owner: string;
	repo: string;
	commit: RepoCommitDetail;
	sidebarFileCount: number;
	diffStats: { totalAdditions: number; totalDeletions: number };
	diffStyle: "unified" | "split";
	onSetDiffStyle: (style: "unified" | "split") => void;
	onOpenFileSheet: () => void;
	isDesktop: boolean;
}) {
	const shortSha = commit.sha.slice(0, 7);
	const titleLine = commit.message.split("\n")[0];

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
				to="/$owner/$repo"
				params={{ owner, repo }}
				className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
			>
				<span className="font-mono">{shortSha}</span>
			</Link>

			<div className="hidden mx-1 h-4 w-px bg-border md:block" />

			<div className="hidden min-w-0 items-center gap-2 md:flex">
				<GitCommitIcon size={14} strokeWidth={2} className="shrink-0" />
				<span className="truncate text-sm font-medium">{titleLine}</span>
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
					<span className="font-mono tabular-nums font-medium text-success">
						+{diffStats.totalAdditions}
					</span>
					<span className="font-mono tabular-nums font-medium text-danger">
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
			</div>
		</div>
	);
});
