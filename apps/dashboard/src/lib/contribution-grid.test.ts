import { describe, expect, it } from "vitest";
import { dayIndexForSlot, fitContributionGrid } from "./contribution-grid";

const YEAR = 371;

describe("fitContributionGrid", () => {
	it.each([
		[1900, 224],
		[1280, 192],
		[390, 192],
	])("fits a full year into a %ix%i banner and fills it edge to edge", (width, height) => {
		const layout = fitContributionGrid(width, height, YEAR);
		if (!layout) throw new Error("expected a layout");

		expect(layout.cols * layout.rows).toBeGreaterThanOrEqual(YEAR);
		expect(layout.skipped).toBe(0);

		const gridWidth =
			layout.cols * layout.cell + (layout.cols - 1) * layout.gap;
		const gridHeight =
			layout.rows * layout.cell + (layout.rows - 1) * layout.gap;
		expect(gridWidth).toBeLessThanOrEqual(width + 1e-6);
		expect(gridHeight).toBeLessThanOrEqual(height + 1e-6);
		// One axis meets the edge exactly; the other is centred.
		expect(Math.min(width - gridWidth, height - gridHeight)).toBeCloseTo(0, 6);
	});

	it("grows the cells instead of leaving a wide banner mostly empty", () => {
		const wide = fitContributionGrid(1900, 224, YEAR);
		const narrow = fitContributionGrid(640, 224, YEAR);
		expect(wide?.cell).toBeGreaterThan(
			narrow?.cell ?? Number.POSITIVE_INFINITY,
		);
	});

	it("puts the newest day in the last slot and the empty slots first", () => {
		const layout = fitContributionGrid(1900, 224, YEAR);
		if (!layout) throw new Error("expected a layout");
		expect(dayIndexForSlot(layout, layout.cols - 1, layout.rows - 1)).toBe(
			YEAR - 1,
		);
		expect(dayIndexForSlot(layout, 0, 0)).toBe(layout.leading > 0 ? null : 0);
	});

	it("keeps the newest days when even the smallest cells cannot fit the year", () => {
		const layout = fitContributionGrid(80, 40, YEAR);
		if (!layout) throw new Error("expected a layout");
		expect(layout.skipped).toBe(YEAR - layout.cols * layout.rows);
		expect(dayIndexForSlot(layout, 0, 0)).toBe(layout.skipped);
		expect(dayIndexForSlot(layout, layout.cols - 1, layout.rows - 1)).toBe(
			YEAR - 1,
		);
	});
});
