import { describe, expect, it } from "vitest";
import { SAMPLE_AREA_ID, sampleProductMap } from "./product-map-samples";

describe("sampleProductMap", () => {
	it("gives a skeleton every part of the page to measure", () => {
		const map = sampleProductMap("acme", "widgets");

		expect(map.repo).toEqual({
			owner: "acme",
			name: "widgets",
			branch: "main",
		});
		expect(map.activity?.totals).toMatchObject({
			files: 9,
			mergedPulls: 5,
			people: 2,
			unmappedFiles: 0,
		});

		const area = map.areaById.get(SAMPLE_AREA_ID);
		expect(area?.flow.length).toBeGreaterThan(0);
		expect(area?.features.length).toBeGreaterThan(0);
		expect(area?.dependsOn.length).toBeGreaterThan(0);
		const live = map.activity?.areas[SAMPLE_AREA_ID];
		expect(live?.hotFiles.length).toBeGreaterThan(0);
		expect(live?.people.length).toBeGreaterThan(0);
		expect(live?.mergedPulls).toBeGreaterThan(0);
	});
});
