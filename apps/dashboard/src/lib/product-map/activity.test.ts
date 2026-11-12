import { describe, expect, it } from "vitest";
import { buildMapActivity, type PullInput } from "./activity";
import { parseMapFolder } from "./map-file";

const area = (name: string, extra: Record<string, unknown>) =>
	JSON.stringify({ name, tagline: "t", summary: "s", ...extra });

const parsed = parseMapFolder({
	index: JSON.stringify({
		version: 1,
		pitch: "Beacon sends typed events.",
		bands: [
			{
				id: "library",
				name: "The library",
				groups: [{ id: "core", name: "Core", areas: ["client", "transport"] }],
			},
		],
		ignore: ["**/*.lock"],
	}),
	areas: [
		{
			name: "client.json",
			text: area("Client", { paths: ["src/**"], issues: [{ number: 8 }] }),
		},
		{
			name: "transport.json",
			text: area("Transports", {
				paths: ["src/transport/**"],
				issues: [{ number: 7, note: "Re-test after the rewrite." }],
			}),
		},
	],
});
if (!parsed.ok) throw new Error(parsed.problems.join("\n"));
const map = parsed.map;

function pull(
	number: number,
	state: PullInput["state"],
	date: string,
	files: [string, number][],
	title = `Change ${number}`,
): PullInput {
	return {
		number,
		title,
		state,
		author: number % 2 ? "nova" : "priya",
		authorAvatarUrl: null,
		bot: false,
		date,
		files: files.map(([path, additions]) => ({
			path,
			additions,
			deletions: 0,
		})),
		filesTruncated: false,
	};
}

const activity = buildMapActivity({
	map,
	tree: [
		{ path: "src/client.ts", size: 4000 },
		{ path: "src/client.test.ts", size: 1000 },
		{ path: "src/transport/ws.ts", size: 2500 },
		{ path: "pnpm.lock", size: 900_000 },
		{ path: "README.md", size: 300 },
	],
	pulls: [
		pull(3, "open", "2026-11-11T09:00:00Z", [["src/client.ts", 10]]),
		pull(1, "merged", "2026-10-06T09:00:00Z", [
			["src/transport/ws.ts", 30],
			["src/client.ts", 10],
		]),
		pull(
			2,
			"merged",
			"2026-11-10T09:00:00Z",
			[
				["src/transport/ws.ts", 5],
				["src/transport/polling.ts", 3],
			],
			"Fix reconnect",
		),
		pull(4, "merged", "2026-11-10T10:00:00Z", [["README.md", 40]]),
	],
	issues: [
		{
			number: 7,
			title: "Drops on sleep",
			author: "sam",
			date: "2026-11-01T00:00:00Z",
		},
	],
	now: new Date("2026-11-12T12:00:00Z"),
	limits: { treeTruncated: false, pullsTruncated: false },
});

describe("buildMapActivity", () => {
	it("sizes each area from the tree and counts what no rule covers", () => {
		expect(activity.areas.client).toMatchObject({
			files: 2,
			bytes: 5000,
			testFiles: 1,
		});
		expect(activity.areas.transport).toMatchObject({ files: 1, bytes: 2500 });
		expect(activity.totals).toMatchObject({
			files: 4,
			bytes: 7800,
			unmappedFiles: 1,
		});
	});

	it("gives a pull request to every area it has lines in, oldest first", () => {
		expect(activity.areas.transport.pulls).toEqual([1, 2]);
		expect(activity.areas.client.pulls).toEqual([1, 3]);
		expect(activity.pulls[1].parts).toEqual([
			{ area: "transport", lines: 30, share: 0.75 },
			{ area: "client", lines: 10, share: 0.25 },
		]);
		expect(activity.pulls[2].fix).toBe(true);
	});

	it("leaves out a pull request that only touched unmapped files", () => {
		expect(activity.pulls[4]).toBeUndefined();
		expect(activity.totals).toMatchObject({
			mergedPulls: 2,
			openPulls: 1,
			people: 2,
		});
	});

	it("counts merged work per week from the first merge to now", () => {
		expect(activity.weekStart).toBe("2026-10-05T00:00:00.000Z");
		expect(activity.areas.transport.weekly).toEqual([1, 0, 0, 0, 0, 1]);
		expect(activity.areas.transport).toMatchObject({
			mergedPulls: 2,
			mergedLast30: 1,
			lastMerged: "2026-11-10T09:00:00Z",
		});
		expect(activity.areas.client).toMatchObject({
			mergedPulls: 1,
			openPulls: 1,
		});
	});

	it("names the files most pull requests changed, skipping ones since deleted", () => {
		expect(activity.areas.transport.hotFiles).toEqual([
			{ path: "src/transport/ws.ts", pulls: 2 },
		]);
		expect(activity.areas.client.hotFiles).toEqual([
			{ path: "src/client.ts", pulls: 2 },
		]);
	});

	it("shows a hinted issue only while it is open", () => {
		expect(activity.areas.transport.openIssues).toEqual([7]);
		expect(activity.areas.client.openIssues).toEqual([]);
		expect(activity.issues[7].note).toBe("Re-test after the rewrite.");
	});
});
