export function isEditableKeyboardTarget(target: EventTarget | null) {
	const element =
		typeof Element !== "undefined" && target instanceof Element ? target : null;
	if (!element) return false;
	const tag = element.tagName;
	if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
	if (
		typeof HTMLElement !== "undefined" &&
		element instanceof HTMLElement &&
		element.isContentEditable
	)
		return true;
	return (
		element.closest(
			'[contenteditable]:not([contenteditable="false"]), [role="textbox"]',
		) != null
	);
}

function getDeepActiveElement(target: EventTarget | null) {
	const ownerDocument =
		typeof Node !== "undefined" && target instanceof Node
			? target.ownerDocument
			: typeof document === "undefined"
				? null
				: document;
	let activeElement: Element | null = ownerDocument?.activeElement ?? null;
	while (activeElement?.shadowRoot?.activeElement) {
		activeElement = activeElement.shadowRoot.activeElement;
	}
	return activeElement;
}

/** Shadow-DOM inputs retarget keyboard events to their custom-element host. */
export function isEditableKeyboardEvent(
	event: Pick<KeyboardEvent, "composedPath" | "target">,
) {
	return (
		isEditableKeyboardTarget(event.target) ||
		event.composedPath().some(isEditableKeyboardTarget) ||
		isEditableKeyboardTarget(getDeepActiveElement(event.target))
	);
}
