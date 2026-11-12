import { describe, expect, it } from "vitest";
import { parseMapFile } from "../../../dashboard/src/lib/product-map/map-file.ts";
import { beaconProductMap } from "../seed/content/beacon-map.ts";

describe("the seeded product map", () => {
	it("passes the dashboard's own map file check", () => {
		const parsed = parseMapFile(beaconProductMap);
		expect(parsed.ok ? [] : parsed.problems).toEqual([]);
	});
});
