import { describe, expect, it } from "vitest";
import {
	filterCommitsByMessage,
	groupCommitsByPeriod,
	splitCommitMessage,
} from "./commit-groups";

const commit = (sha: string, date: string, message = sha) => ({
	sha,
	date,
	message,
});

// Monday, 9 Nov 2026, noon UTC.
const NOW = Date.parse("2026-11-09T12:00:00Z");
const group = (commits: ReturnType<typeof commit>[], timeZone = "UTC") =>
	groupCommitsByPeriod(commits, { timeZone, now: NOW });

describe("groupCommitsByPeriod", () => {
	it("buckets recent commits by period and older ones by month", () => {
		const groups = group([
			commit("today", "2026-11-09T08:00:00Z"),
			commit("yesterday", "2026-11-08T08:00:00Z"),
			commit("last-week", "2026-11-03T08:00:00Z"),
			commit("october-a", "2026-10-27T08:00:00Z"),
			commit("october-b", "2026-10-02T08:00:00Z"),
			commit("september", "2026-09-30T08:00:00Z"),
		]);

		expect(groups.map((g) => [g.title, g.commits.map((c) => c.sha)])).toEqual([
			["Today", ["today"]],
			["Yesterday", ["yesterday"]],
			["Last week", ["last-week"]],
			["October 2026", ["october-a", "october-b"]],
			["September 2026", ["september"]],
		]);
		expect(groups[3].label).toBe("Commits in October 2026");
	});

	it("starts the week on Monday", () => {
		const thursday = Date.parse("2026-11-12T12:00:00Z");
		const groups = groupCommitsByPeriod(
			[
				commit("tuesday", "2026-11-10T08:00:00Z"),
				commit("monday", "2026-11-09T08:00:00Z"),
				commit("sunday", "2026-11-08T08:00:00Z"),
			],
			{ timeZone: "UTC", now: thursday },
		);

		expect(groups.map((g) => [g.title, g.commits.length])).toEqual([
			["This week", 2],
			["Last week", 1],
		]);
	});

	it("uses the viewer's zone so late-evening commits stay on their local day", () => {
		// 02:00Z on the 9th is 21:00 on the 8th in New York.
		const groups = group(
			[commit("a", "2026-11-09T02:00:00Z")],
			"America/New_York",
		);

		expect(groups[0].title).toBe("Yesterday");
	});

	it("merges out-of-order commits into their existing period", () => {
		const groups = group([
			commit("a", "2026-10-20T10:00:00Z"),
			commit("b", "2026-09-03T10:00:00Z"),
			commit("c", "2026-10-04T08:00:00Z"),
		]);

		expect(groups.map((g) => g.commits.map((c) => c.sha))).toEqual([
			["a", "c"],
			["b"],
		]);
	});

	it("keeps unparseable dates in a trailing group", () => {
		const groups = group([
			commit("a", "nope"),
			commit("b", "2026-11-09T10:00:00Z"),
		]);

		expect(groups.map((g) => g.key)).toEqual(["today", "unknown"]);
	});

	it("returns no groups for an empty page", () => {
		expect(groupCommitsByPeriod([])).toEqual([]);
	});
});

describe("splitCommitMessage", () => {
	it("separates subject and body", () => {
		expect(splitCommitMessage("Fix bug\n\nLonger explanation\n")).toEqual({
			subject: "Fix bug",
			body: "Longer explanation",
		});
		expect(splitCommitMessage("Only subject")).toEqual({
			subject: "Only subject",
			body: "",
		});
	});
});

describe("filterCommitsByMessage", () => {
	it("matches case-insensitively and ignores blank queries", () => {
		const commits = [commit("a", "", "Add Feature"), commit("b", "", "fix")];
		expect(filterCommitsByMessage(commits, "feat").map((c) => c.sha)).toEqual([
			"a",
		]);
		expect(filterCommitsByMessage(commits, "  ")).toHaveLength(2);
	});
});
