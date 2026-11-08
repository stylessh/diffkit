import { describe, expect, it } from "vitest";
import {
	createSafePolygon,
	getSubmenuSide,
	isMovingTowardSubmenu,
	isPointInSafePolygon,
	type SafePolygonRect,
} from "./safe-polygon";

const source: SafePolygonRect = {
	top: 100,
	right: 200,
	bottom: 140,
	left: 40,
};

describe("safe polygon geometry", () => {
	it("keeps a diagonal path toward a right-opening submenu safe", () => {
		const polygon = createSafePolygon(
			{ x: 200, y: 120 },
			{ top: 80, right: 500, bottom: 300, left: 220 },
			"right",
		);

		expect(isPointInSafePolygon({ x: 210, y: 150 }, polygon)).toBe(true);
		expect(isPointInSafePolygon({ x: 210, y: 260 }, polygon)).toBe(false);
	});

	it("supports a submenu that collision-flips to the left", () => {
		const destination = { top: 80, right: 20, bottom: 300, left: -200 };
		const polygon = createSafePolygon({ x: 40, y: 120 }, destination, "left");

		expect(getSubmenuSide(source, destination)).toBe("left");
		expect(isPointInSafePolygon({ x: 30, y: 150 }, polygon)).toBe(true);
		expect(isPointInSafePolygon({ x: 30, y: 280 }, polygon)).toBe(false);
	});

	it("treats polygon edges as safe", () => {
		const polygon = createSafePolygon(
			{ x: 200, y: 120 },
			{ top: 80, right: 500, bottom: 300, left: 220 },
			"right",
		);

		expect(isPointInSafePolygon(polygon[1], polygon)).toBe(true);
		expect(isPointInSafePolygon({ x: 200, y: 120 }, polygon)).toBe(true);
	});

	it("infers vertical submenu placement", () => {
		expect(
			getSubmenuSide(source, {
				top: 180,
				right: 240,
				bottom: 360,
				left: 20,
			}),
		).toBe("bottom");
	});

	it("rejects decisive movement away from the submenu", () => {
		expect(
			isMovingTowardSubmenu({ x: 210, y: 120 }, { x: 204, y: 120 }, "right"),
		).toBe(false);
		expect(
			isMovingTowardSubmenu({ x: 210, y: 120 }, { x: 208, y: 140 }, "right"),
		).toBe(true);
	});
});
