import { cn } from "../lib/utils";
import { EmptyIssuesIllustrationDark } from "./empty-issues-dark";
import { EmptyIssuesIllustrationLight } from "./empty-issues-light";
import type { IllustrationProps } from "./illustration-props";

/** Issues queue empty state. */
export function EmptyIssuesIllustration({
	className,
	width,
	size,
	...props
}: IllustrationProps) {
	const resolvedWidth = width ?? size;

	return (
		<>
			<EmptyIssuesIllustrationLight
				{...props}
				size={size}
				width={resolvedWidth}
				className={cn("dark:hidden", className)}
			/>
			<EmptyIssuesIllustrationDark
				{...props}
				size={size}
				width={resolvedWidth}
				className={cn("hidden dark:block", className)}
			/>
		</>
	);
}
