import { describe, expect, it } from "vitest";
import { classifyContentsFile } from "./blob-classify";
import { resolveCodeLocation } from "./code-location";
import { parseLineHash, selectLine } from "./line-range";
import {
	mapBlameResponse,
	mapCodeSearchItem,
	splitHighlights,
} from "./mappers";
import { buildTreeIndex } from "./tree-index";

const base64 = (value: string | Uint8Array) =>
	Buffer.from(value).toString("base64");

describe("resolveCodeLocation", () => {
	const refs = { defaultBranch: "main", known: ["feature/login", "v1.0"] };

	it("splits on the longest known ref, including refs with slashes", () => {
		expect(resolveCodeLocation("feature/login/src/app.ts", refs)).toEqual({
			status: "resolved",
			location: { ref: "feature/login", path: "src/app.ts" },
		});
		expect(resolveCodeLocation("main", refs)).toEqual({
			status: "resolved",
			location: { ref: "main", path: "" },
		});
	});

	it("opens the default branch for an empty splat", () => {
		expect(resolveCodeLocation("", refs)).toEqual({
			status: "resolved",
			location: { ref: "main", path: "" },
		});
	});

	it("trusts a leading commit SHA but asks the server about unknown slashed refs", () => {
		expect(resolveCodeLocation("3fdc17c/src/index.ts", refs)).toEqual({
			status: "resolved",
			location: { ref: "3fdc17c", path: "src/index.ts" },
		});
		expect(resolveCodeLocation("release/2.0/src/index.ts", refs)).toEqual({
			status: "needsServer",
		});
	});
});

describe("line ranges", () => {
	it("parses #L hashes, ordering and clamping them to the file", () => {
		expect(parseLineHash("#L20-L10")).toEqual({ start: 10, end: 20 });
		expect(parseLineHash("#L3-L90", 12)).toEqual({ start: 3, end: 12 });
		expect(parseLineHash("#L0")).toBeNull();
		expect(parseLineHash("#readme")).toBeNull();
	});

	it("selects, toggles off and shift-extends from the anchor", () => {
		const one = selectLine(null, 5, false);
		expect(one).toEqual({ start: 5, end: 5 });
		expect(selectLine(one, 5, false)).toBeNull();
		expect(selectLine(one, 9, true)).toEqual({ start: 5, end: 9 });
		expect(selectLine(one, 2, true)).toEqual({ start: 2, end: 5 });
	});
});

describe("classifyContentsFile", () => {
	const file = { path: "src/a.ts", sha: "s", size: 10 };

	it("decodes UTF-8 text", () => {
		expect(
			classifyContentsFile({
				...file,
				encoding: "base64",
				content: base64("const café = 1;\n"),
			}),
		).toMatchObject({ kind: "text", text: "const café = 1;\n" });
	});

	it("flags NUL bytes and invalid UTF-8 as binary", () => {
		for (const bytes of [
			new Uint8Array([0x50, 0x4b, 0x00, 0x01]),
			new Uint8Array([0xff, 0xfe, 0xfd]),
		]) {
			expect(
				classifyContentsFile({
					...file,
					encoding: "base64",
					content: base64(bytes),
				}).kind,
			).toBe("binary");
		}
	});

	it("keeps raster images as images and reports files the API didn't inline", () => {
		expect(
			classifyContentsFile({
				...file,
				path: "logo.PNG",
				encoding: "base64",
				content: base64(new Uint8Array([0x89, 0x50])),
			}),
		).toMatchObject({ kind: "image", mimeType: "image/png" });
		expect(
			classifyContentsFile({
				...file,
				size: 5_000_000,
				encoding: "none",
				content: "",
			}),
		).toEqual({ kind: "tooLarge", sha: "s", size: 5_000_000 });
	});
});

describe("buildTreeIndex", () => {
	it("groups children per directory, folders first, even when parents are missing", () => {
		const index = buildTreeIndex({
			sha: "t",
			truncated: true,
			entries: [
				{ path: "src", type: "dir", sha: "1", size: null },
				{ path: "src/b.ts", type: "file", sha: "2", size: 4 },
				{ path: "src/lib", type: "dir", sha: "3", size: null },
				{ path: "README.md", type: "file", sha: "4", size: 9 },
				{ path: "docs/guide/intro.md", type: "file", sha: "5", size: 1 },
			],
		});
		expect(index.children.get("")?.map((entry) => entry.name)).toEqual([
			"src",
			"README.md",
		]);
		expect(index.children.get("src")?.map((entry) => entry.name)).toEqual([
			"lib",
			"b.ts",
		]);
		expect(index.children.get("src/lib")).toEqual([]);
		expect(index.children.get("docs/guide")?.[0]?.path).toBe(
			"docs/guide/intro.md",
		);
		expect(index.truncated).toBe(true);
	});
});

describe("GitHub response mappers", () => {
	it("maps blame ranges in line order and shares commit details", () => {
		const commit = (oid: string, parent: string | null) => ({
			oid,
			abbreviatedOid: oid.slice(0, 7),
			messageHeadline: `commit ${oid}`,
			committedDate: "2026-01-01T00:00:00Z",
			author: { name: "Nova", avatarUrl: null, user: null },
			parents: { nodes: parent ? [{ oid: parent }] : [] },
		});
		const blame = mapBlameResponse({
			repository: {
				object: {
					blame: {
						ranges: [
							{
								startingLine: 4,
								endingLine: 9,
								age: 1,
								commit: commit("bbb", "aaa"),
							},
							{
								startingLine: 1,
								endingLine: 3,
								age: 10,
								commit: commit("aaa", null),
							},
							{
								startingLine: 10,
								endingLine: 10,
								age: 10,
								commit: commit("aaa", null),
							},
						],
					},
				},
			},
		});
		expect(
			blame.status === "ok" && blame.ranges.map((range) => range.start),
		).toEqual([1, 4, 10]);
		expect(blame.status === "ok" && Object.keys(blame.commits)).toEqual([
			"bbb",
			"aaa",
		]);
		expect(blame.status === "ok" && blame.commits.bbb?.parentOid).toBe("aaa");
		expect(mapBlameResponse({ repository: { object: null } })).toEqual({
			status: "missing",
		});
	});

	it("keeps content fragments and highlights their matches", () => {
		const hit = mapCodeSearchItem({
			path: "src/client.ts",
			sha: "x",
			text_matches: [
				{ property: "path", fragment: "src/client.ts", matches: [] },
				{
					property: "content",
					fragment: "let reconnectTimer = reconnect();",
					matches: [{ indices: [4, 13] }, { indices: [21, 30] }],
				},
			],
		});
		expect(hit.fragments).toHaveLength(1);
		const fragment = hit.fragments[0];
		expect(
			fragment && splitHighlights(fragment.text, fragment.highlights),
		).toEqual([
			{ text: "let ", highlighted: false },
			{ text: "reconnect", highlighted: true },
			{ text: "Timer = ", highlighted: false },
			{ text: "reconnect", highlighted: true },
			{ text: "();", highlighted: false },
		]);
	});
});
