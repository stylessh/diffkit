import { cn } from "@diffkit/ui/lib/utils";
import { Skeleton, SkeletonBox } from "skullet/react";

const SAMPLE_ROW_LABELS = [
	"documentation",
	"needs triage",
	"good first issue",
	"enhancement",
	"help wanted",
	"question",
];

const LEADING_RADIUS = { avatar: "50%", icon: 4 } as const;

/**
 * The loading rows of a picker list (popover, menu or palette). `rowClassName`
 * is the picker's own row class, so the rows that arrive land where these were.
 */
export function PickerSkeletonRows({
	label,
	rows = 4,
	leading = "icon",
	leadingSize = 16,
	rowClassName = "flex h-8 items-center gap-2 px-2 text-[13px]",
	className,
}: {
	label: string;
	rows?: number;
	leading?: "avatar" | "icon" | "none";
	leadingSize?: number;
	rowClassName?: string;
	className?: string;
}) {
	return (
		<Skeleton loading label={label} className={className}>
			{SAMPLE_ROW_LABELS.slice(0, rows).map((text) => (
				<div key={text} className={cn(rowClassName, "pointer-events-none")}>
					{leading === "none" ? null : (
						<SkeletonBox
							width={leadingSize}
							height={leadingSize}
							radius={LEADING_RADIUS[leading]}
							className="shrink-0"
						/>
					)}
					<span className="truncate">{text}</span>
				</div>
			))}
		</Skeleton>
	);
}

export function MentionSkeletonRows() {
	return (
		<PickerSkeletonRows
			label="Loading people"
			leading="avatar"
			rowClassName="flex h-8 items-center gap-2 pr-2.5 pl-[7.75px] text-[13px]"
		/>
	);
}
