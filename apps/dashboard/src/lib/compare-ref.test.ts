import { describe, expect, it } from "vitest";
import {
	formatCompareSplat,
	isForkRef,
	isQualifiedRef,
	parseCompareSplat,
	pullHeadFilter,
	resolveCompareRefs,
	splitCompareRef,
} from "./compare-ref";

describe("parseCompareSplat", () => {
	it("splits base and head on the three-dot range", () => {
		expect(parseCompareSplat("main...feature")).toEqual({
			base: "main",
			head: "feature",
		});
	});

	it("keeps slashes in branch names and the fork owner prefix on the head", () => {
		expect(
			parseCompareSplat("release/1.x...octocat:feat/jitter-backoff"),
		).toEqual({ base: "release/1.x", head: "octocat:feat/jitter-backoff" });
	});

	it("treats a lone ref as the head, compared against the default branch", () => {
		expect(parseCompareSplat("feature")).toEqual({
			base: null,
			head: "feature",
		});
	});

	it("leaves a missing side null rather than rejecting the URL", () => {
		expect(parseCompareSplat("")).toEqual({ base: null, head: null });
		expect(parseCompareSplat("main...")).toEqual({ base: "main", head: null });
		expect(parseCompareSplat("...feature")).toEqual({
			base: null,
			head: "feature",
		});
	});

	it("round-trips through formatCompareSplat", () => {
		const splat = formatCompareSplat("main", "fork:feat/x");
		expect(parseCompareSplat(splat)).toEqual({
			base: "main",
			head: "fork:feat/x",
		});
	});
});

describe("resolveCompareRefs", () => {
	it("falls back to the default branch for the base only", () => {
		expect(
			resolveCompareRefs({ base: null, head: "feature" }, "trunk"),
		).toEqual({
			base: "trunk",
			head: "feature",
		});
		expect(resolveCompareRefs({ base: "main", head: null }, "trunk")).toEqual({
			base: "main",
			head: null,
		});
	});
});

describe("fork refs", () => {
	it("splits the owner from the branch", () => {
		expect(splitCompareRef("octocat:feature")).toEqual({
			owner: "octocat",
			branch: "feature",
		});
		expect(splitCompareRef("feature")).toEqual({
			owner: null,
			branch: "feature",
		});
	});

	it("is a fork only when the owner differs from the repository owner, ignoring case", () => {
		expect(isForkRef("octocat:feature", "acme")).toBe(true);
		expect(isForkRef("Acme:feature", "acme")).toBe(false);
		expect(isForkRef("feature", "acme")).toBe(false);
	});

	it("accepts typed input only when both owner and branch are present", () => {
		expect(isQualifiedRef("octocat:feature")).toBe(true);
		expect(isQualifiedRef("octocat:")).toBe(false);
		expect(isQualifiedRef(":feature")).toBe(false);
		expect(isQualifiedRef("feature")).toBe(false);
	});
});

describe("pullHeadFilter", () => {
	it("qualifies a plain or own-owner head and keeps a fork owner", () => {
		expect(pullHeadFilter("feat/x", "acme")).toBe("acme:feat/x");
		expect(pullHeadFilter("acme:feat/x", "acme")).toBe("acme:feat/x");
		expect(pullHeadFilter("octocat:feat/x", "acme")).toBe("octocat:feat/x");
	});
});
