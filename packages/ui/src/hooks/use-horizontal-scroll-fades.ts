import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Tracks horizontal overflow for edge fade gradients on scroll containers.
 * Pass `scrollToEndDep` to jump to the end when it changes (e.g. tab count).
 */
export function useHorizontalScrollFades(scrollToEndDep?: number) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const prevScrollToEndDepRef = useRef(scrollToEndDep);
	const [canScrollLeft, setCanScrollLeft] = useState(false);
	const [canScrollRight, setCanScrollRight] = useState(false);

	const updateScrollState = useCallback(() => {
		const el = scrollRef.current;
		if (!el) return;
		setCanScrollLeft(el.scrollLeft > 0);
		setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
	}, []);

	useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;

		if (
			scrollToEndDep !== undefined &&
			scrollToEndDep > (prevScrollToEndDepRef.current ?? -1)
		) {
			el.scrollLeft = el.scrollWidth;
		}
		if (scrollToEndDep !== undefined) {
			prevScrollToEndDepRef.current = scrollToEndDep;
		}
		updateScrollState();

		const ro = new ResizeObserver(updateScrollState);
		ro.observe(el);
		return () => ro.disconnect();
	}, [scrollToEndDep, updateScrollState]);

	return {
		scrollRef,
		canScrollLeft,
		canScrollRight,
		updateScrollState,
	};
}

/** Map vertical wheel to horizontal scroll; must be non-passive to allow preventDefault. */
export function bindHorizontalWheelScroll(
	el: HTMLDivElement | null,
	updateScrollState: () => void,
): () => void {
	if (!el) return () => {};

	const onWheel = (event: WheelEvent) => {
		if (event.ctrlKey || event.metaKey) return;
		if (el.scrollWidth <= el.clientWidth) return;
		if (event.deltaY === 0) return;
		const previousScrollLeft = el.scrollLeft;
		const scale =
			event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? el.clientWidth : 1;
		el.scrollLeft += event.deltaY * scale;
		if (el.scrollLeft === previousScrollLeft) return;
		event.preventDefault();
		updateScrollState();
	};

	el.addEventListener("wheel", onWheel, { passive: false });
	return () => el.removeEventListener("wheel", onWheel);
}
