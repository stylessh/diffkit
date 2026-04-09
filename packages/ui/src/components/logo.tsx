import type * as React from "react";

import { cn } from "../lib/utils";

const SQUIRCLE =
	"M0 153.6C0 99.835 0 72.9524 10.4634 52.4169C19.6672 34.3534 34.3534 19.6672 52.4169 10.4634C72.9524 0 99.835 0 153.6 0H358.4C412.165 0 439.048 0 459.583 10.4634C477.647 19.6672 492.333 34.3534 501.537 52.4169C512 72.9524 512 99.835 512 153.6V358.4C512 412.165 512 439.048 501.537 459.583C492.333 477.647 477.647 492.333 459.583 501.537C439.048 512 412.165 512 358.4 512H153.6C99.835 512 72.9524 512 52.4169 501.537C34.3534 492.333 19.6672 477.647 10.4634 459.583C0 439.048 0 412.165 0 358.4V153.6Z";

const GRID_SIZE = 3;

// Contribution graph grid: 3x3 with intensity levels
// 0 = faintest, 1 = dim, 2 = medium, 3 = bright, 4 = brightest
const GRID = [
	[1, 0, 2],
	[2, 3, 1],
	[1, 4, 3],
];

const CELL_SIZE = 120;
const GAP = 18;
const R_INNER = 20;
const R_OUTER = 42;
const OFFSET = (512 - (GRID_SIZE * CELL_SIZE + (GRID_SIZE - 1) * GAP)) / 2;

const FILLS: Record<number, string> = {
	0: "rgba(0,0,0,0.45)",
	1: "rgba(0,0,0,0.28)",
	2: "rgba(0,0,0,0.15)",
	3: "rgba(255,255,255,0.35)",
	4: "rgba(255,255,255,0.5)",
};

const CELLS = GRID.flatMap((row, cy) =>
	row.map((level, cx) => ({ id: `${cx}-${cy}`, cx, cy, level })),
);

// Build a rounded rect path with individual corner radii (squircle-like via cubic beziers)
function roundedRect(
	x: number,
	y: number,
	w: number,
	h: number,
	[tl, tr, br, bl]: [number, number, number, number],
) {
	// Smoothing factor for squircle-like corners (1 = circular arc, ~0.552 is standard, ~0.66 is iOS-like)
	const k = 0.66;
	return [
		`M${x + tl},${y}`,
		`L${x + w - tr},${y}`,
		`C${x + w - tr * (1 - k)},${y} ${x + w},${y + tr * (1 - k)} ${x + w},${y + tr}`,
		`L${x + w},${y + h - br}`,
		`C${x + w},${y + h - br * (1 - k)} ${x + w - br * (1 - k)},${y + h} ${x + w - br},${y + h}`,
		`L${x + bl},${y + h}`,
		`C${x + bl * (1 - k)},${y + h} ${x},${y + h - bl * (1 - k)} ${x},${y + h - bl}`,
		`L${x},${y + tl}`,
		`C${x},${y + tl * (1 - k)} ${x + tl * (1 - k)},${y} ${x + tl},${y}`,
		"Z",
	].join(" ");
}

function cellRadii(cx: number, cy: number): [number, number, number, number] {
	const isTop = cy === 0;
	const isBottom = cy === GRID_SIZE - 1;
	const isLeft = cx === 0;
	const isRight = cx === GRID_SIZE - 1;

	return [
		isTop && isLeft ? R_OUTER : R_INNER,
		isTop && isRight ? R_OUTER : R_INNER,
		isBottom && isRight ? R_OUTER : R_INNER,
		isBottom && isLeft ? R_OUTER : R_INNER,
	];
}

function Logo({
	className,
	variant = "default",
	...props
}: React.ComponentProps<"svg"> & { variant?: "default" | "dev" }) {
	return (
		<svg
			data-slot="logo"
			viewBox="0 0 512 512"
			aria-hidden="true"
			className={cn("size-10 shrink-0", className)}
			{...props}
		>
			<path
				d={SQUIRCLE}
				className={variant === "dev" ? "fill-brand-dev" : "fill-brand"}
			/>
			{CELLS.map((cell) => (
				<path
					key={cell.id}
					d={roundedRect(
						OFFSET + cell.cx * (CELL_SIZE + GAP),
						OFFSET + cell.cy * (CELL_SIZE + GAP),
						CELL_SIZE,
						CELL_SIZE,
						cellRadii(cell.cx, cell.cy),
					)}
					fill={FILLS[cell.level]}
					stroke="rgba(255,255,255,0.12)"
					strokeWidth={2}
				/>
			))}
		</svg>
	);
}

export { Logo };
