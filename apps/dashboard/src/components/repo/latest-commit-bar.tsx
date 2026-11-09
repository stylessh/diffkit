import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@diffkit/ui/components/tooltip";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Skeleton } from "skullet/react";
import { useIsSkeletonSample } from "#/components/shared/skeleton-sample";
import { formatRelativeTime } from "#/lib/format-relative-time";
import {
	type GitHubQueryScope,
	githubRefHeadCommitQueryOptions,
} from "#/lib/github.query";
import type { FileLastCommit, RepoOverview } from "#/lib/github.types";
import { CommitHistoryLink } from "./commits/commit-history-link";
import { SAMPLE_COMMIT } from "./repo-samples";
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
	const isSample = useIsSkeletonSample();
	const tipQuery = useQuery({
		...githubRefHeadCommitQueryOptions(scope, {
			owner,
			repo: repoName,
			ref,
		}),
		enabled: !isSample,
		placeholderData:
			ref === defaultBranch && defaultBranchTip != null
				? defaultBranchTip
				: undefined,
	});

	const commit = isSample ? SAMPLE_COMMIT : tipQuery.data;
	if (!commit && !tipQuery.isPending) return null;

	return (
		<Skeleton
			data={commit}
			sample={SAMPLE_COMMIT}
			label="Loading latest commit"
		>
			{(commit) => (
				<LatestCommitHead
					commit={commit}
					owner={owner}
					repoName={repoName}
					ref={ref}
					path={path}
				/>
			)}
		</Skeleton>
	);
}

function LatestCommitHead({
	commit,
	owner,
	repoName,
	ref,
	path,
}: {
	commit: FileLastCommit;
	owner: string;
	repoName: string;
	ref: string;
	path?: string;
}) {
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
