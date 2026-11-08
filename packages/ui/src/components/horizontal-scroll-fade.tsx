import {
	type CSSProperties,
	type ReactNode,
	type Ref,
	useCallback,
	useEffect,
	useMemo,
	useRef,
} from "react";

import {
	bindHorizontalWheelScroll,
	useHorizontalScrollFades,
} from "../hooks/use-horizontal-scroll-fades";
import { HORIZONTAL_SCROLL_FADE_WIDTH } from "../lib/horizontal-scroll-fade-insets";
import { cn } from "../lib/utils";

const SCROLL_FADE_WIDTH = HORIZONTAL_SCROLL_FADE_WIDTH;

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
	if (!ref) return;
	if (typeof ref === "function") {
		ref(value);
		return;
	}
	ref.current = value;
}

function buildHorizontalScrollMask(
	canScrollLeft: boolean,
	canScrollRight: boolean,
): string | undefined {
	if (!canScrollLeft && !canScrollRight) return undefined;

	const stops: string[] = [];
	if (canScrollLeft) {
		stops.push("transparent 0", `black ${SCROLL_FADE_WIDTH}`);
	} else {
		stops.push("black 0");
	}
	if (canScrollRight) {
		stops.push(`black calc(100% - ${SCROLL_FADE_WIDTH})`, "transparent 100%");
	} else {
		stops.push("black 100%");
	}
	return `linear-gradient(to right, ${stops.join(", ")})`;
}

export function HorizontalScrollFade({
	children,
	className,
	scrollClassName,
	contentClassName,
	scrollToEndDep,
	hideScrollbar = false,
	scrollRef: scrollRefProp,
}: {
	children: ReactNode;
	className?: string;
	scrollClassName?: string;
	/** Applied to the inner `w-max` row that actually overflows. */
	contentClassName?: string;
	scrollToEndDep?: number;
	hideScrollbar?: boolean;
	/** Optional ref to the scroll container (e.g. scroll-into-view). */
	scrollRef?: Ref<HTMLDivElement | null>;
}) {
	const {
		scrollRef: scrollRefInternal,
		canScrollLeft,
		canScrollRight,
		updateScrollState,
	} = useHorizontalScrollFades(scrollToEndDep);
	const unbindWheelRef = useRef<(() => void) | undefined>(undefined);

	const setScrollRef = useCallback(
		(el: HTMLDivElement | null) => {
			unbindWheelRef.current?.();
			scrollRefInternal.current = el;
			assignRef(scrollRefProp, el);
			unbindWheelRef.current = bindHorizontalWheelScroll(el, updateScrollState);
			if (el) updateScrollState();
		},
		[scrollRefInternal, scrollRefProp, updateScrollState],
	);

	useEffect(() => () => unbindWheelRef.current?.(), []);

	const scrollMask = useMemo(
		() => buildHorizontalScrollMask(canScrollLeft, canScrollRight),
		[canScrollLeft, canScrollRight],
	);

	const scrollMaskStyle = useMemo((): CSSProperties | undefined => {
		if (!scrollMask) return undefined;
		return {
			maskImage: scrollMask,
			WebkitMaskImage: scrollMask,
		};
	}, [scrollMask]);

	return (
		<div
			className={cn(
				"relative min-w-0 overflow-x-visible overflow-y-visible",
				className,
			)}
		>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: scroll container syncs fade visibility */}
			<div
				ref={setScrollRef}
				onScroll={updateScrollState}
				onMouseEnter={updateScrollState}
				style={scrollMaskStyle}
				className={cn(
					"flex w-full min-w-0 touch-pan-x overflow-x-auto overscroll-x-contain transition-[mask-image,-webkit-mask-image] duration-150 [-webkit-overflow-scrolling:touch]",
					hideScrollbar && "no-scrollbar",
					scrollClassName,
				)}
			>
				<div
					className={cn("flex w-max shrink-0 flex-nowrap", contentClassName)}
				>
					{children}
				</div>
			</div>
		</div>
	);
}
