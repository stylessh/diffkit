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
import { cardRowClassName } from "./repo-ui";

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
		<div>
			{entries.map((entry) => (
				<FileTreeRow
					key={entry.sha}
					entry={entry}
					owner={owner}
					repo={repo}
					currentRef={currentRef}
					commit={commitsQuery.data?.[entry.name] ?? null}
					isCommitLoading={commitsQuery.isLoading}
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
}: {
	entry: RepoTreeEntry;
	owner: string;
	repo: string;
	currentRef: string;
	commit: FileLastCommit | null;
	isCommitLoading: boolean;
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
			className={cardRowClassName}
		>
			<Icon
				size={16}
				strokeWidth={1.8}
				className={cn(
					"shrink-0",
					isDir ? "text-text-header" : "text-muted-foreground",
				)}
			/>
			<span
				className={cn(
					"w-28 shrink-0 truncate text-[13px] sm:w-40",
					isDir ? "font-medium text-foreground" : "font-[450] text-text-header",
				)}
			>
				{entry.name}
			</span>
			<span className="min-w-0 flex-1 truncate text-[13px] font-[450] text-muted-foreground">
				{commit ? (
					commit.message.split("\n")[0]
				) : isCommitLoading ? (
					<Skeleton className="h-3.5 w-48 max-w-full rounded" />
				) : null}
			</span>
			<span className="w-10 shrink-0 text-right text-xs font-[450] tabular-nums text-muted-foreground">
				{commit?.date ? (
					formatRelativeTime(commit.date, undefined, { compact: true })
				) : isCommitLoading ? (
					<Skeleton className="ml-auto h-3.5 w-8 rounded" />
				) : null}
			</span>
		</Link>
	);
}
