import { ChevronLeftIcon, PanelLeftIcon } from "@diffkit/icons";
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
import { Skeleton } from "@diffkit/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
	memo,
	useCallback,
	useMemo,
	useState,
	useSyncExternalStore,
} from "react";
import { getExplorerPath, setExplorerPath } from "#/lib/explorer-path-store";
import {
	type GitHubQueryScope,
	githubRepoOverviewQueryOptions,
	githubRepoTreeQueryOptions,
} from "#/lib/github.query";
import type { RepoOverview } from "#/lib/github.types";
import { useHasMounted } from "#/lib/use-has-mounted";
import { useRegisterTab } from "#/lib/use-register-tab";
import { CodeExplorerToolbar } from "./code-explorer-toolbar";
import { CodeFileView } from "./code-file-view";
import { FolderView, FolderViewSkeleton } from "./folder-view";
import { RepoFileTreeSidebar } from "./repo-file-tree-sidebar";
import { usePrefetchTree } from "./use-prefetch-tree";

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

export function RepoExplorerLayout({
	owner,
	repo: repoName,
	scope,
	currentRef: currentRefProp,
	currentPath,
	viewMode,
}: {
	owner: string;
	repo: string;
	scope: GitHubQueryScope;
	currentRef: string | null;
	currentPath: string;
	viewMode: "tree" | "blob";
}) {
	const hasMounted = useHasMounted();
	const navigate = useNavigate();
	const isDesktop = useIsDesktop();
	const [drawerOpen, setDrawerOpen] = useState(false);

	const overviewQuery = useQuery({
		...githubRepoOverviewQueryOptions(scope, { owner, repo: repoName }),
		enabled: hasMounted,
	});

	const repoData = overviewQuery.data;
	const activeRef = currentRefProp ?? repoData?.defaultBranch ?? "main";

	// Sync the explorer path store so tree nodes can subscribe to derived
	// isActive booleans instead of receiving currentPath as a prop.
	// Called during render (not in an effect) so children read the correct
	// value on their first render pass — critical for DirectoryNode's
	// initial isOpen state.  The internal guard (if path === current) makes
	// duplicate calls in StrictMode a no-op.
	setExplorerPath(currentPath);

	useRegisterTab(
		repoData
			? {
					type: "repo",
					title: `${owner}/${repoData.name}`,
					url: `/${owner}/${repoName}`,
					repo: `${owner}/${repoName}`,
					iconColor: "text-muted-foreground",
					avatarUrl: repoData.ownerAvatarUrl,
				}
			: null,
	);

	const rootTreeQuery = useQuery({
		...githubRepoTreeQueryOptions(scope, {
			owner,
			repo: repoName,
			ref: activeRef,
			path: "",
		}),
		enabled: hasMounted && !!repoData,
	});

	const prefetchInput = useMemo(
		() => ({ owner, repo: repoName, ref: activeRef }),
		[owner, repoName, activeRef],
	);
	usePrefetchTree(scope, prefetchInput, rootTreeQuery.data);

	const currentTreeQuery = useQuery({
		...githubRepoTreeQueryOptions(scope, {
			owner,
			repo: repoName,
			ref: activeRef,
			path: currentPath,
		}),
		enabled:
			hasMounted && !!repoData && viewMode === "tree" && currentPath !== "",
	});

	const handleBranchChange = useCallback(
		(branch: string) => {
			const path = getExplorerPath();
			if (path) {
				void navigate({
					to:
						viewMode === "blob"
							? "/$owner/$repo/blob/$"
							: "/$owner/$repo/tree/$",
					params: {
						owner,
						repo: repoName,
						_splat: `${branch}/${path}`,
					},
				});
			} else {
				void navigate({
					to: "/$owner/$repo",
					params: { owner, repo: repoName },
				});
			}
		},
		[navigate, owner, repoName, viewMode],
	);

	const handleOpenFileSheet = useCallback(() => setDrawerOpen(true), []);

	if (overviewQuery.error) throw overviewQuery.error;
	if (!repoData) return <ExplorerSkeleton />;

	const treeEntries =
		viewMode === "tree"
			? currentPath === ""
				? rootTreeQuery.data
				: currentTreeQuery.data
			: null;

	const contentPane =
		viewMode === "blob" ? (
			<div className="h-full overflow-y-auto p-4">
				<CodeFileView
					owner={owner}
					repo={repoName}
					currentRef={activeRef}
					path={currentPath}
					scope={scope}
				/>
			</div>
		) : treeEntries ? (
			<div className="h-full overflow-y-auto p-4">
				<FolderView
					entries={treeEntries}
					repo={repoData}
					owner={owner}
					repoName={repoName}
					currentRef={activeRef}
					currentPath={currentPath}
					scope={scope}
				/>
			</div>
		) : (
			<div className="h-full overflow-y-auto p-4">
				<FolderViewSkeleton />
			</div>
		);

	const sidebarContent = rootTreeQuery.data ? (
		<RepoFileTreeSidebar
			owner={owner}
			repoName={repoName}
			currentRef={activeRef}
			scope={scope}
			entries={rootTreeQuery.data}
		/>
	) : null;

	return (
		<div className="flex h-full flex-col">
			<ExplorerToolbar
				owner={owner}
				repoName={repoName}
				repo={repoData}
				currentRef={activeRef}
				scope={scope}
				onBranchChange={handleBranchChange}
				onOpenFileSheet={handleOpenFileSheet}
				isDesktop={isDesktop}
			/>

			{isDesktop ? (
				<ResizablePanelGroup direction="horizontal" className="flex-1">
					<ResizablePanel defaultSize={20} minSize={12} maxSize={40}>
						{sidebarContent}
					</ResizablePanel>

					<ResizableHandle />

					<ResizablePanel defaultSize={80}>{contentPane}</ResizablePanel>
				</ResizablePanelGroup>
			) : (
				<>
					<div className="flex-1 overflow-hidden">{contentPane}</div>
					<Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
						<DrawerContent className="max-h-[70dvh]">
							<DrawerTitle className="sr-only">File tree</DrawerTitle>
							{sidebarContent}
						</DrawerContent>
					</Drawer>
				</>
			)}
		</div>
	);
}

const ExplorerToolbar = memo(function ExplorerToolbar({
	owner,
	repoName,
	repo,
	currentRef,
	scope,
	onBranchChange,
	onOpenFileSheet,
	isDesktop,
}: {
	owner: string;
	repoName: string;
	repo: RepoOverview;
	currentRef: string;
	scope: GitHubQueryScope;
	onBranchChange: (branch: string) => void;
	onOpenFileSheet: () => void;
	isDesktop: boolean;
}) {
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
				params={{ owner, repo: repoName }}
				className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
			>
				<ChevronLeftIcon size={16} />
				<span className="font-medium">
					{owner}/{repoName}
				</span>
			</Link>

			<div className="ml-auto">
				<CodeExplorerToolbar
					repo={repo}
					currentRef={currentRef}
					scope={scope}
					onBranchChange={onBranchChange}
				/>
			</div>
		</div>
	);
});

function ExplorerSkeleton() {
	return (
		<div className="flex h-full flex-col">
			<div className="flex shrink-0 items-center gap-3 border-b bg-surface-0 px-4 py-2">
				<Skeleton className="h-5 w-32 rounded" />
				<div className="ml-auto">
					<Skeleton className="h-8 w-24 rounded-md" />
				</div>
			</div>
			<div className="flex-1 p-4">
				<Skeleton className="h-full w-full rounded-lg" />
			</div>
		</div>
	);
}
