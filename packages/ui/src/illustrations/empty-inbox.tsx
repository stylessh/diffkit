import { cn } from "../lib/utils";
import { EmptyInboxIllustrationDark } from "./empty-inbox-dark";
import { EmptyInboxIllustrationLight } from "./empty-inbox-light";
import type { IllustrationProps } from "./illustration-props";

/** Inbox empty-state art — separate light/dark SVGs toggled via Tailwind `dark:` classes. */
export function EmptyInboxIllustration({
	className,
	width,
	size,
	...props
}: IllustrationProps) {
	const resolvedWidth = width ?? size;

	return (
		<>
			<EmptyInboxIllustrationLight
				{...props}
				size={size}
				width={resolvedWidth}
				className={cn("dark:hidden", className)}
			/>
			<EmptyInboxIllustrationDark
				{...props}
				size={size}
				width={resolvedWidth}
				className={cn("hidden dark:block", className)}
			/>
		</>
	);
}
