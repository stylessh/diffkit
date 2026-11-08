import { cn } from "../lib/utils";
import { EmptyPullRequestsIllustrationDark } from "./empty-pull-requests-dark";
import { EmptyPullRequestsIllustrationLight } from "./empty-pull-requests-light";
import type { IllustrationProps } from "./illustration-props";

const LIGHT_VIEWBOX_WIDTH = 166;
const DARK_VIEWBOX_WIDTH = 216;
/** Icon art width inside each viewBox — keeps light/dark the same rendered size. */
const LIGHT_ART_WIDTH = 165.7;
const DARK_ART_WIDTH = 210;

function lightWidthForDarkWidth(width: IllustrationProps["width"]) {
	if (typeof width !== "number") return width;
	return (
		(width * DARK_ART_WIDTH * LIGHT_VIEWBOX_WIDTH) /
		(LIGHT_ART_WIDTH * DARK_VIEWBOX_WIDTH)
	);
}

/** Overview empty state when there are no recent pull requests to show. */
export function EmptyPullRequestsIllustration({
	className,
	width,
	size,
	...props
}: IllustrationProps) {
	const darkWidth = width ?? size;
	const lightWidth = lightWidthForDarkWidth(darkWidth);

	return (
		<>
			<EmptyPullRequestsIllustrationLight
				{...props}
				size={size}
				width={lightWidth}
				className={cn("dark:hidden", className)}
			/>
			<EmptyPullRequestsIllustrationDark
				{...props}
				size={size}
				width={darkWidth}
				className={cn("hidden dark:block", className)}
			/>
		</>
	);
}
