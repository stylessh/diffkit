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
import type {
	FileLastCommit,
	RepoOverview,
	RepoTreeEntry,
} from "#/lib/github.types";
import { LatestCommitBar } from "./latest-commit-bar";
import { RepoMarkdownFiles } from "./repo-markdown-files";

export function FolderView({
	entries,
	repo,
	owner,
	repoName,
	currentRef,
	currentPath,
	scope,
}: {
	entries: RepoTreeEntry[];
	repo: RepoOverview;
	owner: string;
	repoName: string;
	currentRef: string;
	currentPath: string;
	scope: GitHubQueryScope;
}) {
	const entryNames = useMemo(() => entries.map((e) => e.name), [entries]);

	const commitsQuery = useQuery(
		githubTreeEntryCommitsQueryOptions(scope, {
			owner,
			repo: repoName,
			ref: currentRef,
			dirPath: currentPath,
			entries: entryNames,
		}),
	);

	return (
		<div className="flex flex-col gap-6">
			<div>
				<LatestCommitBar
					owner={owner}
					repoName={repoName}
					ref={currentRef}
					scope={scope}
					defaultBranch={repo.defaultBranch}
					defaultBranchTip={repo.latestCommit}
					path={currentPath}
					historyLabel="History"
				/>
				<div className="overflow-hidden rounded-b-lg border">
					{entries.map((entry, index) => (
						<FolderViewRow
							key={entry.sha}
							entry={entry}
							owner={owner}
							repoName={repoName}
							currentRef={currentRef}
							currentPath={currentPath}
							commit={commitsQuery.data?.[entry.name] ?? null}
							isCommitLoading={commitsQuery.isLoading}
							isLast={index === entries.length - 1}
						/>
					))}
				</div>
			</div>

			<RepoMarkdownFiles
				entries={entries}
				owner={owner}
				repo={repoName}
				currentRef={currentRef}
				scope={scope}
			/>
		</div>
	);
}

function FolderViewRow({
	entry,
	owner,
	repoName,
	currentRef,
	currentPath,
	commit,
	isCommitLoading,
	isLast,
}: {
	entry: RepoTreeEntry;
	owner: string;
	repoName: string;
	currentRef: string;
	currentPath: string;
	commit: FileLastCommit | null;
	isCommitLoading: boolean;
	isLast: boolean;
}) {
	const Icon = entry.type === "dir" ? FolderIcon : FileIcon;
	const isDir = entry.type === "dir";
	const entryPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;

	return (
		<div
			className={cn(
				"grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_80px] items-center gap-4 px-4 py-2 text-sm hover:bg-surface-1",
				!isLast && "border-b",
			)}
		>
			<Link
				to={isDir ? "/$owner/$repo/tree/$" : "/$owner/$repo/blob/$"}
				params={{
					owner,
					repo: repoName,
					_splat: `${currentRef}/${entryPath}`,
				}}
				className="flex min-w-0 items-center gap-2.5"
			>
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
			</Link>
			<div className="min-w-0">
				{commit ? (
					<Link
						to="/$owner/$repo/commit/$sha"
						params={{ owner, repo: repoName, sha: commit.sha }}
						className="block truncate text-muted-foreground transition-colors hover:text-foreground hover:underline"
					>
						{commit.message.split("\n")[0]}
					</Link>
				) : isCommitLoading ? (
					<Skeleton className="h-3.5 w-48 rounded" />
				) : null}
			</div>
			<span className="text-right text-xs text-muted-foreground">
				{commit?.date ? (
					formatRelativeTime(commit.date)
				) : isCommitLoading ? (
					<Skeleton className="ml-auto h-3.5 w-12 rounded" />
				) : null}
			</span>
		</div>
	);
}

export function FolderViewSkeleton() {
	const rows = Array.from({ length: 8 }, (_, i) => i);
	return (
		<div className="overflow-hidden rounded-lg border">
			{rows.map((key) => (
				<div
					key={key}
					className="flex items-center gap-4 border-b px-4 py-2.5 last:border-b-0"
				>
					<div className="size-4 shrink-0 animate-pulse rounded bg-surface-1" />
					<div className="h-4 w-32 animate-pulse rounded-md bg-surface-1" />
					<div className="h-4 flex-1 animate-pulse rounded-md bg-surface-1" />
					<div className="h-4 w-12 shrink-0 animate-pulse rounded-md bg-surface-1" />
				</div>
			))}
		</div>
	);
}
