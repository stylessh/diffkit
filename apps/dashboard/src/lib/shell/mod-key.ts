export function modKeyLabel() {
	return typeof navigator !== "undefined" &&
		/Mac|iPhone|iPad/.test(navigator.userAgent)
		? "⌘"
		: "Ctrl";
}
