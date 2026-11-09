import {
	GitBranchIcon,
	GitCommitIcon,
	GitCompareIcon,
	GitMergeIcon,
	GitPullRequestClosedIcon,
	GitPullRequestDraftIcon,
	GitPullRequestIcon,
} from "@diffkit/icons";
import { Chip } from "@diffkit/ui/components/chip";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@diffkit/ui/components/tooltip";
import { cn } from "@diffkit/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { memo } from "react";
import {
	listRowClassName,
	RowAvatar,
	RowStateIcon,
	RowTime,
} from "#/components/shared/list-row";
import { formatRelativeTime } from "#/lib/format-relative-time";
import type { GitHubQueryScope } from "#/lib/github.query";
import type { RepoBranchListItem } from "#/lib/github.types";
import { HairlineBadge, iconButtonClassName } from "../repo-ui";
import { BranchAheadBehind } from "./branch-ahead-behind";
import { BranchCreatePullRequest } from "./branch-create-pull-request";

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
			? { Icon: GitMergeIcon, className: "text-state-merged" }
			: pullRequest.state === "CLOSED"
				? { Icon: GitPullRequestClosedIcon, className: "text-state-closed" }
				: pullRequest.isDraft
					? {
							Icon: GitPullRequestDraftIcon,
							className: "text-state-draft",
						}
					: { Icon: GitPullRequestIcon, className: "text-state-open" };

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Chip
					asChild
					className="tabular-nums transition-colors hover:text-foreground"
				>
					<Link
						to="/$owner/$repo/pull/$pullId"
						params={{ owner, repo, pullId: String(pullRequest.number) }}
						data-action
					>
						<Icon size={12} strokeWidth={2} className={className} />#
						{pullRequest.number}
					</Link>
				</Chip>
			</TooltipTrigger>
			<TooltipContent className="max-w-xs">{pullRequest.title}</TooltipContent>
		</Tooltip>
	);
}

export const BranchRow = memo(function BranchRow({
	owner,
	repo,
	scope,
	branch,
	defaultBranch,
	canCreatePullRequest,
}: {
	owner: string;
	repo: string;
	scope: GitHubQueryScope;
	branch: RepoBranchListItem;
	defaultBranch: string;
	canCreatePullRequest: boolean;
}) {
	const isDefault = branch.name === defaultBranch;
	const offersCreatePullRequest =
		canCreatePullRequest && !isDefault && branch.pullRequest?.state !== "OPEN";
	const commit = branch.commit;
	const authorLabel = commit?.author?.login ?? commit?.authorName;

	const time = commit?.date
		? formatRelativeTime(commit.date, undefined, { compact: true })
		: null;

	return (
		<div
			className={cn(
				listRowClassName,
				"hover:[&:not(:has([data-action]:hover))]:before:bg-row-hover",
			)}
		>
			<RowStateIcon className="text-muted-foreground">
				<GitBranchIcon size={14} strokeWidth={2} />
			</RowStateIcon>
			<div className="flex min-w-0 flex-1 flex-col gap-1 md:flex-row md:items-center md:gap-2">
				<span className="flex min-w-0 items-center gap-2">
					<Link
						to="/$owner/$repo/tree/$"
						params={{ owner, repo, _splat: branch.name }}
						title={branch.name}
						className="min-w-0 truncate rounded-sm font-mono text-[13px] font-medium text-foreground after:absolute after:inset-0 after:content-['']"
					>
						{branch.name}
					</Link>
					{isDefault ? <HairlineBadge>Default</HairlineBadge> : null}
				</span>
				{commit ? (
					<p className="flex min-w-0 items-center gap-1.5 truncate text-xs font-[450] text-muted-foreground md:ml-auto md:max-w-[40%] md:shrink-0">
						<span className="truncate">
							{authorLabel ? (
								<span className="text-text-header">{authorLabel}</span>
							) : null}{" "}
							updated
							<span className="md:hidden"> {time ?? "at an unknown time"}</span>
						</span>
					</p>
				) : null}
			</div>

			<div className="relative z-[1] hidden shrink-0 sm:block">
				{isDefault ? (
					<span className="block w-24" />
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

			<div className="relative z-[1] hidden min-w-16 shrink-0 items-center justify-end gap-1.5 md:flex">
				{branch.pullRequest ? (
					<PullRequestBadge
						owner={owner}
						repo={repo}
						pullRequest={branch.pullRequest}
					/>
				) : null}
				{offersCreatePullRequest ? (
					<BranchCreatePullRequest
						owner={owner}
						repo={repo}
						scope={scope}
						base={defaultBranch}
						head={branch.name}
					/>
				) : null}
			</div>

			<div className="relative z-[1] flex shrink-0 items-center">
				<Tooltip>
					<TooltipTrigger asChild>
						<Link
							to="/$owner/$repo/commits/$"
							params={{ owner, repo, _splat: branch.name }}
							data-action
							aria-label={`Commits on ${branch.name}`}
							className={iconButtonClassName}
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
							data-action
							aria-label={`Compare ${branch.name} with ${defaultBranch}`}
							aria-disabled={isDefault}
							tabIndex={isDefault ? -1 : undefined}
							className={iconButtonClassName}
						>
							<GitCompareIcon size={14} />
						</Link>
					</TooltipTrigger>
					<TooltipContent>Compare</TooltipContent>
				</Tooltip>
			</div>

			<span className="hidden shrink-0 items-center gap-2 md:flex">
				<RowAvatar actor={commit?.author ?? null} />
				{commit?.date ? (
					<time dateTime={commit.date}>
						<RowTime>{time}</RowTime>
					</time>
				) : (
					<RowTime>—</RowTime>
				)}
			</span>
		</div>
	);
});
