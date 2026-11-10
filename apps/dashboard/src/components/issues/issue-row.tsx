import { IssuesIcon } from "@diffkit/icons";
import { cn } from "@diffkit/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { memo } from "react";
import {
	itemSelectionKey,
	listRowClassName,
	listRowHoverClassName,
	RowDetails,
	RowNumber,
	RowStateIcon,
	RowSummary,
	rowAccessibleName,
} from "#/components/shared/list-row";
import { SelectableRow } from "#/components/shared/list-selection";
import { useIsSkeletonSample } from "#/components/shared/skeleton-sample";
import { formatRelativeTime } from "#/lib/format-relative-time";
import type { IssueSummary } from "#/lib/github.types";

export function issueStateColor(issue: IssueSummary) {
	if (issue.state !== "closed") return "text-state-open";
	return issue.stateReason === "not_planned"
		? "text-state-draft"
		: "text-state-merged";
}

export const IssueRow = memo(function IssueRow({
	issue,
	showRepository = true,
}: {
	issue: IssueSummary;
	showRepository?: boolean;
}) {
	const href = `/${issue.repository.owner}/${issue.repository.name}/issues/${issue.number}`;
	const time = formatRelativeTime(issue.updatedAt, undefined, {
		compact: true,
	});
	const isSample = useIsSkeletonSample();

	return (
		<SelectableRow
			selectionKey={itemSelectionKey(issue)}
			label={`Select #${issue.number} ${issue.title}`}
		>
			<Link
				to={href}
				preload={isSample ? false : undefined}
				aria-label={rowAccessibleName(issue)}
				className={cn(listRowClassName, listRowHoverClassName)}
			>
				<RowStateIcon className={issueStateColor(issue)}>
					<IssuesIcon size={14} strokeWidth={2} />
				</RowStateIcon>
				<RowNumber number={issue.number} />
				<RowSummary item={issue} time={time} />
				<RowDetails item={issue} showRepository={showRepository} time={time} />
			</Link>
		</SelectableRow>
	);
});
