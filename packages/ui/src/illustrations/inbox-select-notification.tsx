import { cn } from "../lib/utils";
import type { IllustrationProps } from "./illustration-props";
import { InboxSelectNotificationIllustrationDark } from "./inbox-select-notification-dark";
import { InboxSelectNotificationIllustrationLight } from "./inbox-select-notification-light";

const LIGHT_VIEWBOX_WIDTH = 267;
const DARK_VIEWBOX_WIDTH = 267;
/** Envelope art width inside each viewBox — keeps light/dark the same rendered size. */
const LIGHT_ART_WIDTH = 232;
const DARK_ART_WIDTH = 232;

function lightWidthForDarkWidth(width: IllustrationProps["width"]) {
	if (typeof width !== "number") return width;
	return (
		(width * DARK_ART_WIDTH * LIGHT_VIEWBOX_WIDTH) /
		(LIGHT_ART_WIDTH * DARK_VIEWBOX_WIDTH)
	);
}

/** Inbox preview when notifications exist but none is selected. */
export function InboxSelectNotificationIllustration({
	className,
	width,
	size,
	...props
}: IllustrationProps) {
	const darkWidth = width ?? size;
	const lightWidth = lightWidthForDarkWidth(darkWidth);

	return (
		<>
			<InboxSelectNotificationIllustrationLight
				{...props}
				size={size}
				width={lightWidth}
				className={cn("dark:hidden", className)}
			/>
			<InboxSelectNotificationIllustrationDark
				{...props}
				size={size}
				width={darkWidth}
				className={cn("hidden dark:block", className)}
			/>
		</>
	);
}
