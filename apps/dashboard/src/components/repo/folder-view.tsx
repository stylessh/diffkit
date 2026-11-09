import { cn } from "@diffkit/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { SkeletonBox } from "skullet/react";
import { FileTypeIcon } from "#/components/shared/file-type-icon";
import { useIsSkeletonSample } from "#/components/shared/skeleton-sample";
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
	const isSample = useIsSkeletonSample();
	const entryNames = useMemo(() => entries.map((e) => e.name), [entries]);

	const commitsQuery = useQuery({
		...githubTreeEntryCommitsQueryOptions(scope, {
			owner,
			repo: repoName,
			ref: currentRef,
			dirPath: currentPath,
			entries: entryNames,
		}),
		enabled: !isSample && entryNames.length > 0,
	});

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
							isCommitLoading={isSample || commitsQuery.isLoading}
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
				<FileTypeIcon path={entryPath} kind={isDir ? "directory" : "file"} />
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
					<SkeletonBox
						width={192}
						height={14}
						radius={4}
						className="max-w-full"
					/>
				) : null}
			</div>
			<span className="w-10 shrink-0 text-right text-xs font-[450] tabular-nums text-muted-foreground">
				{commit?.date ? (
					formatRelativeTime(commit.date, undefined, { compact: true })
				) : isCommitLoading ? (
					<SkeletonBox width={32} height={14} radius={4} className="ml-auto" />
				) : null}
			</span>
		</div>
	);
}
