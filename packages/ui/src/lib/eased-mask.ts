/**
 * Stops tracing an ease-in-out curve (position along the fade, opacity there).
 * A linear ramp shows a hard edge where it meets full opacity; this does not.
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

/**
 * A mask gradient that eases in over `start` and out over `end` along
 * `direction`. Lengths are any CSS length, including `var()` and `calc()`.
 */
export function easedFadeMask(direction: string, start: string, end: string) {
	const head = EASE.map(
		([at, alpha]) => `rgb(0 0 0 / ${alpha}) calc(${start} * ${at})`,
	);
	const tail = [...EASE]
		.reverse()
		.map(([at, alpha]) => `rgb(0 0 0 / ${alpha}) calc(100% - ${end} * ${at})`);
	return `linear-gradient(${direction}, ${[...head, ...tail].join(", ")})`;
}
