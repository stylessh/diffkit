import { cn } from "@diffkit/ui/lib/utils";
import { formatShare } from "../map-format";

export function ShareBar({
	share,
	className,
}: {
	share: number;
	className?: string;
}) {
	return (
		<span
			className={cn(
				"flex shrink-0 items-center gap-2 font-[450] text-muted-foreground text-xs tabular-nums",
				className,
			)}
		>
			<span
				aria-hidden
				className="h-1 w-12 overflow-hidden rounded-full bg-foreground/10"
			>
				<span
					style={{ width: `${Math.max(4, share * 100)}%` }}
					className="block h-full rounded-full bg-foreground/60"
				/>
			</span>
			<span className="w-9 text-right">{formatShare(share)}</span>
		</span>
	);
}
