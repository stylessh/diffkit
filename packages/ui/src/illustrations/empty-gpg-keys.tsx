import { cn } from "../lib/utils";
import { EmptyGpgKeysIllustrationDark } from "./empty-gpg-keys-dark";
import { EmptyGpgKeysIllustrationLight } from "./empty-gpg-keys-light";
import type { IllustrationProps } from "./illustration-props";

const LIGHT_VIEWBOX_WIDTH = 210;
const DARK_VIEWBOX_WIDTH = 210;

function lightWidthForDarkWidth(width: IllustrationProps["width"]) {
	if (typeof width !== "number") return width;
	return (width * LIGHT_VIEWBOX_WIDTH) / DARK_VIEWBOX_WIDTH;
}

/** Settings GPG keys page empty state. */
export function EmptyGpgKeysIllustration({
	className,
	width,
	size,
	...props
}: IllustrationProps) {
	const darkWidth = width ?? size;
	const lightWidth = lightWidthForDarkWidth(darkWidth);

	return (
		<>
			<EmptyGpgKeysIllustrationLight
				{...props}
				size={size}
				width={lightWidth}
				className={cn("dark:hidden", className)}
			/>
			<EmptyGpgKeysIllustrationDark
				{...props}
				size={size}
				width={darkWidth}
				className={cn("hidden dark:block", className)}
			/>
		</>
	);
}
