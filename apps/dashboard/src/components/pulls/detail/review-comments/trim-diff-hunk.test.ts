import { describe, expect, it } from "vitest";
import { trimDiffHunk } from "./trim-diff-hunk";

const hunk = [
	"@@ -10,7 +10,8 @@ function connect() {",
	" const a = 1;",
	" const b = 2;",
	"-const c = 3;",
	"+const c = 4;",
	"+const d = 5;",
	" const e = 6;",
	" const f = 7;",
	" const g = 8;",
	" const h = 9;",
].join("\n");

describe("trimDiffHunk", () => {
	it("keeps three lines of context above a single commented line and renumbers the header", () => {
		expect(trimDiffHunk(hunk, 17, null, "RIGHT")).toBe(
			[
				"@@ -13,4 +14,4 @@ function connect() {",
				" const e = 6;",
				" const f = 7;",
				" const g = 8;",
				" const h = 9;",
			].join("\n"),
		);
	});

	it("starts from the first line of a multi-line comment, counted on the commented side", () => {
		expect(trimDiffHunk(hunk, 16, 15, "LEFT")).toBe(
			[
				"@@ -13,4 +13,5 @@ function connect() {",
				"+const d = 5;",
				" const e = 6;",
				" const f = 7;",
				" const g = 8;",
				" const h = 9;",
			].join("\n"),
		);
	});

	it("leaves a hunk alone when the comment sits near its top or it has no line", () => {
		expect(trimDiffHunk(hunk, 12, null, "RIGHT")).toBe(hunk);
		expect(trimDiffHunk(hunk, null, null, "RIGHT")).toBe(hunk);
	});
});
