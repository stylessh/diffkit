import { describe, expect, it } from "vitest";
import {
	DEFAULT_REPO_TABS,
	parseRepoTabs,
	withTabToggled,
} from "./repo-nav-tabs";

describe("repo tab preferences", () => {
	it("falls back to the defaults for nothing saved or anything unreadable", () => {
		expect(parseRepoTabs(null)).toEqual(DEFAULT_REPO_TABS);
		expect(parseRepoTabs("not json")).toEqual(DEFAULT_REPO_TABS);
		expect(parseRepoTabs('{"code":true}')).toEqual(DEFAULT_REPO_TABS);
	});

	it("keeps known tabs in nav order, always with Code", () => {
		expect(parseRepoTabs('["releases","bogus","commits"]')).toEqual([
			"code",
			"commits",
			"releases",
		]);
	});

	it("toggles a tab in place but never removes Code", () => {
		const withCommits = withTabToggled(DEFAULT_REPO_TABS, "commits");
		expect(withCommits).toEqual([
			"code",
			"commits",
			"pulls",
			"issues",
			"actions",
			"settings",
		]);
		expect(withTabToggled(withCommits, "commits")).toEqual(DEFAULT_REPO_TABS);
		expect(withTabToggled(DEFAULT_REPO_TABS, "code")).toBe(DEFAULT_REPO_TABS);
	});
});
