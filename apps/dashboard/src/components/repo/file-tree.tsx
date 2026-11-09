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
	const isSample = useIsSkeletonSample();
	const entryNames = useMemo(() => entries.map((e) => e.name), [entries]);

	const commitsQuery = useQuery({
		...githubTreeEntryCommitsQueryOptions(scope, {
			owner,
			repo,
			ref: currentRef,
			dirPath: "",
			entries: entryNames,
		}),
		enabled: !isSample && entryNames.length > 0,
	});

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
					isCommitLoading={isSample || commitsQuery.isLoading}
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
			<FileTypeIcon path={entry.name} kind={isDir ? "directory" : "file"} />
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
					<SkeletonBox
						width={192}
						height={14}
						radius={4}
						className="max-w-full"
					/>
				) : null}
			</span>
			<span className="w-10 shrink-0 text-right text-xs font-[450] tabular-nums text-muted-foreground">
				{commit?.date ? (
					formatRelativeTime(commit.date, undefined, { compact: true })
				) : isCommitLoading ? (
					<SkeletonBox width={32} height={14} radius={4} className="ml-auto" />
				) : null}
			</span>
		</Link>
	);
}
