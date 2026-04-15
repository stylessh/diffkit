import { ChevronRightIcon, FileIcon, FolderIcon } from "@diffkit/icons";
import { Spinner } from "@diffkit/ui/components/spinner";
import { cn } from "@diffkit/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { memo, useState } from "react";
import {
	type GitHubQueryScope,
	githubRepoTreeQueryOptions,
} from "#/lib/github.query";
import type { RepoTreeEntry } from "#/lib/github.types";
import { useHasMounted } from "#/lib/use-has-mounted";

export const RepoFileTreeSidebar = memo(function RepoFileTreeSidebar({
	owner,
	repoName,
	currentRef,
	currentPath,
	scope,
	entries,
}: {
	owner: string;
	repoName: string;
	currentRef: string;
	currentPath: string;
	scope: GitHubQueryScope;
	entries: RepoTreeEntry[];
}) {
	return (
		<div className="flex h-full flex-col overflow-hidden">
			<div className="flex-1 overflow-y-auto py-1">
				{entries.map((entry) => (
					<TreeNode
						key={entry.name}
						entry={entry}
						owner={owner}
						repoName={repoName}
						currentRef={currentRef}
						currentPath={currentPath}
						scope={scope}
						depth={0}
						parentPath=""
					/>
				))}
			</div>
		</div>
	);
});

const TreeNode = memo(function TreeNode({
	entry,
	owner,
	repoName,
	currentRef,
	currentPath,
	scope,
	depth,
	parentPath,
}: {
	entry: RepoTreeEntry;
	owner: string;
	repoName: string;
	currentRef: string;
	currentPath: string;
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
				currentPath={currentPath}
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
			currentPath={currentPath}
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
	currentPath,
	scope,
	depth,
	entryPath,
}: {
	entry: RepoTreeEntry;
	owner: string;
	repoName: string;
	currentRef: string;
	currentPath: string;
	scope: GitHubQueryScope;
	depth: number;
	entryPath: string;
}) {
	const isActive = currentPath === entryPath;
	const isAncestor = currentPath.startsWith(`${entryPath}/`);
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

	const handleToggle = () => {
		setIsOpen((prev) => !prev);
	};

	return (
		<div>
			<button
				type="button"
				onClick={handleToggle}
				className={cn(
					"flex w-full items-center gap-1.5 px-3 py-1.5 text-[13px] transition-colors hover:bg-surface-1",
					isActive && "bg-surface-1",
				)}
				style={{ paddingLeft: `${depth * 12 + 12}px` }}
			>
				<ChevronRightIcon
					size={14}
					className={cn(
						"shrink-0 text-muted-foreground transition-transform",
						isOpen && "rotate-90",
					)}
				/>
				<FolderIcon
					size={15}
					strokeWidth={1.8}
					className="shrink-0 text-accent-foreground"
				/>
				<span className="truncate text-foreground">{entry.name}</span>
			</button>

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
							currentPath={currentPath}
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
	currentPath,
	depth,
	entryPath,
}: {
	entry: RepoTreeEntry;
	owner: string;
	repoName: string;
	currentRef: string;
	currentPath: string;
	depth: number;
	entryPath: string;
}) {
	const isActive = currentPath === entryPath;

	return (
		<Link
			to="/$owner/$repo/blob/$"
			params={{
				owner,
				repo: repoName,
				_splat: `${currentRef}/${entryPath}`,
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
