import { CommentIcon, IssuesIcon, RepoIcon } from "@diffkit/icons";
import { Chip } from "@diffkit/ui/components/chip";
import { cn } from "@diffkit/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { memo } from "react";
import { formatRelativeTime } from "#/lib/format-relative-time";
import type { IssueSummary } from "#/lib/github.types";

function getIssueStateProps(issue: IssueSummary) {
	if (issue.state === "closed") {
		if (issue.stateReason === "not_planned") {
			return { color: "text-state-draft" };
		}
		return { color: "text-state-merged" };
	}
	return { color: "text-state-open" };
}

export const IssueRow = memo(function IssueRow({
	issue,
}: {
	issue: IssueSummary;
}) {
	const { color } = getIssueStateProps(issue);
	const href = `/${issue.repository.owner}/${issue.repository.name}/issues/${issue.number}`;

	return (
		<Link
			to={href}
			className="group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-row-hover md:h-11 md:items-center md:py-0"
		>
			<div className={cn("mt-0.5 flex shrink-0 md:mt-0", color)}>
				<IssuesIcon size={14} strokeWidth={2} />
			</div>
			<div className="flex min-w-0 flex-1 flex-col gap-1">
				<p
					title={issue.title}
					className="text-[13px] font-medium text-foreground md:truncate"
				>
					{issue.title}
				</p>
				<p className="flex min-w-0 items-center gap-1 truncate text-xs text-muted-foreground md:hidden">
					<span className="truncate">{issue.repository.fullName}</span>
					<span className="tabular-nums">#{issue.number}</span>
					<span aria-hidden>·</span>
					<span className="tabular-nums">
						{formatRelativeTime(issue.updatedAt)}
					</span>
				</p>
			</div>
			<div className="hidden min-w-0 shrink items-center gap-2 md:flex">
				{issue.comments > 0 && (
					<span
						className="flex shrink-0 items-center gap-1 px-1 text-xs tabular-nums text-muted-foreground"
						title={`${issue.comments} comments`}
					>
						<CommentIcon size={12} strokeWidth={2} />
						{issue.comments}
					</span>
				)}
				<Chip
					className="max-w-56"
					title={`${issue.repository.fullName} #${issue.number}`}
				>
					<RepoIcon size={12} strokeWidth={2} />
					<span className="truncate">{issue.repository.fullName}</span>
					<span className="tabular-nums">#{issue.number}</span>
				</Chip>
				{issue.author && (
					<img
						src={issue.author.avatarUrl}
						alt={issue.author.login}
						title={issue.author.login}
						className="size-4 shrink-0 rounded-full ring-[0.5px] ring-chip-border"
					/>
				)}
				<span className="w-14 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
					{formatRelativeTime(issue.updatedAt)}
				</span>
			</div>
		</Link>
	);
});
