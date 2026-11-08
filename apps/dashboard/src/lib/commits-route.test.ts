import { describe, expect, it } from "vitest";
import { buildCommitsSplat, parseCommitsSplat } from "./commits-route";

describe("parseCommitsSplat", () => {
	it("returns no ref for an empty splat", () => {
		expect(parseCommitsSplat(undefined)).toEqual({ ref: null, path: "" });
		expect(parseCommitsSplat("/")).toEqual({ ref: null, path: "" });
	});

	it("matches the longest known ref so slashed branch names survive", () => {
		expect(
			parseCommitsSplat("feature/login/src/app.ts", {
				refNames: ["feature", "feature/login"],
			}),
		).toEqual({ ref: "feature/login", path: "src/app.ts" });
	});

	it("falls back to the first segment as the ref", () => {
		expect(parseCommitsSplat("v1.2.0/docs")).toEqual({
			ref: "v1.2.0",
			path: "docs",
		});
	});

	it("round-trips with buildCommitsSplat", () => {
		const splat = buildCommitsSplat("main", "/src/lib/");
		expect(splat).toBe("main/src/lib");
		expect(parseCommitsSplat(splat, { defaultBranch: "main" })).toEqual({
			ref: "main",
			path: "src/lib",
		});
		expect(buildCommitsSplat("main")).toBe("main");
	});
});
