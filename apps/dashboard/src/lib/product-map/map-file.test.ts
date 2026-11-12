import { describe, expect, it } from "vitest";
import { type MapFolderSource, parseMapFolder } from "./map-file";

const index = {
	version: 1,
	pitch: "Beacon sends typed events.",
	bands: [
		{
			id: "library",
			name: "The library",
			groups: [{ id: "core", name: "Core", areas: ["client", "transport"] }],
		},
	],
};
const client = {
	name: "Event client",
	tagline: "Typed emit and subscribe",
	summary: "What an app imports.",
	paths: ["src/**"],
	dependsOn: ["transport"],
	entryPoints: [{ path: "src/client.ts", line: 12, role: "The client" }],
	issues: [{ number: 13, note: "Leaks listeners." }],
};
const transport = {
	name: "Transports",
	tagline: "How events travel",
	summary: "WebSocket and fetch transports.",
	paths: ["src/transport/**"],
	issues: [{ number: 13 }],
};

function folder(
	change: (files: {
		index: Record<string, unknown>;
		client: Record<string, unknown>;
		transport: Record<string, unknown>;
	}) => void = () => {},
	extra: MapFolderSource["areas"] = [],
): MapFolderSource {
	const files = structuredClone({ index, client, transport });
	change(files);
	return {
		index: JSON.stringify(files.index),
		areas: [
			{ name: "client.json", text: JSON.stringify(files.client) },
			{ name: "transport.json", text: JSON.stringify(files.transport) },
			...extra,
		],
	};
}

function problemsOf(source: MapFolderSource) {
	const result = parseMapFolder(source);
	return result.ok ? [] : result.problems;
}

describe("parseMapFolder", () => {
	it("joins the files, taking each area's id from its file name", () => {
		const result = parseMapFolder(folder());
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.map.areas.map((area) => area.id)).toEqual([
			"client",
			"transport",
		]);
		expect(result.map.rules).toEqual([
			{ path: "src/**", area: "client" },
			{ path: "src/transport/**", area: "transport" },
		]);
		expect(result.map.areas[1].flow).toEqual([]);
		expect(result.map.tour).toEqual([]);
	});

	it("gathers an issue's areas from every file that hints at it", () => {
		const result = parseMapFolder(folder());
		expect(result.ok && result.map.issues).toEqual([
			{ number: 13, areas: ["client", "transport"], note: "Leaks listeners." },
		]);
	});

	it("refuses a folder whose map.json is not a version 1 map", () => {
		expect(problemsOf({ index: "{ nope", areas: [] })).toEqual([
			"map.json is not a JSON object.",
		]);
		expect(
			problemsOf(
				folder((files) => {
					files.index.version = 2;
				}),
			),
		).toEqual(['map.json: "version" must be 1.']);
	});

	it("says which file names an area that does not exist", () => {
		expect(
			problemsOf(
				folder((files) => {
					files.transport.dependsOn = ["storage"];
				}),
			),
		).toEqual([
			'areas/transport.json: dependsOn names an unknown area "storage".',
		]);
	});

	it("catches an area file that map.json never places, or places twice", () => {
		expect(
			problemsOf(
				folder((files) => {
					files.index.bands = [
						{
							id: "library",
							name: "The library",
							groups: [
								{ id: "core", name: "Core", areas: ["client", "client"] },
							],
						},
					];
				}),
			),
		).toEqual([
			'Area "client" is in more than one group.',
			'Area "transport" is not in any group in map.json, so it would not show.',
		]);
	});

	it("rejects bad patterns, missing patterns, stray paths and misnamed files", () => {
		expect(
			problemsOf(
				folder(
					(files) => {
						files.transport.paths = ["src/{a,b"];
						files.client.paths = [];
						files.client.entryPoints = [
							{ path: "../secrets.env", line: 1, role: "x" },
						];
					},
					[{ name: "Read Me.txt", text: "{}" }],
				),
			),
		).toEqual([
			'areas/client.json: "paths" must list at least one path pattern.',
			"areas/client.json: entryPoints[0].path must be a path inside the repository.",
			'areas/transport.json: paths[0] "src/{a,b": unmatched {.',
			"areas/Read Me.txt: name the file after the area, in lowercase letters, digits and dashes, ending in .json.",
		]);
	});
});
