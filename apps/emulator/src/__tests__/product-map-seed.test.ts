import { describe, expect, it } from "vitest";
import {
	MAP_AREAS_PATH,
	MAP_FILE_PATH,
	parseMapFolder,
} from "../../../dashboard/src/lib/product-map/map-file.ts";
import { beacon } from "../seed/content/beacon.ts";
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

	it("only mentions files that are on the demo repository's main branch", () => {
		const onMain = new Set<string>();
		for (const commit of beacon.commits)
			for (const [file, content] of Object.entries(commit.files))
				if (content === null) onMain.delete(file);
				else onMain.add(file);
		const mentioned = Object.entries(beaconProductMapFiles)
			.filter(([file]) => file.startsWith(`${MAP_AREAS_PATH}/`))
			.flatMap(([, text]) => {
				const area = JSON.parse(text) as {
					flow?: { path?: string }[];
					features?: { path?: string }[];
				};
				return [...(area.flow ?? []), ...(area.features ?? [])].flatMap(
					(item) => (item.path ? [item.path] : []),
				);
			});
		expect(mentioned.filter((file) => !onMain.has(file))).toEqual([]);
	});
});
