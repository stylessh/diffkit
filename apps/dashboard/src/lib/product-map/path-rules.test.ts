import { describe, expect, it } from "vitest";
import { compileGlob, createAreaMatcher, expandBraces } from "./path-rules";

describe("compileGlob", () => {
	it("keeps * inside a segment and lets ** cross them", () => {
		expect(compileGlob("src/*.ts").test("src/a.ts")).toBe(true);
		expect(compileGlob("src/*.ts").test("src/deep/a.ts")).toBe(false);
		expect(compileGlob("src/**").test("src/deep/a.ts")).toBe(true);
		expect(compileGlob("src/lib/github**").test("src/lib/github.ts")).toBe(
			true,
		);
		expect(
			compileGlob("src/lib/github**").test("src/lib/github/pulls.ts"),
		).toBe(true);
	});

	it("matches **/ against zero or more leading folders", () => {
		const pattern = compileGlob("**/package.json");
		expect(pattern.test("package.json")).toBe(true);
		expect(pattern.test("apps/dashboard/package.json")).toBe(true);
		expect(pattern.test("apps/not-package.json")).toBe(false);
	});

	it("expands nested alternatives, including an empty one", () => {
		const pattern = compileGlob("{turbo.json,biome.json{,c}}");
		expect(pattern.test("turbo.json")).toBe(true);
		expect(pattern.test("biome.jsonc")).toBe(true);
		expect(pattern.test("biome.jsonx")).toBe(false);
	});

	it("treats regex characters and escaped glob characters as text", () => {
		expect(
			compileGlob("routes/$owner/(a).tsx").test("routes/$owner/(a).tsx"),
		).toBe(true);
		expect(compileGlob("a.b").test("axb")).toBe(false);
		expect(compileGlob("app/\\{drizzle**").test("app/{drizzle}/x")).toBe(true);
	});

	it("rejects patterns that are malformed or too greedy", () => {
		expect(() => compileGlob("src/{a,b")).toThrow("unmatched {");
		expect(() => compileGlob("a}")).toThrow("unmatched }");
		expect(() => compileGlob("*/*/*/*/*/*/*/*/*")).toThrow("wildcards");
		expect(() => compileGlob("")).toThrow();
	});
});

describe("expandBraces", () => {
	it("lists the plain patterns a braced one stands for", () => {
		expect(expandBraces("a/{b,c{,d}}/x")).toEqual(["a/b/x", "a/c/x", "a/cd/x"]);
		expect(expandBraces("src/\\{literal\\}")).toEqual(["src/\\{literal\\}"]);
	});

	it("refuses a pattern that multiplies out too far", () => {
		const wide = "{a,b,c,d}{a,b,c,d}{a,b,c,d}{a,b}";
		expect(() => expandBraces(wide)).toThrow("alternatives");
	});
});

describe("createAreaMatcher", () => {
	const rules = [
		{ path: "src/lib/github/**", area: "github-data" },
		{ path: "src/lib/{github/pull,review-}**", area: "pull-request" },
		{ path: "src/**", area: "shell" },
	];
	const match = createAreaMatcher(rules, ["**/*.gen.ts"]);

	it("gives a path to the most specific pattern, whatever the order", () => {
		const reversed = createAreaMatcher([...rules].reverse(), []);
		for (const pick of [match, reversed]) {
			expect(pick("src/lib/github/pull-files.ts")).toEqual({
				kind: "area",
				area: "pull-request",
			});
			expect(pick("src/lib/github/client.ts")).toEqual({
				kind: "area",
				area: "github-data",
			});
			expect(pick("src/app.tsx")).toEqual({ kind: "area", area: "shell" });
		}
	});

	it("separates ignored paths from ones no pattern covers", () => {
		expect(match("src/lib/github/routes.gen.ts")).toEqual({ kind: "ignored" });
		expect(match("README.md")).toEqual({ kind: "unmapped" });
	});
});
