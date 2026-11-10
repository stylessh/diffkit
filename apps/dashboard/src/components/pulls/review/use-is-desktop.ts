import { useSyncExternalStore } from "react";

const MD_QUERY = "(min-width: 768px)";

const subscribe = (onChange: () => void) => {
	const media = window.matchMedia(MD_QUERY);
	media.addEventListener("change", onChange);
	return () => media.removeEventListener("change", onChange);
};

export const isDesktopViewport = () => window.matchMedia(MD_QUERY).matches;

export function useIsDesktop() {
	return useSyncExternalStore(subscribe, isDesktopViewport, () => true);
}
