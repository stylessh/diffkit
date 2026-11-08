import { CheckIcon, CopyIcon, PanelLeftIcon } from "@diffkit/icons";
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
import { cn } from "@diffkit/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { getExplorerPath, setExplorerPath } from "#/lib/explorer-path-store";
import {
	type GitHubQueryScope,
	githubRepoOverviewQueryOptions,
	githubRepoTreeQueryOptions,
} from "#/lib/github.query";
import { useHasMounted } from "#/lib/use-has-mounted";
import { useRegisterTab } from "#/lib/use-register-tab";
import { BranchComparisonBanner } from "./branch-comparison-banner";
import { BranchSelector } from "./code-explorer-toolbar";
import { CodeFileView } from "./code-file-view";
import { FolderView, FolderViewSkeleton } from "./folder-view";
import { RepoFileTreeSidebar } from "./repo-file-tree-sidebar";
import { RepoHeader } from "./repo-header";
import { iconButtonClassName } from "./repo-ui";
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

	const header = (
		<RepoHeader owner={owner} repo={repoName} scope={scope} active="code" />
	);

	if (!repoData) {
		return (
			<div className="flex h-full min-h-0 flex-col">
				{header}
				<ExplorerSkeleton />
			</div>
		);
	}

	const treeEntries =
		viewMode === "tree"
			? currentPath === ""
				? rootTreeQuery.data
				: currentTreeQuery.data
			: null;

	const branchSelector = (
		<BranchSelector
			repo={repoData}
			currentRef={activeRef}
			scope={scope}
			onBranchChange={handleBranchChange}
			className="max-w-44"
		/>
	);

	const contentPane = (
		<div className="h-full overflow-y-auto">
			<div className="mx-auto flex max-w-[1080px] flex-col px-4 pt-4 pb-16 md:px-6">
				{!isDesktop ? (
					<div className="mb-3 flex items-center gap-1.5">
						<button
							type="button"
							onClick={handleOpenFileSheet}
							className={iconButtonClassName}
							aria-label="Open file tree"
						>
							<PanelLeftIcon size={16} strokeWidth={2} />
						</button>
						{branchSelector}
					</div>
				) : null}
				{activeRef !== repoData.defaultBranch && (
					<div className="mb-3">
						<BranchComparisonBanner
							owner={owner}
							repo={repoName}
							scope={scope}
							currentBranch={activeRef}
							defaultBranch={repoData.defaultBranch}
						/>
					</div>
				)}
				<RepoPathBreadcrumb
					owner={owner}
					repoName={repoName}
					currentRef={activeRef}
					path={currentPath}
				/>
				<div className="mt-3">
					{viewMode === "blob" ? (
						<CodeFileView
							owner={owner}
							repo={repoName}
							currentRef={activeRef}
							path={currentPath}
							scope={scope}
						/>
					) : treeEntries ? (
						<FolderView
							entries={treeEntries}
							repo={repoData}
							owner={owner}
							repoName={repoName}
							currentRef={activeRef}
							currentPath={currentPath}
							scope={scope}
						/>
					) : (
						<FolderViewSkeleton />
					)}
				</div>
			</div>
		</div>
	);

	const sidebarContent = rootTreeQuery.data ? (
		<RepoFileTreeSidebar
			owner={owner}
			repoName={repoName}
			currentRef={activeRef}
			scope={scope}
			entries={rootTreeQuery.data}
			header={isDesktop ? branchSelector : undefined}
		/>
	) : null;

	return (
		<div className="flex h-full min-h-0 flex-col">
			{header}
			<div className="flex min-h-0 flex-1 border-t-[0.5px] border-header-rule">
				{isDesktop ? (
					<ResizablePanelGroup direction="horizontal" className="flex-1">
						<ResizablePanel defaultSize={22} minSize={14} maxSize={40}>
							{sidebarContent}
						</ResizablePanel>

						<ResizableHandle className="w-[0.5px] bg-header-rule" />

						<ResizablePanel defaultSize={78}>{contentPane}</ResizablePanel>
					</ResizablePanelGroup>
				) : (
					<>
						<div className="min-w-0 flex-1 overflow-hidden">{contentPane}</div>
						<Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
							<DrawerContent className="max-h-[70dvh]">
								<DrawerTitle className="sr-only">File tree</DrawerTitle>
								{sidebarContent}
							</DrawerContent>
						</Drawer>
					</>
				)}
			</div>
		</div>
	);
}

function RepoPathBreadcrumb({
	owner,
	repoName,
	currentRef,
	path,
}: {
	owner: string;
	repoName: string;
	currentRef: string;
	path: string;
}) {
	const [copied, setCopied] = useState(false);
	const segments = path ? path.split("/") : [];
	return (
		<nav
			aria-label="Path"
			className="flex min-h-7 min-w-0 flex-wrap items-center gap-1 text-[13px] font-medium"
		>
			<Link
				to="/$owner/$repo"
				params={{ owner, repo: repoName }}
				className="rounded-sm text-indigo hover:underline"
			>
				{repoName}
			</Link>
			{segments.map((segment, index) => {
				const segmentPath = segments.slice(0, index + 1).join("/");
				const isLast = index === segments.length - 1;
				return (
					<span key={segmentPath} className="flex min-w-0 items-center gap-1">
						<span aria-hidden className="text-icon-faint">
							/
						</span>
						{isLast ? (
							<span aria-current="page" className="truncate text-foreground">
								{segment}
							</span>
						) : (
							<Link
								to="/$owner/$repo/tree/$"
								params={{
									owner,
									repo: repoName,
									_splat: `${currentRef}/${segmentPath}`,
								}}
								className="rounded-sm text-indigo hover:underline"
							>
								{segment}
							</Link>
						)}
					</span>
				);
			})}
			{path ? (
				<button
					type="button"
					aria-label={copied ? "Copied" : "Copy path"}
					onClick={() => {
						void navigator.clipboard?.writeText(path).then(() => {
							setCopied(true);
							setTimeout(() => setCopied(false), 1500);
						});
					}}
					className={cn(iconButtonClassName, "ml-1 size-6")}
				>
					{copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
				</button>
			) : null}
		</nav>
	);
}

function ExplorerSkeleton() {
	return (
		<div className="flex min-h-0 flex-1 border-t-[0.5px] border-header-rule">
			<div className="hidden w-[22%] shrink-0 flex-col gap-2 border-r-[0.5px] border-header-rule p-3 md:flex">
				<Skeleton className="h-7 w-full rounded-lg" />
				{["a", "b", "c", "d", "e", "f"].map((key) => (
					<Skeleton key={key} className="h-4 w-3/4 rounded" />
				))}
			</div>
			<div className="flex-1 px-6 pt-4">
				<Skeleton className="h-5 w-48 rounded" />
				<Skeleton className="mt-3 h-64 w-full rounded-lg" />
			</div>
		</div>
	);
}
