import { describe, expect, it } from "vitest";
import {
	buildCommitsSplat,
	encodeRefPath,
	MAX_REF_SEGMENTS,
	refPrefixCandidates,
	splitCommitsSplat,
} from "./commits-route";

describe("refPrefixCandidates", () => {
	it("lists every prefix shortest first", () => {
		expect(refPrefixCandidates("/feature/login/src/")).toEqual([
			"feature",
			"feature/login",
			"feature/login/src",
		]);
		expect(refPrefixCandidates("")).toEqual([]);
	});

	it("caps the number of candidates", () => {
		const deep = Array.from({ length: 20 }, (_, i) => `s${i}`).join("/");
		expect(refPrefixCandidates(deep)).toHaveLength(MAX_REF_SEGMENTS);
	});
});

describe("splitCommitsSplat", () => {
	it("returns no ref for an empty splat", () => {
		expect(splitCommitsSplat(undefined)).toEqual({ ref: null, path: "" });
	});

	it("splits on the matched ref so slashed branches and tags survive", () => {
		expect(
			splitCommitsSplat("feature/login/src/app.ts", "feature/login"),
		).toEqual({ ref: "feature/login", path: "src/app.ts" });
		expect(splitCommitsSplat("@scope/pkg@1.0.0", "@scope/pkg@1.0.0")).toEqual({
			ref: "@scope/pkg@1.0.0",
			path: "",
		});
	});

	it("ignores a match that isn't a segment prefix", () => {
		expect(splitCommitsSplat("feature-x/docs", "feature")).toEqual({
			ref: "feature-x",
			path: "docs",
		});
	});

	it("falls back to the first segment as the ref", () => {
		expect(splitCommitsSplat("v1.2.0/docs", null)).toEqual({
			ref: "v1.2.0",
			path: "docs",
		});
	});

	it("round-trips with buildCommitsSplat", () => {
		const splat = buildCommitsSplat("release/2026", "/src/lib/");
		expect(splat).toBe("release/2026/src/lib");
		expect(splitCommitsSplat(splat, "release/2026")).toEqual({
			ref: "release/2026",
			path: "src/lib",
		});
		expect(buildCommitsSplat("main")).toBe("main");
	});
});

describe("encodeRefPath", () => {
	it("encodes segments but keeps slashes", () => {
		expect(encodeRefPath("@scope/pkg@1.0.0")).toBe("%40scope/pkg%401.0.0");
		expect(encodeRefPath("v1.0 rc")).toBe("v1.0%20rc");
	});
});
