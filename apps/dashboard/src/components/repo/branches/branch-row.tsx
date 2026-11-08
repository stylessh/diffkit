import {
	GitCommitIcon,
	GitCompareIcon,
	GitMergeIcon,
	GitPullRequestClosedIcon,
	GitPullRequestDraftIcon,
	GitPullRequestIcon,
} from "@diffkit/icons";
import { Skeleton } from "@diffkit/ui/components/skeleton";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@diffkit/ui/components/tooltip";
import { cn } from "@diffkit/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { memo } from "react";
import { formatRelativeTime } from "#/lib/format-relative-time";
import type { GitHubQueryScope } from "#/lib/github.query";
import type { RepoBranchListItem } from "#/lib/github.types";
import { BranchAheadBehind } from "./branch-ahead-behind";

function PullRequestBadge({
	owner,
	repo,
	pullRequest,
}: {
	owner: string;
	repo: string;
	pullRequest: NonNullable<RepoBranchListItem["pullRequest"]>;
}) {
	const { Icon, className } =
		pullRequest.state === "MERGED"
			? { Icon: GitMergeIcon, className: "text-merged" }
			: pullRequest.state === "CLOSED"
				? { Icon: GitPullRequestClosedIcon, className: "text-danger" }
				: pullRequest.isDraft
					? {
							Icon: GitPullRequestDraftIcon,
							className: "text-muted-foreground",
						}
					: { Icon: GitPullRequestIcon, className: "text-success" };

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Link
					to="/$owner/$repo/pull/$pullId"
					params={{ owner, repo, pullId: String(pullRequest.number) }}
					className="flex items-center gap-1 rounded-md border border-border/60 px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground transition-colors hover:bg-surface-1 hover:text-foreground"
				>
					<Icon size={12} strokeWidth={2} className={className} />#
					{pullRequest.number}
				</Link>
			</TooltipTrigger>
			<TooltipContent className="max-w-xs">{pullRequest.title}</TooltipContent>
		</Tooltip>
	);
}

const iconLinkClass =
	"flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground";

export const BranchRow = memo(function BranchRow({
	owner,
	repo,
	scope,
	branch,
	defaultBranch,
}: {
	owner: string;
	repo: string;
	scope: GitHubQueryScope;
	branch: RepoBranchListItem;
	defaultBranch: string;
}) {
	const isDefault = branch.name === defaultBranch;
	const commit = branch.commit;
	const authorLabel = commit?.author?.login ?? commit?.authorName;

	return (
		<div className="flex items-center gap-3 px-4 py-2.5">
			<div className="flex min-w-0 flex-1 flex-col gap-1">
				<div className="flex min-w-0 items-center gap-2">
					<Link
						to="/$owner/$repo/tree/$"
						params={{ owner, repo, _splat: branch.name }}
						className="min-w-0 truncate rounded bg-surface-1 px-1.5 py-0.5 font-mono text-xs font-medium text-foreground hover:underline"
					>
						{branch.name}
					</Link>
					{isDefault ? (
						<span className="shrink-0 rounded-full border border-border/60 px-1.5 text-[10px] text-muted-foreground">
							default
						</span>
					) : null}
				</div>
				{commit ? (
					<div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
						{commit.author ? (
							<img
								src={commit.author.avatarUrl}
								alt=""
								className="size-4 shrink-0 rounded-full"
								loading="lazy"
							/>
						) : null}
						<span className="truncate">
							{authorLabel ? (
								<span className="font-medium text-foreground">
									{authorLabel}
								</span>
							) : null}{" "}
							updated{" "}
							{commit.date ? (
								<time dateTime={commit.date}>
									{formatRelativeTime(commit.date)}
								</time>
							) : (
								"at an unknown time"
							)}
						</span>
					</div>
				) : null}
			</div>

			<div className="hidden shrink-0 sm:block">
				{isDefault ? (
					<span className="block w-24 text-center text-xs text-muted-foreground">
						Default
					</span>
				) : (
					<BranchAheadBehind
						owner={owner}
						repo={repo}
						scope={scope}
						base={defaultBranch}
						head={branch.name}
					/>
				)}
			</div>

			<div className="hidden w-16 shrink-0 justify-end md:flex">
				{branch.pullRequest ? (
					<PullRequestBadge
						owner={owner}
						repo={repo}
						pullRequest={branch.pullRequest}
					/>
				) : null}
			</div>

			<div className="flex shrink-0 items-center gap-0.5">
				<Tooltip>
					<TooltipTrigger asChild>
						<Link
							to="/$owner/$repo/commits/$"
							params={{ owner, repo, _splat: branch.name }}
							aria-label={`Commits on ${branch.name}`}
							className={iconLinkClass}
						>
							<GitCommitIcon size={14} />
						</Link>
					</TooltipTrigger>
					<TooltipContent>Commits</TooltipContent>
				</Tooltip>
				<Tooltip>
					<TooltipTrigger asChild>
						<Link
							to="/$owner/$repo/compare/$"
							params={{
								owner,
								repo,
								_splat: `${defaultBranch}...${branch.name}`,
							}}
							aria-label={`Compare ${branch.name} with ${defaultBranch}`}
							aria-disabled={isDefault}
							tabIndex={isDefault ? -1 : undefined}
							className={cn(
								iconLinkClass,
								isDefault && "pointer-events-none opacity-30",
							)}
						>
							<GitCompareIcon size={14} />
						</Link>
					</TooltipTrigger>
					<TooltipContent>Compare &amp; open pull request</TooltipContent>
				</Tooltip>
			</div>
		</div>
	);
});

export function BranchRowSkeleton() {
	return (
		<div className="flex items-center gap-3 px-4 py-3">
			<div className="flex flex-1 flex-col gap-1.5">
				<Skeleton className="h-4 w-40 rounded" />
				<Skeleton className="h-3 w-56 rounded" />
			</div>
			<Skeleton className="hidden h-4 w-24 rounded sm:block" />
			<Skeleton className="h-6 w-14 rounded-md" />
		</div>
	);
}
