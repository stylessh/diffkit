import { GitCompareIcon } from "@diffkit/icons";
import { BranchBadge } from "@diffkit/ui/components/detail-layout";
import type { CompareDetail } from "#/lib/github.functions";

/**
 * What's being compared, as a 36px card in the diff's own system: the base
 * and compare refs as branch badges, then how far ahead and behind the
 * compare branch is.
 */
export function CompareHeader({
	base,
	head,
	compare,
}: {
	owner: string;
	repo: string;
	base: string;
	head: string;
	compare: CompareDetail;
}) {
	const { aheadBy, behindBy, status } = compare;

	return (
		<div className="flex min-h-9 flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border-[0.5px] border-card-border bg-surface-0 px-3 py-1.5 text-xs leading-4 font-[450]">
			<GitCompareIcon
				size={14}
				strokeWidth={2}
				className="shrink-0 text-muted-foreground"
			/>
			<span className="flex min-w-0 items-center gap-1.5">
				<span className="text-muted-foreground">base</span>
				<BranchBadge title={base}>{base}</BranchBadge>
			</span>
			<span aria-hidden className="text-icon-faint">
				←
			</span>
			<span className="flex min-w-0 items-center gap-1.5">
				<span className="text-muted-foreground">compare</span>
				<BranchBadge title={head}>{head}</BranchBadge>
			</span>
			<span className="ml-auto flex items-center gap-2 text-muted-foreground tabular-nums">
				{aheadBy > 0 ? (
					<span>
						<span className="font-medium text-text-header">{aheadBy}</span>{" "}
						{aheadBy === 1 ? "commit" : "commits"} ahead
					</span>
				) : null}
				{aheadBy > 0 && behindBy > 0 ? (
					<span aria-hidden className="text-icon-faint">
						·
					</span>
				) : null}
				{behindBy > 0 ? (
					<span>
						<span className="font-medium text-text-header">{behindBy}</span>{" "}
						{behindBy === 1 ? "commit" : "commits"} behind
					</span>
				) : null}
				{status === "identical" ? <span>Branches are identical</span> : null}
			</span>
		</div>
	);
}
