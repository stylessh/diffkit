import { useSyncExternalStore } from "react";

/** iPhone/iPad (including iPadOS that reports as MacIntel). */
export function isAppleTouchDevice(): boolean {
	if (typeof navigator === "undefined") return false;
	return (
		/iPhone|iPad|iPod/i.test(navigator.userAgent) ||
		(navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
	);
}

const subscribe = () => () => {};

export function useAppleTouchDevice(): boolean {
	return useSyncExternalStore(subscribe, isAppleTouchDevice, () => false);
}
