"use client";

import type * as React from "react";
import { useCallback, useEffect, useRef } from "react";

import { cn } from "../lib/utils";

type ScrollFadeOrientation = "horizontal" | "vertical";

/**
 * An eased fade, not a linear one: a linear ramp shows a hard edge where it
 * meets full opacity. These stops trace an ease-in-out curve (position along
 * the fade, opacity there).
 */
const EASE: ReadonlyArray<readonly [number, number]> = [
	[0, 0],
	[0.081, 0.013],
	[0.155, 0.049],
	[0.225, 0.104],
	[0.29, 0.175],
	[0.353, 0.259],
	[0.412, 0.352],
	[0.471, 0.45],
	[0.529, 0.55],
	[0.588, 0.648],
	[0.647, 0.741],
	[0.71, 0.825],
	[0.775, 0.896],
	[0.845, 0.951],
	[0.919, 0.987],
	[1, 1],
];

function easedMask(direction: string) {
	const start = EASE.map(
		([at, alpha]) =>
			`rgb(0 0 0 / ${alpha}) calc(var(--scroll-fade-start) * ${at})`,
	);
	const end = [...EASE]
		.reverse()
		.map(
			([at, alpha]) =>
				`rgb(0 0 0 / ${alpha}) calc(100% - var(--scroll-fade-end) * ${at})`,
		);
	return `linear-gradient(${direction}, ${[...start, ...end].join(", ")})`;
}

const HORIZONTAL_MASK = easedMask("to right");
const VERTICAL_MASK = easedMask("to bottom");

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
