import {
	type PointerEvent,
	type ReactNode,
	type Ref,
	type RefObject,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { cn } from "../lib/utils";

const MIN_OVERLAY_SCROLLBAR_THUMB_HEIGHT = 36;

type ScrollMetrics = {
	scrollTop: number;
	scrollHeight: number;
	clientHeight: number;
};

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
	if (!ref) return;
	if (typeof ref === "function") {
		ref(value);
		return;
	}
	ref.current = value;
}

export function OverlayScrollArea({
	children,
	className,
	viewportClassName,
	contentClassName,
	viewportRef,
}: {
	children: ReactNode;
	className?: string;
	viewportClassName?: string;
	contentClassName?: string;
	viewportRef?: Ref<HTMLDivElement | null>;
}) {
	const scrollRef = useRef<HTMLDivElement | null>(null);
	const contentRef = useRef<HTMLDivElement>(null);
	const [scrollMetrics, setScrollMetrics] = useState<ScrollMetrics>({
		scrollTop: 0,
		scrollHeight: 0,
		clientHeight: 0,
	});

	const updateScrollMetrics = useCallback(() => {
		const scrollEl = scrollRef.current;
		if (!scrollEl) return;

		const next = {
			scrollTop: scrollEl.scrollTop,
			scrollHeight: scrollEl.scrollHeight,
			clientHeight: scrollEl.clientHeight,
		};
		setScrollMetrics((current) =>
			current.scrollTop === next.scrollTop &&
			current.scrollHeight === next.scrollHeight &&
			current.clientHeight === next.clientHeight
				? current
				: next,
		);
	}, []);

	const setScrollRef = useCallback(
		(el: HTMLDivElement | null) => {
			scrollRef.current = el;
			assignRef(viewportRef, el);
			if (el) updateScrollMetrics();
		},
		[viewportRef, updateScrollMetrics],
	);

	useEffect(() => {
		const scrollEl = scrollRef.current;
		const contentEl = contentRef.current;
		if (!scrollEl) return;

		updateScrollMetrics();
		scrollEl.addEventListener("scroll", updateScrollMetrics, { passive: true });
		const resizeObserver = new ResizeObserver(updateScrollMetrics);
		resizeObserver.observe(scrollEl);
		if (contentEl) {
			resizeObserver.observe(contentEl);
		}
		window.addEventListener("resize", updateScrollMetrics);

		return () => {
			scrollEl.removeEventListener("scroll", updateScrollMetrics);
			resizeObserver.disconnect();
			window.removeEventListener("resize", updateScrollMetrics);
		};
	}, [updateScrollMetrics]);

	return (
		<div className={cn("relative min-h-0 overflow-hidden", className)}>
			<div
				ref={setScrollRef}
				className={cn(
					"no-scrollbar h-full overflow-x-hidden overflow-y-auto overscroll-y-contain",
					viewportClassName,
				)}
			>
				<div ref={contentRef} className={contentClassName}>
					{children}
				</div>
			</div>
			<OverlayScrollbar scrollRef={scrollRef} metrics={scrollMetrics} />
		</div>
	);
}

function OverlayScrollbar({
	scrollRef,
	metrics,
}: {
	scrollRef: RefObject<HTMLDivElement | null>;
	metrics: ScrollMetrics;
}) {
	const dragRef = useRef<{
		pointerId: number;
		startY: number;
		startScrollTop: number;
		maxScrollTop: number;
		trackHeight: number;
		thumbHeight: number;
	} | null>(null);

	const maxScrollTop = Math.max(0, metrics.scrollHeight - metrics.clientHeight);
	const isScrollable = maxScrollTop > 1 && metrics.clientHeight > 0;
	if (!isScrollable) return null;

	const thumbHeight = Math.min(
		metrics.clientHeight,
		Math.max(
			MIN_OVERLAY_SCROLLBAR_THUMB_HEIGHT,
			(metrics.clientHeight / metrics.scrollHeight) * metrics.clientHeight,
		),
	);
	const trackTravel = Math.max(1, metrics.clientHeight - thumbHeight);
	const thumbTop = (metrics.scrollTop / maxScrollTop) * trackTravel;

	const setScrollFromTrackOffset = (offsetY: number) => {
		const scrollEl = scrollRef.current;
		if (!scrollEl) return;
		const nextTop = Math.max(
			0,
			Math.min(trackTravel, offsetY - thumbHeight / 2),
		);
		scrollEl.scrollTop = (nextTop / trackTravel) * maxScrollTop;
	};

	const handleTrackPointerDown = (event: PointerEvent<HTMLDivElement>) => {
		if (event.target !== event.currentTarget) return;
		const rect = event.currentTarget.getBoundingClientRect();
		setScrollFromTrackOffset(event.clientY - rect.top);
	};

	const handleThumbPointerDown = (event: PointerEvent<HTMLDivElement>) => {
		const scrollEl = scrollRef.current;
		if (!scrollEl) return;
		event.preventDefault();
		event.currentTarget.setPointerCapture(event.pointerId);
		dragRef.current = {
			pointerId: event.pointerId,
			startY: event.clientY,
			startScrollTop: scrollEl.scrollTop,
			maxScrollTop,
			trackHeight: metrics.clientHeight,
			thumbHeight,
		};
	};

	const handleThumbPointerMove = (event: PointerEvent<HTMLDivElement>) => {
		const drag = dragRef.current;
		const scrollEl = scrollRef.current;
		if (!drag || !scrollEl || drag.pointerId !== event.pointerId) return;
		const travel = Math.max(1, drag.trackHeight - drag.thumbHeight);
		const deltaY = event.clientY - drag.startY;
		scrollEl.scrollTop =
			drag.startScrollTop + (deltaY / travel) * drag.maxScrollTop;
	};

	const handleThumbPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
		if (dragRef.current?.pointerId !== event.pointerId) return;
		dragRef.current = null;
		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId);
		}
	};

	return (
		<div
			className="absolute inset-y-0 right-0 z-20 w-3"
			aria-hidden
			onPointerDown={handleTrackPointerDown}
		>
			<div
				className="absolute right-1 w-1.5 rounded-full bg-border/70 transition-colors hover:bg-ring dark:bg-surface-2 dark:hover:bg-ring"
				style={{ height: thumbHeight, transform: `translateY(${thumbTop}px)` }}
				onPointerDown={handleThumbPointerDown}
				onPointerMove={handleThumbPointerMove}
				onPointerUp={handleThumbPointerEnd}
				onPointerCancel={handleThumbPointerEnd}
			/>
		</div>
	);
}
