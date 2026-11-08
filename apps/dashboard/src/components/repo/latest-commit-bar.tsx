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
import { RepoAvatar, RepoCardHead } from "./repo-ui";

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
			<RepoCardHead>
				<Skeleton className="size-[18px] shrink-0 rounded-full" />
				<Skeleton className="h-3.5 w-20 shrink-0 rounded" />
				<Skeleton className="h-3.5 min-w-0 flex-1 rounded" />
				<Skeleton className="h-3.5 w-16 shrink-0 rounded" />
			</RepoCardHead>
		);
	}

	if (!commit) return null;

	const shortSha = commit.sha.slice(0, 7);
	const firstLine = commit.message.split("\n")[0];

	return (
		<RepoCardHead>
			{commit.author ? (
				<RepoAvatar src={commit.author.avatarUrl} alt={commit.author.login} />
			) : null}
			<p className="min-w-0 flex-1 truncate font-[450] text-muted-foreground">
				<span className="font-medium text-foreground">
					{commit.author?.login ?? "Unknown"}
				</span>{" "}
				<Link
					to="/$owner/$repo/commit/$sha"
					params={{
						owner,
						repo: repoName,
						sha: commit.sha,
					}}
					className="rounded-sm transition-colors hover:text-foreground"
				>
					{firstLine}
				</Link>
			</p>
			<div className="flex shrink-0 items-center gap-1 text-xs font-[450] text-muted-foreground">
				<Tooltip>
					<TooltipTrigger asChild>
						<Link
							to="/$owner/$repo/commit/$sha"
							params={{ owner, repo: repoName, sha: commit.sha }}
							className="mr-2 rounded-sm font-mono transition-colors hover:text-foreground max-sm:hidden"
						>
							{shortSha}
						</Link>
					</TooltipTrigger>
					<TooltipContent side="bottom">
						<code>{commit.sha}</code>
					</TooltipContent>
				</Tooltip>
				<time dateTime={commit.date} className="mr-1 tabular-nums">
					{formatRelativeTime(commit.date)}
				</time>
				<CommitHistoryLink
					owner={owner}
					repo={repoName}
					ref={ref}
					path={path}
					className="-mr-2"
				/>
			</div>
		</RepoCardHead>
	);
}
