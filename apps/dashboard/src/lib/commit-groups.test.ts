import { describe, expect, it } from "vitest";
import {
	filterCommitsByMessage,
	groupCommitsByDay,
	splitCommitMessage,
} from "./commit-groups";

const commit = (sha: string, date: string, message = sha) => ({
	sha,
	date,
	message,
});

describe("groupCommitsByDay", () => {
	it("groups consecutive commits by calendar day in the given zone", () => {
		const groups = groupCommitsByDay(
			[
				commit("a", "2026-11-04T18:00:00Z"),
				commit("b", "2026-11-04T09:00:00Z"),
				commit("c", "2026-11-03T23:30:00Z"),
			],
			{ timeZone: "UTC" },
		);

		expect(groups.map((g) => g.key)).toEqual(["2026-11-04", "2026-11-03"]);
		expect(groups[0].commits.map((c) => c.sha)).toEqual(["a", "b"]);
		expect(groups[0].label).toBe("Commits on Wed, Nov 4, 2026");
	});

	it("uses the viewer's zone so late-evening commits stay on their local day", () => {
		const groups = groupCommitsByDay(
			[
				commit("a", "2026-11-04T02:00:00Z"),
				commit("b", "2026-11-03T20:00:00Z"),
			],
			{ timeZone: "America/New_York" },
		);

		// 02:00Z on the 4th is 21:00 on the 3rd in New York.
		expect(groups).toHaveLength(1);
		expect(groups[0].key).toBe("2026-11-03");
	});

	it("merges out-of-order commits into their existing day", () => {
		const groups = groupCommitsByDay(
			[
				commit("a", "2026-11-04T10:00:00Z"),
				commit("b", "2026-11-03T10:00:00Z"),
				commit("c", "2026-11-04T08:00:00Z"),
			],
			{ timeZone: "UTC" },
		);

		expect(groups.map((g) => g.commits.map((c) => c.sha))).toEqual([
			["a", "c"],
			["b"],
		]);
	});

	it("keeps unparseable dates in a trailing bucket", () => {
		const groups = groupCommitsByDay(
			[commit("a", "nope"), commit("b", "2026-11-04T10:00:00Z")],
			{ timeZone: "UTC" },
		);

		expect(groups.map((g) => g.key)).toEqual(["2026-11-04", "unknown"]);
	});

	it("returns no groups for an empty page", () => {
		expect(groupCommitsByDay([])).toEqual([]);
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
