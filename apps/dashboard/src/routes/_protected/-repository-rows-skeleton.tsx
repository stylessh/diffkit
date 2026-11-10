import { cn } from "@diffkit/ui/lib/utils";
import { SkeletonBox } from "skullet/react";

const NAME_WIDTHS = [148, 96, 182, 120, 164, 88, 136, 110];

/**
 * Stands in for a list of `RepositoryRow`s. The real row cannot be drawn from
 * sample data: its sparkline fetches as soon as it scrolls into view.
 */
export function RepositoryRowsSkeleton({
	rowClassName = "h-11",
}: {
	rowClassName?: string;
}) {
	return (
		<div aria-hidden className="flex flex-col">
			{NAME_WIDTHS.map((width) => (
				<div
					key={width}
					className={cn("flex items-center gap-3 px-3", rowClassName)}
				>
					<SkeletonBox width={16} height={16} radius={5} />
					<SkeletonBox width={width} height={12} radius={4} />
					<span className="flex-1" />
					<SkeletonBox width={56} height={20} radius={10} />
					<SkeletonBox width={32} height={12} radius={4} />
				</div>
			))}
		</div>
	);
}
