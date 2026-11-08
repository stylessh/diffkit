import { FileIcon, FolderIcon } from "@diffkit/icons";
import { Skeleton } from "@diffkit/ui/components/skeleton";
import { cn } from "@diffkit/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { formatRelativeTime } from "#/lib/format-relative-time";
import {
	type GitHubQueryScope,
	githubTreeEntryCommitsQueryOptions,
} from "#/lib/github.query";
import type { FileLastCommit, RepoTreeEntry } from "#/lib/github.types";

export function FileTree({
	entries,
	owner,
	repo,
	currentRef,
	scope,
}: {
	entries: RepoTreeEntry[];
	owner: string;
	repo: string;
	currentRef: string;
	scope: GitHubQueryScope;
}) {
	const entryNames = useMemo(() => entries.map((e) => e.name), [entries]);

	const commitsQuery = useQuery(
		githubTreeEntryCommitsQueryOptions(scope, {
			owner,
			repo,
			ref: currentRef,
			dirPath: "",
			entries: entryNames,
		}),
	);

	return (
		<div className="overflow-hidden rounded-b-lg border-[0.5px]">
			{entries.map((entry, index) => (
				<FileTreeRow
					key={entry.sha}
					entry={entry}
					owner={owner}
					repo={repo}
					currentRef={currentRef}
					commit={commitsQuery.data?.[entry.name] ?? null}
					isCommitLoading={commitsQuery.isLoading}
					isLast={index === entries.length - 1}
				/>
			))}
		</div>
	);
}

function FileTreeRow({
	entry,
	owner,
	repo,
	currentRef,
	commit,
	isCommitLoading,
	isLast,
}: {
	entry: RepoTreeEntry;
	owner: string;
	repo: string;
	currentRef: string;
	commit: FileLastCommit | null;
	isCommitLoading: boolean;
	isLast: boolean;
}) {
	const Icon = entry.type === "dir" ? FolderIcon : FileIcon;
	const isDir = entry.type === "dir";

	return (
		<Link
			to={isDir ? "/$owner/$repo/tree/$" : "/$owner/$repo/blob/$"}
			params={{
				owner,
				repo,
				_splat: `${currentRef}/${entry.name}`,
			}}
			className={cn(
				"grid grid-cols-[200px_minmax(0,1fr)_80px] items-center gap-4 px-4 py-2 text-sm hover:bg-surface-1",
				!isLast && "border-b-[0.5px]",
			)}
		>
			<div className="flex min-w-0 items-center gap-2.5">
				<Icon
					size={15}
					strokeWidth={1.8}
					className={cn(
						"shrink-0",
						isDir ? "text-accent-foreground" : "text-muted-foreground",
					)}
				/>
				<span
					className={cn(
						"truncate",
						isDir ? "font-medium text-accent-foreground" : "text-foreground",
					)}
				>
					{entry.name}
				</span>
			</div>
			<span className="truncate text-muted-foreground">
				{commit ? (
					commit.message.split("\n")[0]
				) : isCommitLoading ? (
					<Skeleton className="h-3.5 w-48 rounded" />
				) : null}
			</span>
			<span className="text-right text-xs text-muted-foreground">
				{commit?.date ? (
					formatRelativeTime(commit.date)
				) : isCommitLoading ? (
					<Skeleton className="ml-auto h-3.5 w-12 rounded" />
				) : null}
			</span>
		</Link>
	);
}
