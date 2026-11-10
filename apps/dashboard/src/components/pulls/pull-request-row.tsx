import { cn } from "@diffkit/ui/lib/utils";
import { Link, useRouter } from "@tanstack/react-router";
import { memo } from "react";
import {
	itemSelectionKey,
	listRowClassName,
	listRowHoverClassName,
	RowDetails,
	RowDiffStat,
	RowNumber,
	RowStateIcon,
	RowSummary,
	rowAccessibleName,
} from "#/components/shared/list-row";
import { SelectableRow } from "#/components/shared/list-selection";
import { useIsSkeletonSample } from "#/components/shared/skeleton-sample";
import { formatRelativeTime } from "#/lib/format-relative-time";
import type { PullSummary } from "#/lib/github.types";
import { getPrStateConfig } from "#/lib/pr-state";
import { preloadRouteOnce } from "#/lib/route-preload";

export const PullRequestRow = memo(function PullRequestRow({
	pr,
	showRepository = true,
}: {
	pr: PullSummary;
	showRepository?: boolean;
}) {
	const { icon: Icon, color } = getPrStateConfig(pr);
	const href = `/${pr.repository.owner}/${pr.repository.name}/pull/${pr.number}`;
	const router = useRouter();
	const isSample = useIsSkeletonSample();
	const preloadDetail = () => {
		if (!isSample) void preloadRouteOnce(router, href);
	};
	const time = formatRelativeTime(pr.updatedAt, undefined, { compact: true });

	return (
		<SelectableRow
			selectionKey={itemSelectionKey(pr)}
			label={`Select #${pr.number} ${pr.title}`}
		>
			<Link
				to={href}
				preload={false}
				onMouseEnter={preloadDetail}
				onFocus={preloadDetail}
				onTouchStart={preloadDetail}
				aria-label={rowAccessibleName(pr)}
				className={cn(listRowClassName, listRowHoverClassName)}
			>
				<RowStateIcon className={color}>
					<Icon size={14} strokeWidth={2} />
				</RowStateIcon>
				<RowNumber number={pr.number} />
				<RowSummary item={pr} time={time}>
					<RowDiffStat additions={pr.additions} deletions={pr.deletions} />
				</RowSummary>
				<RowDetails item={pr} showRepository={showRepository} time={time} />
			</Link>
		</SelectableRow>
	);
});
