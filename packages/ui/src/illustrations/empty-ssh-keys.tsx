import { cn } from "../lib/utils";
import { EmptySshKeysIllustrationDark } from "./empty-ssh-keys-dark";
import { EmptySshKeysIllustrationLight } from "./empty-ssh-keys-light";
import type { IllustrationProps } from "./illustration-props";

const LIGHT_VIEWBOX_WIDTH = 95;
const DARK_VIEWBOX_WIDTH = 98;
/** Hex art width inside each viewBox — keeps light/dark the same rendered size. */
const LIGHT_ART_WIDTH = 95;
const DARK_ART_WIDTH = 97.481;

function lightWidthForDarkWidth(width: IllustrationProps["width"]) {
	if (typeof width !== "number") return width;
	return (
		(width * DARK_ART_WIDTH * LIGHT_VIEWBOX_WIDTH) /
		(LIGHT_ART_WIDTH * DARK_VIEWBOX_WIDTH)
	);
}

/** Settings SSH keys page empty state. */
export function EmptySshKeysIllustration({
	className,
	width,
	size,
	...props
}: IllustrationProps) {
	const darkWidth = width ?? size;
	const lightWidth = lightWidthForDarkWidth(darkWidth);

	return (
		<>
			<EmptySshKeysIllustrationLight
				{...props}
				size={size}
				width={lightWidth}
				className={cn("dark:hidden", className)}
			/>
			<EmptySshKeysIllustrationDark
				{...props}
				size={size}
				width={darkWidth}
				className={cn("hidden dark:block", className)}
			/>
		</>
	);
}
