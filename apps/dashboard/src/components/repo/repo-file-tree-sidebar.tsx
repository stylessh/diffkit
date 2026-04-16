import { ChevronRightIcon, FileIcon, FolderIcon } from "@diffkit/icons";
import { Spinner } from "@diffkit/ui/components/spinner";
import { cn } from "@diffkit/ui/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { memo, useCallback, useMemo, useState } from "react";
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
}: {
	owner: string;
	repoName: string;
	currentRef: string;
	scope: GitHubQueryScope;
	entries: RepoTreeEntry[];
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
			<FileSearchCard
				entries={allFiles}
				defaultEntries={defaultEntries}
				onSelect={handleSelect}
				activePath={currentPath}
				placeholder="Search files..."
			/>

			<div className="flex-1 overflow-y-auto py-1">
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
			</div>
		</div>
	);
});

// ---------------------------------------------------------------------------
// Tree nodes
// ---------------------------------------------------------------------------

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
					"flex w-full items-center text-[13px] transition-colors hover:bg-surface-1",
					isActive && "bg-surface-1",
				)}
			>
				<button
					type="button"
					onClick={() => setIsOpen((prev) => !prev)}
					className="shrink-0 py-1.5 pl-3 text-muted-foreground"
					style={{ paddingLeft: `${depth * 12 + 12}px` }}
				>
					<ChevronRightIcon
						size={12}
						className={cn(
							"shrink-0 transition-transform",
							isOpen && "rotate-90",
						)}
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
					className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 pl-1.5 pr-3"
				>
					<FolderIcon
						size={15}
						strokeWidth={1.8}
						className="shrink-0 text-accent-foreground"
					/>
					<span className="truncate text-foreground">{entry.name}</span>
				</Link>
			</div>

			{isOpen && (
				<div>
					{treeQuery.isLoading && (
						<div
							className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground"
							style={{ paddingLeft: `${(depth + 1) * 12 + 12}px` }}
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
			className={cn(
				"flex w-full items-center gap-1.5 px-3 py-1.5 text-[13px] transition-colors hover:bg-surface-1",
				isActive && "bg-surface-1",
			)}
			style={{ paddingLeft: `${depth * 12 + 26}px` }}
		>
			<FileIcon
				size={15}
				strokeWidth={1.8}
				className="shrink-0 text-muted-foreground"
			/>
			<span
				className={cn(
					"truncate",
					isActive ? "text-foreground" : "text-muted-foreground",
				)}
			>
				{entry.name}
			</span>
		</Link>
	);
});
