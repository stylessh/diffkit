import {
	type CSSProperties,
	type PointerEvent,
	type RefObject,
	useCallback,
	useLayoutEffect,
	useState,
} from "react";

const RESIZE_HANDLE_PX = 18;
/** Avoid nudging scroll when we're already at (or past) the target within this many px. */
const SCROLL_SLACK_PX = 4;

function supportsFieldSizingContent(): boolean {
	return (
		typeof CSS !== "undefined" &&
		typeof CSS.supports === "function" &&
		CSS.supports("field-sizing", "content")
	);
}

export type TextareaContentFieldSizingOptions = {
	minHeightPx: number;
	maxHeightPx: number;
};

/**
 * `field-sizing: content` grows the textarea with text up to max-height, then scrolls.
 * If the user drags the native resize handle, we lock to fixed sizing at that height.
 * Falls back to scrollHeight syncing when `field-sizing: content` is not supported.
 */
export function useTextareaContentFieldSizing(
	value: string,
	textareaRef: RefObject<HTMLTextAreaElement | null>,
	options: TextareaContentFieldSizingOptions,
	/** When caret is at end, scroll this node into view (e.g. actions below the editor). */
	scrollAnchorRef?: RefObject<HTMLElement | null>,
) {
	const { minHeightPx, maxHeightPx } = options;
	const [userSized, setUserSized] = useState(false);
	const [lockedHeightPx, setLockedHeightPx] = useState<number | null>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: `value` must trigger remeasure when text changes (fallback path)
	useLayoutEffect(() => {
		const el = textareaRef.current;
		if (!el || userSized) return;
		if (supportsFieldSizingContent()) return;

		el.style.height = "auto";
		const next = Math.min(Math.max(el.scrollHeight, minHeightPx), maxHeightPx);
		el.style.height = `${next}px`;
	}, [userSized, minHeightPx, maxHeightPx, textareaRef, value]);

	// When typing at the end, keep the caret in view as the field grows or scrolls internally.
	useLayoutEffect(() => {
		const el = textareaRef.current;
		if (!el) return;
		if (
			el.selectionStart !== value.length ||
			el.selectionEnd !== value.length
		) {
			return;
		}
		const maxScrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
		if (el.scrollTop < maxScrollTop - SCROLL_SLACK_PX) {
			el.scrollTop = maxScrollTop;
		}

		const anchor = scrollAnchorRef?.current;
		if (anchor) {
			const rect = anchor.getBoundingClientRect();
			const viewH =
				typeof window !== "undefined" ? window.innerHeight : rect.bottom;
			// Only scroll the page if the anchor isn't already fully visible in the viewport.
			const anchorFullyVisible =
				rect.top >= -SCROLL_SLACK_PX && rect.bottom <= viewH + SCROLL_SLACK_PX;
			if (!anchorFullyVisible) {
				anchor.scrollIntoView({
					block: "end",
					inline: "nearest",
					behavior: "instant",
				});
			}
		}
	}, [value, textareaRef, scrollAnchorRef]);

	const onPointerDown = useCallback(
		(event: PointerEvent<HTMLTextAreaElement>) => {
			const t = event.currentTarget;
			const rect = t.getBoundingClientRect();
			if (
				event.clientX < rect.right - RESIZE_HANDLE_PX ||
				event.clientY < rect.bottom - RESIZE_HANDLE_PX
			) {
				return;
			}

			const startH = t.offsetHeight;

			const onUp = () => {
				const newH = t.offsetHeight;
				if (Math.abs(newH - startH) > 1) {
					const clamped = Math.min(Math.max(newH, minHeightPx), maxHeightPx);
					setUserSized(true);
					setLockedHeightPx(clamped);
				}
			};

			window.addEventListener("pointerup", onUp, { once: true });
		},
		[minHeightPx, maxHeightPx],
	);

	const sizingClassName = userSized
		? "[field-sizing:fixed]"
		: "[field-sizing:content]";

	const heightStyle: CSSProperties | undefined =
		userSized && lockedHeightPx != null
			? { height: lockedHeightPx }
			: undefined;

	return {
		onPointerDown,
		sizingClassName,
		heightStyle,
	};
}
