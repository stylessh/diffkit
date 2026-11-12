import { describe, expect, it } from "vitest";
import { parseMapFile } from "./map-file";

const valid = {
	version: 1,
	pitch: "Beacon sends typed events.",
	bands: [
		{
			id: "library",
			name: "The library",
			groups: [{ id: "core", name: "Core", areas: ["client", "transport"] }],
		},
	],
	areas: [
		{
			id: "client",
			name: "Event client",
			tagline: "Typed emit and subscribe",
			summary: "What an app imports.",
			dependsOn: ["transport"],
			entryPoints: [{ path: "src/client.ts", line: 12, role: "The client" }],
		},
		{
			id: "transport",
			name: "Transports",
			tagline: "How events travel",
			summary: "WebSocket and fetch transports.",
		},
	],
	rules: [
		{ path: "src/transport/**", area: "transport" },
		{ path: "src/**", area: "client" },
	],
};

function problemsOf(change: (map: typeof valid) => unknown) {
	const copy = structuredClone(valid);
	const result = parseMapFile(JSON.stringify(change(copy) ?? copy));
	return result.ok ? [] : result.problems;
}

describe("parseMapFile", () => {
	it("reads a minimal map and fills the optional lists", () => {
		const result = parseMapFile(JSON.stringify(valid));
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.map.areas[0].entryPoints).toEqual([
			{ path: "src/client.ts", line: 12, role: "The client" },
		]);
		expect(result.map.areas[1].flow).toEqual([]);
		expect(result.map.tour).toEqual([]);
		expect(result.map.ignore).toEqual([]);
	});

	it("refuses text that is not a version 1 map", () => {
		expect(parseMapFile("{ nope")).toEqual({
			ok: false,
			problems: ["The file is not valid JSON."],
		});
		expect(problemsOf((map) => ({ ...map, version: 2 }))).toEqual([
			'"version" must be 1.',
		]);
	});

	it("names areas that are referenced but not defined", () => {
		expect(
			problemsOf((map) => {
				map.rules.push({ path: "docs/**", area: "docs" });
				map.areas[1] = { ...map.areas[1], dependsOn: ["storage"] } as never;
			}),
		).toEqual([
			'Area "transport" dependsOn names an unknown area "storage".',
			'map.rules[2] names an unknown area "docs".',
		]);
	});

	it("catches an area that would never show or shows twice", () => {
		expect(
			problemsOf((map) => {
				map.bands[0].groups[0].areas = ["client", "client"];
			}),
		).toEqual([
			'Area "client" is in more than one group.',
			'Area "transport" is not in any group, so it would not show.',
		]);
	});

	it("rejects a pattern the matcher would refuse and a path that leaves the repository", () => {
		expect(
			problemsOf((map) => {
				map.rules[0].path = "src/{a,b";
				map.areas[0].entryPoints = [
					{ path: "../secrets.env", line: 1, role: "x" },
				];
			}),
		).toEqual([
			"map.areas[0].entryPoints[0].path must be a path inside the repository.",
			'map.rules[0].path "src/{a,b": unmatched {.',
		]);
	});
});
