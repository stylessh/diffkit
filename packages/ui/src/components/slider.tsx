"use client";

import * as SliderPrimitive from "@radix-ui/react-slider";
import type * as React from "react";
import { cn } from "../lib/utils";

type SliderProps = Omit<
	React.ComponentProps<typeof SliderPrimitive.Root>,
	"children"
> & {
	/** Accessible name for the (single) thumb. */
	ariaLabel: string;
	ariaValueText?: string;
	/** Values (in `min`..`max` units) that get a tick dot on the track. */
	marks?: readonly number[];
};

/**
 * Single-thumb slider. Pass `value` / `defaultValue` as a one-element array, per Radix:
 * `<Slider ariaLabel="Zoom" defaultValue={[50]} onValueChange={([v]) => …} />`.
 */
function Slider({
	ariaLabel,
	ariaValueText,
	className,
	marks = [],
	max = 100,
	min = 0,
	...props
}: SliderProps) {
	return (
		<SliderPrimitive.Root
			className={cn(
				"relative flex h-8 w-full touch-none select-none items-center data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
				className,
			)}
			data-slot="slider"
			max={max}
			min={min}
			{...props}
		>
			<SliderPrimitive.Track
				className="relative h-3 w-full grow rounded-full bg-row-selected"
				data-slot="slider-track"
			>
				<SliderPrimitive.Range
					className="absolute h-full rounded-full bg-foreground"
					data-slot="slider-range"
				/>
				{marks.map((mark) => (
					<span
						aria-hidden
						className="pointer-events-none absolute top-1/2 z-[1] size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background ring-1 ring-foreground/20"
						key={mark}
						style={{ left: `${((mark - min) / (max - min)) * 100}%` }}
					/>
				))}
			</SliderPrimitive.Track>
			<SliderPrimitive.Thumb
				aria-label={ariaLabel}
				aria-valuetext={ariaValueText}
				className="z-[2] block size-6 rounded-full border-2 border-foreground bg-background shadow-sm outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[disabled]:cursor-not-allowed"
				data-slot="slider-thumb"
			/>
		</SliderPrimitive.Root>
	);
}

export type { SliderProps };
export { Slider };
