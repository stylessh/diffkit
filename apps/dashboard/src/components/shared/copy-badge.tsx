import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@diffkit/ui/components/tooltip";
import { cn } from "@diffkit/ui/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";

export function CopyBadge({
	value,
	canTruncate,
	className,
}: {
	value: string;
	canTruncate?: boolean;
	className?: string;
}) {
	const [copied, setCopied] = useState(false);
	const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

	useEffect(() => {
		return () => clearTimeout(timeoutRef.current);
	}, []);

	const handleClick = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(value);
			setCopied(true);
			clearTimeout(timeoutRef.current);
			timeoutRef.current = setTimeout(() => setCopied(false), 1500);
		} catch {
			setCopied(false);
		}
	}, [value]);

	return (
		<Tooltip open={copied}>
			<TooltipTrigger asChild>
				<button
					type="button"
					onClick={handleClick}
					className={cn(
						"shrink-0 cursor-pointer rounded bg-surface-1 px-1.5 py-0.5 font-mono text-xs font-[550] transition-colors hover:bg-surface-2",
						canTruncate && "min-w-0 shrink truncate",
						className,
					)}
				>
					{value}
				</button>
			</TooltipTrigger>
			<TooltipContent>Copied!</TooltipContent>
		</Tooltip>
	);
}
