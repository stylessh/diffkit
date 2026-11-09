/** Gap between cells as a share of the cell, GitHub's 11px cell to 3px gap. */
export const GAP_RATIO = 3 / 11;

export type ContributionGridLayout = {
	cell: number;
	gap: number;
	cols: number;
	rows: number;
	offsetX: number;
	offsetY: number;
	/** Empty slots before the first day, so the newest day lands on the last slot. */
	leading: number;
	/** Oldest days left out when even the smallest cells cannot fit them all. */
	skipped: number;
};

function capacity(width: number, height: number, cell: number) {
	const step = cell * (1 + GAP_RATIO);
	const gap = cell * GAP_RATIO;
	const cols = Math.floor((width + gap) / step);
	const rows = Math.floor((height + gap) / step);
	return { cols, rows, slots: cols * rows };
}

/**
 * The largest square cells that fit every day into `width` × `height`, laid
 * out column by column, oldest first. The grid is then stretched to meet one
 * edge exactly and centred on the other, so it always fills the area.
 */
export function fitContributionGrid(
	width: number,
	height: number,
	days: number,
	{ minCell = 6, maxCell = 48 }: { minCell?: number; maxCell?: number } = {},
): ContributionGridLayout | null {
	if (width <= 0 || height <= 0 || days <= 0) return null;

	let low = minCell;
	let high = maxCell;
	if (capacity(width, height, low).slots >= days) {
		for (let i = 0; i < 24; i++) {
			const mid = (low + high) / 2;
			if (capacity(width, height, mid).slots >= days) low = mid;
			else high = mid;
		}
	}

	const { cols, rows, slots } = capacity(width, height, low);
	if (cols === 0 || rows === 0) return null;

	const cell = Math.min(
		width / (cols + (cols - 1) * GAP_RATIO),
		height / (rows + (rows - 1) * GAP_RATIO),
	);
	const gap = cell * GAP_RATIO;
	const gridWidth = cols * cell + (cols - 1) * gap;
	const gridHeight = rows * cell + (rows - 1) * gap;

	return {
		cell,
		gap,
		cols,
		rows,
		offsetX: (width - gridWidth) / 2,
		offsetY: (height - gridHeight) / 2,
		leading: Math.max(0, slots - days),
		skipped: Math.max(0, days - slots),
	};
}

/** The day shown in a slot, or null for the empty slots before the first day. */
export function dayIndexForSlot(
	layout: ContributionGridLayout,
	col: number,
	row: number,
): number | null {
	if (col < 0 || row < 0 || col >= layout.cols || row >= layout.rows) {
		return null;
	}
	const slot = col * layout.rows + row - layout.leading;
	return slot < 0 ? null : slot + layout.skipped;
}
