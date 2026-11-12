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
	features: [
		{ name: "Emit", summary: "Sends an event.", path: "src/client.ts" },
	],
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
		expect(result.map.areas[0].features).toEqual([
			{ name: "Emit", summary: "Sends an event.", path: "src/client.ts" },
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
						files.client.features = [
							{ name: "Emit", summary: "Sends.", path: "../secrets.env" },
						];
					},
					[{ name: "Read Me.txt", text: "{}" }],
				),
			),
		).toEqual([
			'areas/client.json: "paths" must list at least one path pattern.',
			"areas/client.json: features[0].path must be a path inside the repository.",
			'areas/transport.json: paths[0] "src/{a,b": unmatched {.',
			"areas/Read Me.txt: name the file after the area, in lowercase letters, digits and dashes, ending in .json.",
		]);
	});

	it("refuses anything outside the format instead of ignoring it", () => {
		const problems = problemsOf(
			folder((files) => {
				files.index.theme = "dark";
				files.index.outside = [
					{ id: "server", name: "Event server", owner: "You" },
				];
				files.client.owners = ["nova"];
				files.client.icon = "rocket";
				files.client.tagline = "  ";
				files.client.outside = ["server", "queue"];
				files.client.flow = [
					{ kind: "worker", label: "Queue", note: "Runs later." },
					{ kind: "client", label: "Emit", note: "Sends.", cost: 3 },
				];
				files.client.entryPoints = [{ path: "src/client.ts", line: 12 }];
			}),
		);
		expect(new Set(problems)).toEqual(
			new Set([
				'map.json: unknown field "theme". Allowed: version, pitch, description, bands, ignore, outside, tour.',
				'areas/client.json: unknown field "owners". Allowed: name, icon, tagline, summary, paths, screen, flow, features, dependsOn, outside, issues.',
				'areas/client.json: unknown field "entryPoints". Allowed: name, icon, tagline, summary, paths, screen, flow, features, dependsOn, outside, issues.',
				'areas/client.json: "icon" must be one of: actions, cache, code, command, comment, commit, compare, computer, display, github, globe, home, inbox, issues, kit, layers, lock, package, pull, refresh, repo, reviews, settings, shell, tag.',
				'areas/client.json: "tagline" must be text of 1 to 2000 characters.',
				'areas/client.json: flow[0]: "kind" must be one of: page, component, client, server, route, github, storage, external, tool.',
				'areas/client.json: flow[1]: unknown field "cost". Allowed: kind, label, note, path.',
				'areas/client.json: outside names an outside system "queue" that map.json does not list.',
			]),
		);
	});

	it("catches what would only fail later: an empty alternative, a repeated feature name", () => {
		expect(
			problemsOf(
				folder((files) => {
					files.transport.paths = ["{,src/transport/**}"];
					files.client.features = [
						{ name: "Emit", summary: "Sends an event." },
						{ name: "Emit", summary: "Sends it again." },
					];
				}),
			),
		).toEqual([
			'areas/client.json: two features are named "Emit".',
			'areas/transport.json: paths[0] "{,src/transport/**}": pattern must be 1 to 300 characters.',
		]);
	});
});
