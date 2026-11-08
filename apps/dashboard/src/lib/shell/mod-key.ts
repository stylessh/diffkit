export function modKeyLabel() {
	return typeof navigator !== "undefined" &&
		/Mac|iPhone|iPad|iPod/i.test(navigator.userAgent)
		? "⌘"
		: "Ctrl";
}
