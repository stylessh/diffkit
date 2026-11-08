import { cn } from "../lib/utils";
import { EmptyCliKeysIllustrationDark } from "./empty-cli-keys-dark";
import { EmptyCliKeysIllustrationLight } from "./empty-cli-keys-light";
import type { IllustrationProps } from "./illustration-props";

const LIGHT_VIEWBOX_WIDTH = 219;
const DARK_VIEWBOX_WIDTH = 98;
/** Card art width inside each viewBox — keeps light/dark the same rendered size. */
const LIGHT_ART_WIDTH = 216;
const DARK_ART_WIDTH = 91.356;

function lightWidthForDarkWidth(width: IllustrationProps["width"]) {
	if (typeof width !== "number") return width;
	return (
		(width * DARK_ART_WIDTH * LIGHT_VIEWBOX_WIDTH) /
		(LIGHT_ART_WIDTH * DARK_VIEWBOX_WIDTH)
	);
}

/** Settings CLI keys page empty state. */
export function EmptyCliKeysIllustration({
	className,
	width,
	size,
	...props
}: IllustrationProps) {
	const darkWidth = width ?? size;
	const lightWidth = lightWidthForDarkWidth(darkWidth);

	return (
		<>
			<EmptyCliKeysIllustrationLight
				{...props}
				size={size}
				width={lightWidth}
				className={cn("dark:hidden", className)}
			/>
			<EmptyCliKeysIllustrationDark
				{...props}
				size={size}
				width={darkWidth}
				className={cn("hidden dark:block", className)}
			/>
		</>
	);
}
