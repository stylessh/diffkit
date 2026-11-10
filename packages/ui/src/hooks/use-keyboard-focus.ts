import { useMemo, useState } from "react";

let tabbed = false;

if (typeof document !== "undefined") {
	document.addEventListener(
		"keydown",
		(event) => {
			if (event.key === "Tab") tabbed = true;
		},
		true,
	);
	document.addEventListener(
		"pointerdown",
		() => {
			tabbed = false;
		},
		true,
	);
}

/**
 * Text fields match `:focus-visible` however they were focused, so a ring
 * meant for keyboard users has to know whether Tab brought the focus in.
 */
export function useKeyboardFocus() {
	const [focused, setFocused] = useState(false);
	const handlers = useMemo(
		() => ({
			onFocus: () => setFocused(tabbed),
			onBlur: () => setFocused(false),
		}),
		[],
	);
	return [focused, handlers] as const;
}
