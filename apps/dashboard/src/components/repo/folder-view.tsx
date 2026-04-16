import { FileIcon, FolderIcon } from "@diffkit/icons";
import { Skeleton } from "@diffkit/ui/components/skeleton";
import { cn } from "@diffkit/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { formatRelativeTime } from "#/lib/format-relative-time";
import {
	type GitHubQueryScope,
	githubFileLastCommitQueryOptions,
} from "#/lib/github.query";
import type { RepoOverview, RepoTreeEntry } from "#/lib/github.types";
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
	return (
		<div className="flex flex-col gap-6">
			<div>
				<LatestCommitBar repo={repo} />
				<div className="overflow-hidden rounded-b-lg border">
					{entries.map((entry, index) => (
						<FolderViewRow
							key={entry.sha}
							entry={entry}
							owner={owner}
							repoName={repoName}
							currentRef={currentRef}
							currentPath={currentPath}
							scope={scope}
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
	scope,
	isLast,
}: {
	entry: RepoTreeEntry;
	owner: string;
	repoName: string;
	currentRef: string;
	currentPath: string;
	scope: GitHubQueryScope;
	isLast: boolean;
}) {
	const Icon = entry.type === "dir" ? FolderIcon : FileIcon;
	const isDir = entry.type === "dir";
	const entryPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;

	const commitQuery = useQuery(
		githubFileLastCommitQueryOptions(scope, {
			owner,
			repo: repoName,
			ref: currentRef,
			path: entryPath,
		}),
	);

	const commit = commitQuery.data;

	return (
		<Link
			to={isDir ? "/$owner/$repo/tree/$" : "/$owner/$repo/blob/$"}
			params={{
				owner,
				repo: repoName,
				_splat: `${currentRef}/${entryPath}`,
			}}
			className={cn(
				"grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_80px] items-center gap-4 px-4 py-2 text-sm hover:bg-surface-1",
				!isLast && "border-b",
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
				) : commitQuery.isLoading ? (
					<Skeleton className="h-3.5 w-48 rounded" />
				) : null}
			</span>
			<span className="text-right text-xs text-muted-foreground">
				{commit?.date ? (
					formatRelativeTime(commit.date)
				) : commitQuery.isLoading ? (
					<Skeleton className="ml-auto h-3.5 w-12 rounded" />
				) : null}
			</span>
		</Link>
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
