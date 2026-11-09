import { FileIcon, GitCommitIcon, PanelLeftIcon } from "@diffkit/icons";
import { LineCounts } from "@diffkit/ui/components/detail-layout";
import {
	Drawer,
	DrawerContent,
	DrawerTitle,
} from "@diffkit/ui/components/drawer";
import { PageHeaderTitle } from "@diffkit/ui/components/page-header";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@diffkit/ui/components/resizable";
import { Spinner } from "@diffkit/ui/components/spinner";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import {
	memo,
	Suspense,
	useCallback,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import type { DiffCodeViewHandle } from "#/components/diffs/diff-code-view";
import { LazyDiffCodeView } from "#/components/diffs/lazy-diff-code-view";
import { createActiveFileStore } from "#/components/pulls/review/review-file-tree";
import { ReviewSidebar } from "#/components/pulls/review/review-page";
import { pullFilesToDiffFiles } from "#/lib/diffs/diff-files";
import {
	type GitHubQueryScope,
	githubRepoCommitQueryOptions,
} from "#/lib/github.query";
import type { PullFileSummary, RepoCommitDetail } from "#/lib/github.types";
import { useRegisterTab } from "#/lib/use-register-tab";
import { RepoHeader } from "./repo-header";
import { RepoCrumb } from "./repo-page-header";
import {
	ghostPillClassName,
	iconButtonClassName,
	pillButtonClassName,
	pillTabClassName,
	RepoEmptyState,
} from "./repo-ui";

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
	const diffPaneRef = useRef<DiffCodeViewHandle>(null);

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

	const revision = `${owner}/${repo}@${commit?.sha ?? sha}`;
	const diffFiles = useMemo(
		() => (commit ? pullFilesToDiffFiles(commit.files, revision) : []),
		[commit, revision],
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

	const commitsCrumb = (
		<RepoCrumb asChild>
			<Link to="/$owner/$repo/commits" params={{ owner, repo }}>
				Commits
			</Link>
		</RepoCrumb>
	);

	if (commitQuery.isPending) {
		return (
			<div className="flex h-full min-h-0 flex-col">
				<RepoHeader
					owner={owner}
					repo={repo}
					scope={scope}
					active="commits"
					trail={
						<>
							{commitsCrumb}
							<PageHeaderTitle asChild>
								<span className="font-mono">{sha.slice(0, 7)}</span>
							</PageHeaderTitle>
						</>
					}
				/>
				<div className="flex flex-1 items-center justify-center border-t-[0.5px] border-header-rule">
					<Spinner size={18} className="text-muted-foreground" />
				</div>
			</div>
		);
	}

	if (!commit) {
		return (
			<div className="flex h-full min-h-0 flex-col">
				<RepoHeader owner={owner} repo={repo} scope={scope} active="commits" />
				<RepoEmptyState
					icon={<GitCommitIcon />}
					title="Commit not found"
					action={
						<Link
							to="/$owner/$repo"
							params={{ owner, repo }}
							className={pillButtonClassName}
						>
							Back to repository
						</Link>
					}
				>
					It may not exist, or you may not have access to it.
				</RepoEmptyState>
			</div>
		);
	}

	const sidebarFileCount = sidebarFiles.length;

	const diffContent = (
		<Suspense fallback={<CommitDiffPanePlaceholder />}>
			{diffFiles.length === 0 ? (
				<div className="flex h-full items-center justify-center py-20 text-sm text-muted-foreground">
					No files changed in this commit.
				</div>
			) : (
				<LazyDiffCodeView
					ref={diffPaneRef}
					revision={revision}
					files={diffFiles}
					diffStyle={diffStyle}
					wrapLines={false}
					onActiveFileChange={handleActiveFileChange}
				/>
			)}
		</Suspense>
	);

	const titleLine = commit.message.split("\n")[0];

	return (
		<div className="flex h-full min-h-0 flex-col">
			<RepoHeader
				owner={owner}
				repo={repo}
				scope={scope}
				active="commits"
				trail={
					<>
						{commitsCrumb}
						<PageHeaderTitle asChild>
							<span title={titleLine}>
								<span className="shrink-0 font-mono text-muted-foreground">
									{commit.sha.slice(0, 7)}
								</span>
								<span className="truncate">{titleLine}</span>
							</span>
						</PageHeaderTitle>
					</>
				}
			/>
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
				<ResizablePanelGroup
					direction="horizontal"
					className="flex-1 border-t-[0.5px] border-header-rule"
				>
					<ResizablePanel defaultSize={20} minSize={12} maxSize={40}>
						<ReviewSidebar
							sidebarFiles={sidebarFiles}
							sidebarFileCount={sidebarFileCount}
							activeFileStore={activeFileStore}
							onFileClick={scrollToFile}
						/>
					</ResizablePanel>

					<ResizableHandle className="w-[0.5px] bg-header-rule" />

					<ResizablePanel defaultSize={80}>{diffContent}</ResizablePanel>
				</ResizablePanelGroup>
			) : (
				<>
					<div className="flex-1 overflow-hidden border-t-[0.5px] border-header-rule">
						{diffContent}
					</div>
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
	return (
		<div className="flex min-h-11 shrink-0 items-center gap-2 px-2 py-1.5">
			{!isDesktop && (
				<button
					type="button"
					onClick={onOpenFileSheet}
					className={iconButtonClassName}
					aria-label="Open file tree"
				>
					<PanelLeftIcon size={16} strokeWidth={2} />
				</button>
			)}

			<Link
				to="/$owner/$repo/tree/$"
				params={{ owner, repo, _splat: commit.sha }}
				className={ghostPillClassName}
			>
				<GitCommitIcon size={14} strokeWidth={2} />
				<span className="font-mono font-[450]">{commit.sha.slice(0, 7)}</span>
				<span className="max-md:hidden">Browse files</span>
			</Link>

			<div className="ml-auto flex items-center gap-3">
				<div className="flex items-center gap-2 text-xs font-[450] text-muted-foreground">
					<span className="flex items-center gap-1">
						<FileIcon size={13} strokeWidth={2} />
						<span className="tabular-nums text-text-header">
							{sidebarFileCount}
						</span>
						<span className="hidden md:inline">
							{sidebarFileCount === 1 ? "file" : "files"}
						</span>
					</span>
					<LineCounts
						additions={diffStats.totalAdditions}
						deletions={diffStats.totalDeletions}
					/>
				</div>

				<div className="hidden items-center gap-[7px] p-px md:flex">
					{(["unified", "split"] as const).map((style) => (
						<button
							key={style}
							type="button"
							aria-pressed={diffStyle === style}
							className={pillTabClassName}
							onClick={() => onSetDiffStyle(style)}
						>
							{style === "unified" ? "Unified" : "Split"}
						</button>
					))}
				</div>
			</div>
		</div>
	);
});
