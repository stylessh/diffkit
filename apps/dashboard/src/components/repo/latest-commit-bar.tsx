import { GitCommitIcon } from "@diffkit/icons";
import { Skeleton } from "@diffkit/ui/components/skeleton";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@diffkit/ui/components/tooltip";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { formatRelativeTime } from "#/lib/format-relative-time";
import {
	type GitHubQueryScope,
	githubRefHeadCommitQueryOptions,
} from "#/lib/github.query";
import type { RepoOverview } from "#/lib/github.types";
import { CommitHistoryLink } from "./commits/commit-history-link";

export function LatestCommitBar({
	owner,
	repoName,
	ref,
	scope,
	defaultBranch,
	defaultBranchTip,
	path,
}: {
	owner: string;
	repoName: string;
	ref: string;
	scope: GitHubQueryScope;
	defaultBranch: string;
	defaultBranchTip: RepoOverview["latestCommit"];
	/** Directory being browsed — scopes the History link. */
	path?: string;
}) {
	const tipQuery = useQuery({
		...githubRefHeadCommitQueryOptions(scope, {
			owner,
			repo: repoName,
			ref,
		}),
		placeholderData:
			ref === defaultBranch && defaultBranchTip != null
				? defaultBranchTip
				: undefined,
	});

	const commit = tipQuery.data;

	if (tipQuery.isPending && commit == null) {
		return (
			<div className="flex items-center gap-3 rounded-t-lg border border-b-0 bg-surface-1 px-4 py-2.5 text-sm">
				<Skeleton className="size-5 shrink-0 rounded-full" />
				<Skeleton className="h-4 w-20 shrink-0 rounded" />
				<Skeleton className="h-4 min-w-0 flex-1 rounded" />
				<Skeleton className="h-4 w-24 shrink-0 rounded" />
			</div>
		);
	}

	if (!commit) return null;

	const shortSha = commit.sha.slice(0, 7);
	const firstLine = commit.message.split("\n")[0];

	return (
		<div className="flex items-center gap-3 rounded-t-lg border border-b-0 bg-surface-1 px-4 py-2.5 text-sm">
			{commit.author && (
				<img
					src={commit.author.avatarUrl}
					alt={commit.author.login}
					className="size-5 shrink-0 rounded-full"
				/>
			)}
			<span className="font-medium">{commit.author?.login ?? "Unknown"}</span>
			<Link
				to="/$owner/$repo/commit/$sha"
				params={{
					owner,
					repo: repoName,
					sha: commit.sha,
				}}
				className="min-w-0 flex-1 truncate text-left text-muted-foreground transition-colors hover:text-foreground hover:underline"
			>
				{firstLine}
			</Link>
			<div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
				<Tooltip>
					<TooltipTrigger asChild>
						<span className="flex items-center gap-1">
							<GitCommitIcon size={14} />
							<code>{shortSha}</code>
						</span>
					</TooltipTrigger>
					<TooltipContent side="bottom">
						<code>{commit.sha}</code>
					</TooltipContent>
				</Tooltip>
				<span>{formatRelativeTime(commit.date)}</span>
				<CommitHistoryLink
					owner={owner}
					repo={repoName}
					ref={ref}
					path={path}
					className="-mr-1.5"
				/>
			</div>
		</div>
	);
}
