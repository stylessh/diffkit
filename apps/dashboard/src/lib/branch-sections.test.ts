import { describe, expect, it } from "vitest";
import {
	classifyBranch,
	groupBranchesIntoSections,
	STALE_BRANCH_AFTER_MS,
	sortBranchesByRecency,
} from "./branch-sections";

const NOW = Date.parse("2026-11-07T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function branch(name: string, daysAgo: number | null) {
	return {
		name,
		commit:
			daysAgo == null
				? null
				: {
						sha: `${name}-sha`,
						date: new Date(NOW - daysAgo * DAY).toISOString(),
						author: null,
						authorName: null,
					},
	};
}

describe("classifyBranch", () => {
	const options = { defaultBranch: "main", now: NOW };

	it("flags the default branch regardless of age", () => {
		expect(classifyBranch(branch("main", 400), options)).toBe("default");
	});

	it("splits active and stale on the 3-month boundary", () => {
		expect(classifyBranch(branch("fresh", 1), options)).toBe("active");
		expect(classifyBranch(branch("edge", 90), options)).toBe("active");
		expect(classifyBranch(branch("old", 91), options)).toBe("stale");
		expect(STALE_BRANCH_AFTER_MS).toBe(90 * DAY);
	});

	it("treats branches without a commit date as stale", () => {
		expect(classifyBranch(branch("mystery", null), options)).toBe("stale");
	});

	it("honours a custom stale window", () => {
		expect(
			classifyBranch(branch("week-old", 7), {
				...options,
				staleAfterMs: 3 * DAY,
			}),
		).toBe("stale");
	});
});

describe("sortBranchesByRecency", () => {
	it("orders newest first with name tiebreaks and undated last", () => {
		const sorted = sortBranchesByRecency([
			branch("b", 5),
			branch("undated", null),
			branch("a", 5),
			branch("newest", 0),
		]);
		expect(sorted.map((b) => b.name)).toEqual(["newest", "a", "b", "undated"]);
	});
});

describe("groupBranchesIntoSections", () => {
	it("buckets branches and keeps each section sorted by recency", () => {
		const sections = groupBranchesIntoSections(
			[
				branch("old-1", 200),
				branch("main", 0),
				branch("feat-2", 10),
				branch("feat-1", 2),
				branch("old-2", 100),
			],
			{ defaultBranch: "main", now: NOW },
		);

		expect(sections.default?.name).toBe("main");
		expect(sections.active.map((b) => b.name)).toEqual(["feat-1", "feat-2"]);
		expect(sections.stale.map((b) => b.name)).toEqual(["old-2", "old-1"]);
	});

	it("prefers the explicit default tip and drops duplicates", () => {
		const tip = branch("main", 0);
		const sections = groupBranchesIntoSections(
			[branch("main", 30), branch("feat", 1), branch("feat", 1)],
			{ defaultBranch: "main", defaultTip: tip, now: NOW },
		);

		expect(sections.default).toBe(tip);
		expect(sections.active.map((b) => b.name)).toEqual(["feat"]);
	});

	it("leaves the default section empty when the default branch is unknown", () => {
		const sections = groupBranchesIntoSections([branch("feat", 1)], {
			defaultBranch: "main",
			now: NOW,
		});
		expect(sections.default).toBeNull();
	});
});
