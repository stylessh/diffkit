import { IssuesIcon } from "@diffkit/icons";
import { cn } from "@diffkit/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { memo } from "react";
import {
	CommentsChip,
	listRowClassName,
	listRowHoverClassName,
	RepoChip,
	RowAvatar,
	RowLabels,
	RowNumber,
	RowStateIcon,
	RowTime,
	rowAccessibleName,
} from "#/components/shared/list-row";
import { SelectableRow } from "#/components/shared/list-selection";
import { HighlightedText } from "#/components/shared/search-highlight";
import { useIsSkeletonSample } from "#/components/shared/skeleton-sample";
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

export function issueSelectionKey(issue: IssueSummary) {
	return `${issue.repository.fullName}#${issue.number}`;
}

export const IssueRow = memo(function IssueRow({
	issue,
	showRepository = true,
}: {
	issue: IssueSummary;
	showRepository?: boolean;
}) {
	const { color } = getIssueStateProps(issue);
	const href = `/${issue.repository.owner}/${issue.repository.name}/issues/${issue.number}`;

	const time = formatRelativeTime(issue.updatedAt, undefined, {
		compact: true,
	});
	const isSample = useIsSkeletonSample();

	return (
		<SelectableRow
			selectionKey={issueSelectionKey(issue)}
			label={`Select #${issue.number} ${issue.title}`}
		>
			<Link
				to={href}
				preload={isSample ? false : undefined}
				aria-label={rowAccessibleName(issue)}
				className={cn(listRowClassName, listRowHoverClassName)}
			>
				<RowStateIcon className={color}>
					<IssuesIcon size={14} strokeWidth={2} />
				</RowStateIcon>
				<RowNumber number={issue.number} />
				<div className="flex min-w-0 flex-1 flex-col gap-1 md:flex-row md:items-center md:gap-2">
					<p
						title={issue.title}
						className="text-[13px] font-medium text-foreground md:truncate"
					>
						<HighlightedText text={issue.title} />
					</p>
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
						<RepoChip
							fullName={issue.repository.fullName}
							ownerAvatarUrl={issue.repository.ownerAvatarUrl}
						/>
					) : null}
					<CommentsChip count={issue.comments} />
				</div>
				<span className="hidden shrink-0 items-center gap-2 md:ml-3 md:flex">
					<RowAvatar actor={issue.author} />
					<RowTime>{time}</RowTime>
				</span>
			</Link>
		</SelectableRow>
	);
});
