import {
	GitBranchIcon,
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
import { HairlineBadge } from "../repo-ui";
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
					className="shrink-0 tabular-nums transition-colors hover:text-foreground"
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
}: {
	owner: string;
	repo: string;
	scope: GitHubQueryScope;
	branch: RepoBranchListItem;
	defaultBranch: string;
}) {
	const isDefault = branch.name === defaultBranch;
	const commit = branch.commit;
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
				{time ? (
					<p className="text-xs tabular-nums text-muted-foreground md:hidden">
						{time}
					</p>
				) : null}
			</div>
			<div className="relative z-[1] hidden min-w-0 shrink items-center gap-1 md:flex">
				{isDefault ? null : (
					<BranchAheadBehind
						owner={owner}
						repo={repo}
						scope={scope}
						base={defaultBranch}
						head={branch.name}
					/>
				)}
				<span className="flex min-w-16 shrink-0">
					{branch.pullRequest ? (
						<PullRequestBadge
							owner={owner}
							repo={repo}
							pullRequest={branch.pullRequest}
						/>
					) : null}
				</span>
			</div>
			<span className="hidden shrink-0 items-center gap-2 md:ml-3 md:flex">
				<RowAvatar actor={commit?.author ?? null} />
				<RowTime dateTime={commit?.date ?? undefined}>{time ?? "—"}</RowTime>
			</span>
		</div>
	);
});
