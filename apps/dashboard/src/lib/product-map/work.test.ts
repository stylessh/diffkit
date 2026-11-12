import { describe, expect, it } from "vitest";
import { createAreaMatcher } from "./path-rules";
import { isFixTitle, pullParts, weeklyCounts, weekStartOf } from "./work";

const match = createAreaMatcher(
	[
		{ path: "src/review/**", area: "review" },
		{ path: "src/**", area: "shell" },
	],
	["**/*.lock"],
);

describe("pullParts", () => {
	it("splits changed lines across areas, largest first", () => {
		const parts = pullParts(
			[
				{ path: "src/review/diff.ts", additions: 60, deletions: 15 },
				{ path: "src/app.tsx", additions: 20, deletions: 5 },
			],
			match,
		);
		expect(parts).toEqual([
			{ area: "review", lines: 75, share: 0.75 },
			{ area: "shell", lines: 25, share: 0.25 },
		]);
	});

	it("leaves ignored and unmapped files out of the total", () => {
		const parts = pullParts(
			[
				{ path: "pnpm.lock", additions: 4000, deletions: 3000 },
				{ path: "README.md", additions: 50, deletions: 0 },
				{ path: "src/app.tsx", additions: 10, deletions: 0 },
			],
			match,
		);
		expect(parts).toEqual([{ area: "shell", lines: 10, share: 1 }]);
	});

	it("returns nothing for a change with no countable lines", () => {
		expect(
			pullParts([{ path: "src/logo.png", additions: 0, deletions: 0 }], match),
		).toEqual([]);
	});
});

describe("isFixTitle", () => {
	it("reads fixes and reverts from the title", () => {
		expect(isFixTitle("Fix the e2e specs that turned every PR red")).toBe(true);
		expect(isFixTitle("Revert streamed diff")).toBe(true);
		expect(isFixTitle("Add bulk actions")).toBe(false);
	});

	it("lets a feat prefix win unless the title also says fix", () => {
		expect(isFixTitle("feat: handle empty states")).toBe(false);
		expect(isFixTitle("feat: sidebar, and fix its scroll")).toBe(true);
	});
});

describe("weeklyCounts", () => {
	it("buckets dates into Monday-based weeks and drops the rest", () => {
		const firstWeek = weekStartOf(new Date("2026-11-04T10:00:00Z"));
		expect(new Date(firstWeek).toISOString()).toBe("2026-11-02T00:00:00.000Z");
		expect(
			weeklyCounts(
				[
					"2026-11-02T00:00:00Z",
					"2026-11-08T23:59:59Z",
					"2026-11-09T00:00:00Z",
					"2026-10-30T12:00:00Z",
					"2026-11-20T12:00:00Z",
				],
				firstWeek,
				2,
			),
		).toEqual([2, 1]);
	});
});
