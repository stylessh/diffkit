const MIRROR_PROPS = [
	"direction",
	"boxSizing",
	"width",
	"height",
	"overflowX",
	"overflowY",
	"borderTopWidth",
	"borderRightWidth",
	"borderBottomWidth",
	"borderLeftWidth",
	"borderStyle",
	"paddingTop",
	"paddingRight",
	"paddingBottom",
	"paddingLeft",
	"fontStyle",
	"fontVariant",
	"fontWeight",
	"fontStretch",
	"fontSize",
	"fontSizeAdjust",
	"lineHeight",
	"fontFamily",
	"textAlign",
	"textTransform",
	"textIndent",
	"textDecoration",
	"letterSpacing",
	"wordSpacing",
	"tabSize",
	"MozTabSize",
	"whiteSpace",
	"wordWrap",
	"wordBreak",
] as const;

/**
 * Measures the pixel coordinates of a caret position within a textarea
 * using a hidden mirror div that replicates the textarea's styling.
 *
 * Returns coordinates relative to the textarea's top-left corner,
 * adjusted for scroll offset.
 */
export function getCaretCoordinates(
	textarea: HTMLTextAreaElement,
	position: number,
): { top: number; left: number } {
	const mirror = document.createElement("div");
	mirror.id = "caret-mirror";

	const style = mirror.style;
	const computed = getComputedStyle(textarea);

	style.whiteSpace = "pre-wrap";
	style.wordWrap = "break-word";
	style.position = "absolute";
	style.visibility = "hidden";
	style.overflow = "hidden";

	for (const prop of MIRROR_PROPS) {
		style.setProperty(prop, computed.getPropertyValue(prop));
	}

	mirror.textContent = textarea.value.substring(0, position);

	const marker = document.createElement("span");
	// Use a zero-width space so the span has dimensions
	marker.textContent = "\u200b";
	mirror.appendChild(marker);

	document.body.appendChild(mirror);

	const top = marker.offsetTop - textarea.scrollTop;
	const left = marker.offsetLeft - textarea.scrollLeft;

	document.body.removeChild(mirror);

	return { top, left };
}
