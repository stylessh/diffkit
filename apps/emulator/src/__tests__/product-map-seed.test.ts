import { describe, expect, it } from "vitest";
import {
	MAP_AREAS_PATH,
	MAP_FILE_PATH,
	parseMapFolder,
} from "../../../dashboard/src/lib/product-map/map-file.ts";
import { beaconProductMapFiles } from "../seed/content/beacon-map.ts";

describe("the seeded product map", () => {
	it("passes the dashboard's own map check", () => {
		const prefix = `${MAP_AREAS_PATH}/`;
		const parsed = parseMapFolder({
			index: beaconProductMapFiles[MAP_FILE_PATH] ?? "",
			areas: Object.entries(beaconProductMapFiles)
				.filter(([file]) => file.startsWith(prefix))
				.map(([file, text]) => ({ name: file.slice(prefix.length), text })),
		});
		expect(parsed.ok ? [] : parsed.problems).toEqual([]);
	});
});
