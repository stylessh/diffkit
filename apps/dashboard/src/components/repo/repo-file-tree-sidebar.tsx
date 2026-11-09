import { ChevronRightIcon } from "@diffkit/icons";
import { Spinner } from "@diffkit/ui/components/spinner";
import { cn } from "@diffkit/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { memo, useState } from "react";
import { FileTypeIcon } from "#/components/shared/file-type-icon";
import { useIsActivePath, useIsAncestorPath } from "#/lib/explorer-path-store";
import type { GitHubQueryScope } from "#/lib/github.query";
import type { RepoTreeEntry } from "#/lib/github.types";
import { useDirectoryListing } from "./code/use-directory-listing";

type TreeContext = {
	owner: string;
	repoName: string;
	currentRef: string;
	scope: GitHubQueryScope;
};

export const RepoFileTreeSidebar = memo(function RepoFileTreeSidebar(
	context: TreeContext,
) {
	return (
		<div className="flex h-full flex-col overflow-hidden">
			<div className="flex h-11 shrink-0 items-center border-b-[0.5px] border-header-rule px-4 text-xs font-medium text-muted-foreground">
				Files
			</div>
			<nav aria-label="Files" className="flex-1 overflow-y-auto px-2 py-2">
				<DirectoryChildren context={context} path="" depth={0} />
			</nav>
		</div>
	);
});

const indent = (depth: number) => 6 + depth * 12;

function DirectoryChildren({
	context,
	path,
	depth,
}: {
	context: TreeContext;
	path: string;
	depth: number;
}) {
	const listing = useDirectoryListing(context.scope, {
		owner: context.owner,
		repo: context.repoName,
		ref: context.currentRef,
		path,
	});

	switch (listing.status) {
		case "loading":
			return (
				<div
					className="flex h-7 items-center gap-2 text-xs text-muted-foreground"
					style={{ paddingLeft: indent(depth) + 22 }}
				>
					<Spinner className="size-3" />
					Loading…
				</div>
			);
		case "error":
		case "missing":
			return (
				<p
					className="flex h-7 items-center text-xs text-muted-foreground"
					style={{ paddingLeft: indent(depth) + 22 }}
				>
					Couldn't load files
				</p>
			);
		case "ready":
			return (
				<>
					{listing.entries.map((entry) =>
						entry.type === "dir" ? (
							<DirectoryNode
								key={entry.path}
								entry={entry}
								context={context}
								depth={depth}
							/>
						) : (
							<FileNode
								key={entry.path}
								entry={entry}
								context={context}
								depth={depth}
							/>
						),
					)}
				</>
			);
	}
}

const treeRowClassName =
	"flex h-7 w-full min-w-0 items-center gap-1.5 rounded-md pr-2 text-[13px] font-[450] transition-colors";

function rowStateClassName(isActive: boolean) {
	return isActive
		? "bg-item-hover text-foreground"
		: "text-text-header hover:bg-item-hover";
}

const DirectoryNode = memo(function DirectoryNode({
	entry,
	context,
	depth,
}: {
	entry: RepoTreeEntry;
	context: TreeContext;
	depth: number;
}) {
	const isActive = useIsActivePath(entry.path);
	const isAncestor = useIsAncestorPath(entry.path);
	const [isOpen, setIsOpen] = useState(isAncestor || isActive);

	return (
		<div>
			<div
				className={cn(treeRowClassName, rowStateClassName(isActive))}
				style={{ paddingLeft: indent(depth) }}
			>
				<button
					type="button"
					onClick={() => setIsOpen((open) => !open)}
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
						owner: context.owner,
						repo: context.repoName,
						_splat: `${context.currentRef}/${entry.path}`,
					}}
					onClick={(event) => {
						if (isActive) {
							event.preventDefault();
							setIsOpen((open) => !open);
							return;
						}
						setIsOpen(true);
					}}
					aria-current={isActive ? "page" : undefined}
					className="flex h-full min-w-0 flex-1 items-center gap-1.5 rounded-sm"
				>
					<FileTypeIcon path={entry.path} kind="directory" />
					<span className="truncate">{entry.name}</span>
				</Link>
			</div>
			{isOpen ? (
				<DirectoryChildren
					context={context}
					path={entry.path}
					depth={depth + 1}
				/>
			) : null}
		</div>
	);
});

const FileNode = memo(function FileNode({
	entry,
	context,
	depth,
}: {
	entry: RepoTreeEntry;
	context: TreeContext;
	depth: number;
}) {
	const isActive = useIsActivePath(entry.path);
	return (
		<Link
			to="/$owner/$repo/blob/$"
			params={{
				owner: context.owner,
				repo: context.repoName,
				_splat: `${context.currentRef}/${entry.path}`,
			}}
			onClick={(event) => {
				if (isActive) event.preventDefault();
			}}
			aria-current={isActive ? "page" : undefined}
			className={cn(treeRowClassName, rowStateClassName(isActive))}
			style={{ paddingLeft: indent(depth) + 22 }}
		>
			<FileTypeIcon path={entry.path} kind="file" />
			<span className="truncate">{entry.name}</span>
		</Link>
	);
});
