import { cn } from "../lib/utils";
import { EmptyWebhooksIllustrationDark } from "./empty-webhooks-dark";
import { EmptyWebhooksIllustrationLight } from "./empty-webhooks-light";
import type { IllustrationProps } from "./illustration-props";

const LIGHT_VIEWBOX_WIDTH = 233;
const DARK_VIEWBOX_WIDTH = 243;

function lightWidthForDarkWidth(width: IllustrationProps["width"]) {
	if (typeof width !== "number") return width;
	return (width * LIGHT_VIEWBOX_WIDTH) / DARK_VIEWBOX_WIDTH;
}

/** Repository integrations webhooks empty state. */
export function EmptyWebhooksIllustration({
	className,
	width,
	size,
	...props
}: IllustrationProps) {
	const darkWidth = width ?? size;
	const lightWidth = lightWidthForDarkWidth(darkWidth);

	return (
		<>
			<EmptyWebhooksIllustrationLight
				{...props}
				size={size}
				width={lightWidth}
				className={cn("dark:hidden", className)}
			/>
			<EmptyWebhooksIllustrationDark
				{...props}
				size={size}
				width={darkWidth}
				className={cn("hidden dark:block", className)}
			/>
		</>
	);
}
