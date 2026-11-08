const COARSE_POINTER_QUERY = "(pointer: coarse)";

export function canAutoFocusInput(): boolean {
	return (
		typeof window === "undefined" ||
		typeof window.matchMedia !== "function" ||
		!window.matchMedia(COARSE_POINTER_QUERY).matches
	);
}
