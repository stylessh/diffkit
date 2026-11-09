"use client";

import type * as React from "react";
import { useCallback, useEffect, useRef } from "react";

import { easedFadeMask } from "../lib/eased-mask";
import { cn } from "../lib/utils";

type ScrollFadeOrientation = "horizontal" | "vertical";

const HORIZONTAL_MASK = easedFadeMask(
	"to right",
	"var(--scroll-fade-start)",
	"var(--scroll-fade-end)",
);
const VERTICAL_MASK = easedFadeMask(
	"to bottom",
	"var(--scroll-fade-start)",
	"var(--scroll-fade-end)",
);

/**
 * A scroller whose edges fade where there is more to scroll to, and only
 * there: at rest at the start, only the far edge fades. The fades ease in and
 * out (their lengths are registered `@property`s in globals.css).
 */
function ScrollFade({
	orientation = "horizontal",
	fade = 24,
	className,
	style,
	ref,
	onScroll,
	...props
}: React.ComponentProps<"div"> & {
	orientation?: ScrollFadeOrientation;
	/** Length of each edge's fade, in px. */
	fade?: number;
}) {
	const scroller = useRef<HTMLDivElement | null>(null);

	const measure = useCallback(() => {
		const element = scroller.current;
		if (!element) {
			return;
		}
		const [offset, size, client] =
			orientation === "horizontal"
				? [element.scrollLeft, element.scrollWidth, element.clientWidth]
				: [element.scrollTop, element.scrollHeight, element.clientHeight];
		const remaining = size - client - offset;
		element.style.setProperty(
			"--scroll-fade-start",
			`${Math.min(fade, Math.max(0, offset))}px`,
		);
		element.style.setProperty(
			"--scroll-fade-end",
			`${Math.min(fade, Math.max(0, remaining))}px`,
		);
	}, [fade, orientation]);

	useEffect(() => {
		const element = scroller.current;
		if (!element) {
			return;
		}
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(element);
		for (const child of element.children) {
			observer.observe(child);
		}
		return () => observer.disconnect();
	}, [measure]);

	const attach = useCallback(
		(element: HTMLDivElement | null) => {
			scroller.current = element;
			if (typeof ref === "function") {
				ref(element);
			} else if (ref) {
				ref.current = element;
			}
		},
		[ref],
	);

	const mask = orientation === "horizontal" ? HORIZONTAL_MASK : VERTICAL_MASK;

	return (
		<div
			className={cn(
				"[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
				orientation === "horizontal"
					? "overflow-x-auto overscroll-x-contain"
					: "overflow-y-auto overscroll-y-contain",
				className,
			)}
			data-slot="scroll-fade"
			onScroll={(event) => {
				measure();
				onScroll?.(event);
			}}
			ref={attach}
			style={{
				maskImage: mask,
				WebkitMaskImage: mask,
				...style,
			}}
			{...props}
		/>
	);
}

export { ScrollFade, type ScrollFadeOrientation };
