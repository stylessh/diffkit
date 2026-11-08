import { cn } from "../lib/utils";
import { EmptyBotsIllustrationDark } from "./empty-bots-dark";
import { EmptyBotsIllustrationLight } from "./empty-bots-light";
import type { IllustrationProps } from "./illustration-props";

const LIGHT_VIEWBOX_WIDTH = 105;
const DARK_VIEWBOX_WIDTH = 102;
/** Bot body art width inside each viewBox — keeps light/dark the same rendered size. */
const LIGHT_ART_WIDTH = 84.445;
const DARK_ART_WIDTH = 79.102;

function lightWidthForDarkWidth(width: IllustrationProps["width"]) {
	if (typeof width !== "number") return width;
	return (
		(width * DARK_ART_WIDTH * LIGHT_VIEWBOX_WIDTH) /
		(LIGHT_ART_WIDTH * DARK_VIEWBOX_WIDTH)
	);
}

/** Settings bots page empty state. */
export function EmptyBotsIllustration({
	className,
	width,
	size,
	...props
}: IllustrationProps) {
	const darkWidth = width ?? size;
	const lightWidth = lightWidthForDarkWidth(darkWidth);

	return (
		<>
			<EmptyBotsIllustrationLight
				{...props}
				size={size}
				width={lightWidth}
				className={cn("dark:hidden", className)}
			/>
			<EmptyBotsIllustrationDark
				{...props}
				size={size}
				width={darkWidth}
				className={cn("hidden dark:block", className)}
			/>
		</>
	);
}
