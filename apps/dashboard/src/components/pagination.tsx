import { ChevronLeftIcon, ChevronRightIcon } from "@diffkit/icons";
import { cn } from "@diffkit/ui/lib/utils";
import { memo } from "react";

export const Pagination = memo(function Pagination({
	page,
	hasNextPage,
	onPageChange,
}: {
	page: number;
	hasNextPage: boolean;
	onPageChange: (page: number) => void;
}) {
	if (page === 1 && !hasNextPage) return null;

	return (
		<nav
			aria-label="Pagination"
			className="flex items-center justify-center gap-3 pt-6"
		>
			<button
				type="button"
				disabled={page === 1}
				onClick={() => onPageChange(page - 1)}
				className={cn(
					"flex items-center gap-1.5 rounded-lg border border-border/50 px-3 py-1.5 text-sm transition-colors",
					page === 1
						? "cursor-not-allowed text-muted-foreground/40"
						: "text-muted-foreground hover:bg-surface-1 hover:text-foreground",
				)}
			>
				<ChevronLeftIcon size={14} />
				Previous
			</button>

			<span className="min-w-[3ch] text-center text-sm tabular-nums text-muted-foreground">
				{page}
			</span>

			<button
				type="button"
				disabled={!hasNextPage}
				onClick={() => onPageChange(page + 1)}
				className={cn(
					"flex items-center gap-1.5 rounded-lg border border-border/50 px-3 py-1.5 text-sm transition-colors",
					!hasNextPage
						? "cursor-not-allowed text-muted-foreground/40"
						: "text-muted-foreground hover:bg-surface-1 hover:text-foreground",
				)}
			>
				Next
				<ChevronRightIcon size={14} />
			</button>
		</nav>
	);
});
