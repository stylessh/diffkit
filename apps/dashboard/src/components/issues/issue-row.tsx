import { CommentIcon, IssuesIcon } from "@diffkit/icons";
import { cn } from "@diffkit/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { memo } from "react";
import {
	listRowClassName,
	listRowHoverClassName,
	RepoChip,
	RowAvatar,
	RowLabels,
	RowNumber,
	RowStateIcon,
	RowTime,
} from "#/components/shared/list-row";
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
	showRepository = true,
}: {
	issue: IssueSummary;
	/** Hide the repository chip in lists scoped to one repository. */
	showRepository?: boolean;
}) {
	const { color } = getIssueStateProps(issue);
	const href = `/${issue.repository.owner}/${issue.repository.name}/issues/${issue.number}`;

	const time = formatRelativeTime(issue.updatedAt, undefined, {
		compact: true,
	});

	return (
		<Link to={href} className={cn(listRowClassName, listRowHoverClassName)}>
			<RowStateIcon className={color}>
				<IssuesIcon size={14} strokeWidth={2} />
			</RowStateIcon>
			<RowNumber number={issue.number} />
			<div className="flex min-w-0 flex-1 flex-col gap-1 md:flex-row md:items-center md:gap-2">
				<p
					title={issue.title}
					className="text-[13px] font-medium text-foreground md:truncate"
				>
					{issue.title}
				</p>
				{issue.comments > 0 && (
					<span
						className="hidden shrink-0 items-center gap-1 text-xs tabular-nums text-muted-foreground md:flex"
						title={`${issue.comments} comments`}
					>
						<CommentIcon size={12} strokeWidth={2} />
						{issue.comments}
					</span>
				)}
				<p className="flex min-w-0 items-center gap-1 truncate text-xs text-muted-foreground md:hidden">
					<span className="truncate">{issue.repository.fullName}</span>
					<span className="tabular-nums">#{issue.number}</span>
					<span aria-hidden>·</span>
					<span className="tabular-nums">{time}</span>
				</p>
			</div>
			<div className="hidden min-w-0 shrink items-center gap-1 md:flex">
				<RowLabels labels={issue.labels} />
				{showRepository ? (
					<RepoChip fullName={issue.repository.fullName} />
				) : null}
			</div>
			<span className="hidden shrink-0 items-center gap-2 md:flex">
				<RowAvatar actor={issue.author} />
				<RowTime>{time}</RowTime>
			</span>
		</Link>
	);
});
