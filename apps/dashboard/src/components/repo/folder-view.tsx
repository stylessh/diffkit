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
import { cardRowClassName, RepoCard } from "./repo-ui";

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
			<RepoCard>
				<LatestCommitBar
					owner={owner}
					repoName={repoName}
					ref={currentRef}
					scope={scope}
					defaultBranch={repo.defaultBranch}
					defaultBranchTip={repo.latestCommit}
					path={currentPath}
				/>
				<div>
					{entries.map((entry) => (
						<FolderViewRow
							key={entry.sha}
							entry={entry}
							owner={owner}
							repoName={repoName}
							currentRef={currentRef}
							currentPath={currentPath}
							commit={commitsQuery.data?.[entry.name] ?? null}
							isCommitLoading={commitsQuery.isLoading}
						/>
					))}
				</div>
			</RepoCard>

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
}: {
	entry: RepoTreeEntry;
	owner: string;
	repoName: string;
	currentRef: string;
	currentPath: string;
	commit: FileLastCommit | null;
	isCommitLoading: boolean;
}) {
	const Icon = entry.type === "dir" ? FolderIcon : FileIcon;
	const isDir = entry.type === "dir";
	const entryPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;

	return (
		<div className={cardRowClassName}>
			<Link
				to={isDir ? "/$owner/$repo/tree/$" : "/$owner/$repo/blob/$"}
				params={{
					owner,
					repo: repoName,
					_splat: `${currentRef}/${entryPath}`,
				}}
				className="flex w-36 min-w-0 shrink-0 items-center gap-[9px] rounded-sm sm:w-56"
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
						"truncate text-[13px]",
						isDir
							? "font-medium text-foreground"
							: "font-[450] text-text-header",
					)}
				>
					{entry.name}
				</span>
			</Link>
			<div className="min-w-0 flex-1">
				{commit ? (
					<Link
						to="/$owner/$repo/commit/$sha"
						params={{ owner, repo: repoName, sha: commit.sha }}
						className="block truncate rounded-sm text-[13px] font-[450] text-muted-foreground transition-colors hover:text-foreground"
					>
						{commit.message.split("\n")[0]}
					</Link>
				) : isCommitLoading ? (
					<Skeleton className="h-3.5 w-48 max-w-full rounded" />
				) : null}
			</div>
			<span className="w-10 shrink-0 text-right text-xs font-[450] tabular-nums text-muted-foreground">
				{commit?.date ? (
					formatRelativeTime(commit.date, undefined, { compact: true })
				) : isCommitLoading ? (
					<Skeleton className="ml-auto h-3.5 w-8 rounded" />
				) : null}
			</span>
		</div>
	);
}

export function FolderViewSkeleton() {
	const rows = Array.from({ length: 8 }, (_, i) => i);
	return (
		<RepoCard>
			{rows.map((key) => (
				<div key={key} className={cardRowClassName}>
					<Skeleton className="size-4 shrink-0 rounded" />
					<Skeleton className="h-3.5 w-32 rounded" />
					<Skeleton className="h-3.5 flex-1 rounded" />
					<Skeleton className="h-3.5 w-8 shrink-0 rounded" />
				</div>
			))}
		</RepoCard>
	);
}
