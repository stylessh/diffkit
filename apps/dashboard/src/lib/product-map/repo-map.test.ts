import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MAP_FILE_PATH, parseMapFile } from "./map-file";
import { createAreaMatcher } from "./path-rules";

const root = path.resolve(import.meta.dirname, "../../../../..");
const parsed = parseMapFile(
	readFileSync(path.join(root, MAP_FILE_PATH), "utf8"),
);

/** DiffKit's own map is the reference example, so it must never rot. */
describe("this repository's map file", () => {
	it("is a valid map", () => {
		expect(parsed.ok ? [] : parsed.problems).toEqual([]);
	});

	it("only points at files that exist", () => {
		if (!parsed.ok) return;
		const referenced = parsed.map.areas.flatMap((area) => [
			...area.flow.flatMap((step) => (step.path ? [step.path] : [])),
			...area.entryPoints.map((entry) => entry.path),
			...area.features.flatMap((feature) =>
				feature.entry.map((entry) => entry.path),
			),
			...(area.screen ? [area.screen.light, area.screen.dark] : []),
		]);
		const missing = [...new Set(referenced)].filter(
			(file) => !existsSync(path.join(root, file)),
		);
		expect(missing).toEqual([]);
	});

	it("gives every area at least one file", () => {
		if (!parsed.ok) return;
		const match = createAreaMatcher(parsed.map.rules, parsed.map.ignore);
		const files = execFileSync("git", ["ls-files"], {
			cwd: root,
			encoding: "utf8",
			maxBuffer: 64 * 1024 * 1024,
		}).split("\n");
		const covered = new Set(
			files.flatMap((file) => {
				const found = match(file);
				return found.kind === "area" ? [found.area] : [];
			}),
		);
		expect(
			parsed.map.areas.map((area) => area.id).filter((id) => !covered.has(id)),
		).toEqual([]);
	});
});
