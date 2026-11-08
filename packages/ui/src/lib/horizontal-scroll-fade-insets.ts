/** Must match `HorizontalScrollFade` mask gradient width. */
export const HORIZONTAL_SCROLL_FADE_WIDTH = "1.5rem";

export function resolveHorizontalScrollFadeWidthPx(
	context: HTMLElement,
): number {
	const probe = document.createElement("div");
	probe.style.width = HORIZONTAL_SCROLL_FADE_WIDTH;
	probe.style.position = "absolute";
	probe.style.visibility = "hidden";
	probe.style.pointerEvents = "none";
	context.appendChild(probe);
	const width = probe.getBoundingClientRect().width;
	context.removeChild(probe);
	return width;
}

/** Insets that mirror when each edge fade is shown on the scroll container. */
export function horizontalScrollFadeInsets(container: HTMLElement): {
	left: number;
	right: number;
} {
	const fadePx = resolveHorizontalScrollFadeWidthPx(container);
	const canScrollLeft = container.scrollLeft > 0;
	const canScrollRight =
		container.scrollLeft + container.clientWidth < container.scrollWidth - 1;
	return {
		left: canScrollLeft ? fadePx : 0,
		right: canScrollRight ? fadePx : 0,
	};
}

/**
 * Scrolls `child` so it sits in the unobscured band inside edge fades (not raw
 * container bounds). Uses pixel scroll adjustment instead of scrollIntoView.
 */
export function scrollHorizontalChildIntoView(
	container: HTMLElement,
	child: HTMLElement,
	options?: { dispatchScroll?: boolean },
): void {
	const { left: fadeLeft, right: fadeRight } =
		horizontalScrollFadeInsets(container);

	const { left: cLeft, right: cRight } = container.getBoundingClientRect();
	const safeLeft = cLeft + fadeLeft;
	const safeRight = cRight - fadeRight;

	const { left: tLeft, right: tRight } = child.getBoundingClientRect();

	if (tLeft >= safeLeft && tRight <= safeRight) {
		return;
	}

	let delta = 0;
	if (tLeft < safeLeft) {
		delta = tLeft - safeLeft;
	} else if (tRight > safeRight) {
		delta = tRight - safeRight;
	}

	if (delta === 0) return;

	container.scrollLeft += delta;
	if (options?.dispatchScroll !== false) {
		container.dispatchEvent(new Event("scroll"));
	}
}
