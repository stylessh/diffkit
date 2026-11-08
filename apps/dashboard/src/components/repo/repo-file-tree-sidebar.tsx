import { ChevronRightIcon, FileIcon, FolderIcon } from "@diffkit/icons";
import { Spinner } from "@diffkit/ui/components/spinner";
import { cn } from "@diffkit/ui/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { memo, type ReactNode, useCallback, useMemo, useState } from "react";
import { FileSearchCard } from "#/components/shared/file-search-card";
import {
	useExplorerPath,
	useIsActivePath,
	useIsAncestorPath,
} from "#/lib/explorer-path-store";
import type {
	FileSearchEntry,
	FileSearchResult,
} from "#/lib/fuzzy-file-search";
import {
	type GitHubQueryScope,
	githubQueryKeys,
	githubRepoTreeQueryOptions,
} from "#/lib/github.query";
import type { RepoTreeEntry } from "#/lib/github.types";
import { useHasMounted } from "#/lib/use-has-mounted";

// ---------------------------------------------------------------------------
// Hook to collect all cached tree entries
// ---------------------------------------------------------------------------

function useAllCachedFiles(
	scope: GitHubQueryScope,
	owner: string,
	repo: string,
	ref: string,
): FileSearchEntry[] {
	const queryClient = useQueryClient();

	// Re-derive on every render — the cache is the source of truth
	// and this is only consumed when search is active
	const keyPrefix = githubQueryKeys.repo.tree(scope, {
		owner,
		repo,
		ref,
		path: "",
	});

	const allFiles: FileSearchEntry[] = [];

	const cache = queryClient.getQueriesData<RepoTreeEntry[]>({
		queryKey: keyPrefix.slice(0, 4) as readonly string[],
	});

	for (const [, data] of cache) {
		if (!data) continue;
		for (const entry of data) {
			allFiles.push({
				path: entry.path,
				name: entry.name,
				type: entry.type,
			});
		}
	}

	return allFiles;
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

export const RepoFileTreeSidebar = memo(function RepoFileTreeSidebar({
	owner,
	repoName,
	currentRef,
	scope,
	entries,
	header,
}: {
	owner: string;
	repoName: string;
	currentRef: string;
	scope: GitHubQueryScope;
	entries: RepoTreeEntry[];
	/** Sits on the "Files" row's right (the branch switcher). */
	header?: ReactNode;
}) {
	const navigate = useNavigate();
	const currentPath = useExplorerPath();
	const allFiles = useAllCachedFiles(scope, owner, repoName, currentRef);

	const defaultEntries = useMemo(
		() => allFiles.filter((f) => f.type === "file" && f.path.includes("/")),
		[allFiles],
	);

	const handleSelect = useCallback(
		(entry: FileSearchResult) => {
			const isDir = entry.type === "dir";
			void navigate({
				to: isDir ? "/$owner/$repo/tree/$" : "/$owner/$repo/blob/$",
				params: {
					owner,
					repo: repoName,
					_splat: `${currentRef}/${entry.path}`,
				},
			});
		},
		[navigate, owner, repoName, currentRef],
	);

	return (
		<div className="flex h-full flex-col overflow-hidden">
			<div className="flex h-7 shrink-0 items-center gap-1.5 px-3 mt-3 text-xs font-medium text-muted-foreground">
				<span className="shrink-0">Files</span>
				{header ? <span className="ml-auto flex min-w-0">{header}</span> : null}
			</div>
			{/* the search card brings its own 16px top inset; pull it up to the reference's 8px gap */}
			<div className="-mt-2">
				<FileSearchCard
					entries={allFiles}
					defaultEntries={defaultEntries}
					onSelect={handleSelect}
					activePath={currentPath}
					placeholder="Go to file"
				/>
			</div>

			<nav aria-label="Files" className="flex-1 overflow-y-auto px-2 pb-3">
				{entries.map((entry) => (
					<TreeNode
						key={entry.name}
						entry={entry}
						owner={owner}
						repoName={repoName}
						currentRef={currentRef}
						scope={scope}
						depth={0}
						parentPath=""
					/>
				))}
			</nav>
		</div>
	);
});

// ---------------------------------------------------------------------------
// Tree nodes
// ---------------------------------------------------------------------------

/** A tree row as the reference draws it: 28px, rounded, 13px, 12px a level. */
const treeRowClassName =
	"flex h-7 w-full min-w-0 items-center gap-1.5 rounded-md pr-2 text-[13px] font-[450] transition-colors";

const TreeNode = memo(function TreeNode({
	entry,
	owner,
	repoName,
	currentRef,
	scope,
	depth,
	parentPath,
}: {
	entry: RepoTreeEntry;
	owner: string;
	repoName: string;
	currentRef: string;
	scope: GitHubQueryScope;
	depth: number;
	parentPath: string;
}) {
	const entryPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;
	const isDir = entry.type === "dir";

	if (isDir) {
		return (
			<DirectoryNode
				entry={entry}
				owner={owner}
				repoName={repoName}
				currentRef={currentRef}
				scope={scope}
				depth={depth}
				entryPath={entryPath}
			/>
		);
	}

	return (
		<FileNode
			entry={entry}
			owner={owner}
			repoName={repoName}
			currentRef={currentRef}
			depth={depth}
			entryPath={entryPath}
		/>
	);
});

const DirectoryNode = memo(function DirectoryNode({
	entry,
	owner,
	repoName,
	currentRef,
	scope,
	depth,
	entryPath,
}: {
	entry: RepoTreeEntry;
	owner: string;
	repoName: string;
	currentRef: string;
	scope: GitHubQueryScope;
	depth: number;
	entryPath: string;
}) {
	const isActive = useIsActivePath(entryPath);
	const isAncestor = useIsAncestorPath(entryPath);
	const [isOpen, setIsOpen] = useState(isAncestor || isActive);
	const hasMounted = useHasMounted();

	const treeQuery = useQuery({
		...githubRepoTreeQueryOptions(scope, {
			owner,
			repo: repoName,
			ref: currentRef,
			path: entryPath,
		}),
		enabled: hasMounted && isOpen,
	});

	return (
		<div>
			<div
				className={cn(
					treeRowClassName,
					isActive
						? "bg-item-hover text-foreground"
						: "text-text-header hover:bg-item-hover",
				)}
				style={{ paddingLeft: `${6 + depth * 12}px` }}
			>
				<button
					type="button"
					onClick={() => setIsOpen((prev) => !prev)}
					aria-expanded={isOpen}
					aria-label={`${isOpen ? "Collapse" : "Expand"} ${entry.name}`}
					className="flex size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
				>
					<ChevronRightIcon
						size={12}
						strokeWidth={2}
						className={cn("transition-transform", isOpen && "rotate-90")}
					/>
				</button>
				<Link
					to="/$owner/$repo/tree/$"
					params={{
						owner,
						repo: repoName,
						_splat: `${currentRef}/${entryPath}`,
					}}
					onClick={(e) => {
						if (isActive) {
							e.preventDefault();
							setIsOpen((prev) => !prev);
							return;
						}
						if (!isOpen) setIsOpen(true);
					}}
					aria-current={isActive ? "page" : undefined}
					className="flex h-full min-w-0 flex-1 items-center gap-1.5 rounded-sm"
				>
					<FolderIcon
						size={16}
						strokeWidth={1.8}
						className="shrink-0 text-muted-foreground"
					/>
					<span className="truncate">{entry.name}</span>
				</Link>
			</div>

			{isOpen && (
				<div>
					{treeQuery.isLoading && (
						<div
							className="flex h-7 items-center gap-2 text-xs text-muted-foreground"
							style={{ paddingLeft: `${6 + (depth + 1) * 12 + 22}px` }}
						>
							<Spinner className="size-3" />
							<span>Loading...</span>
						</div>
					)}
					{treeQuery.data?.map((child) => (
						<TreeNode
							key={child.name}
							entry={child}
							owner={owner}
							repoName={repoName}
							currentRef={currentRef}
							scope={scope}
							depth={depth + 1}
							parentPath={entryPath}
						/>
					))}
				</div>
			)}
		</div>
	);
});

const FileNode = memo(function FileNode({
	entry,
	owner,
	repoName,
	currentRef,
	depth,
	entryPath,
}: {
	entry: RepoTreeEntry;
	owner: string;
	repoName: string;
	currentRef: string;
	depth: number;
	entryPath: string;
}) {
	const isActive = useIsActivePath(entryPath);

	return (
		<Link
			to="/$owner/$repo/blob/$"
			params={{
				owner,
				repo: repoName,
				_splat: `${currentRef}/${entryPath}`,
			}}
			onClick={(e) => {
				if (isActive) e.preventDefault();
			}}
			aria-current={isActive ? "page" : undefined}
			className={cn(
				treeRowClassName,
				isActive
					? "bg-item-hover text-foreground"
					: "text-text-header hover:bg-item-hover",
			)}
			style={{ paddingLeft: `${6 + depth * 12 + 22}px` }}
		>
			<FileIcon
				size={16}
				strokeWidth={1.8}
				className="shrink-0 text-muted-foreground"
			/>
			<span className="truncate">{entry.name}</span>
		</Link>
	);
});
