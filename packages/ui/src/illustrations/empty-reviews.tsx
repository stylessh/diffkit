import { cn } from "../lib/utils";
import { EmptyReviewsIllustrationDark } from "./empty-reviews-dark";
import { EmptyReviewsIllustrationLight } from "./empty-reviews-light";
import type { IllustrationProps } from "./illustration-props";

const LIGHT_VIEWBOX_WIDTH = 197;
const DARK_VIEWBOX_WIDTH = 201;
/** Card art width inside each viewBox — keeps light/dark the same rendered size. */
const LIGHT_ART_WIDTH = 194;
const DARK_ART_WIDTH = 194;

function lightWidthForDarkWidth(width: IllustrationProps["width"]) {
	if (typeof width !== "number") return width;
	return (
		(width * DARK_ART_WIDTH * LIGHT_VIEWBOX_WIDTH) /
		(LIGHT_ART_WIDTH * DARK_VIEWBOX_WIDTH)
	);
}

/** Reviews queue empty state. */
export function EmptyReviewsIllustration({
	className,
	width,
	size,
	...props
}: IllustrationProps) {
	const darkWidth = width ?? size;
	const lightWidth = lightWidthForDarkWidth(darkWidth);

	return (
		<>
			<EmptyReviewsIllustrationLight
				{...props}
				size={size}
				width={lightWidth}
				className={cn("dark:hidden", className)}
			/>
			<EmptyReviewsIllustrationDark
				{...props}
				size={size}
				width={darkWidth}
				className={cn("hidden dark:block", className)}
			/>
		</>
	);
}
