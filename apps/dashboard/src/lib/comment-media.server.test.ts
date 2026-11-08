import { describe, expect, it, vi } from "vitest";
import {
	buildCommentMediaHtml,
	buildCommentMediaObjectKey,
	clampDisplayDimensions,
	classifyCommentMedia,
	detectCommentMediaFromBytes,
	maxBytesForCommentMediaKind,
	publicUrlForR2Key,
	sanitizeCommentMediaFilename,
	verifyCommentMediaKeyForUser,
	verifyCommentMediaObject,
} from "./comment-media.server";

const bytes = (...values: number[]) => new Uint8Array(values);

describe("detectCommentMediaFromBytes", () => {
	it("identifies files by signature, not by claimed type", () => {
		expect(
			detectCommentMediaFromBytes(
				bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
			),
		).toEqual({ kind: "image", contentType: "image/png" });
		expect(detectCommentMediaFromBytes(bytes(0xff, 0xd8, 0xff, 0xe0))).toEqual({
			kind: "image",
			contentType: "image/jpeg",
		});
		expect(
			detectCommentMediaFromBytes(new TextEncoder().encode("GIF89a....")),
		).toEqual({ kind: "image", contentType: "image/gif" });
		expect(
			detectCommentMediaFromBytes(
				new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "),
			),
		).toEqual({ kind: "image", contentType: "image/webp" });
		expect(detectCommentMediaFromBytes(bytes(0x1a, 0x45, 0xdf, 0xa3))).toEqual({
			kind: "video",
			contentType: "video/webm",
		});
		expect(
			detectCommentMediaFromBytes(
				new Uint8Array([
					0,
					0,
					0,
					0x18,
					...new TextEncoder().encode("ftypmp42"),
				]),
			)?.kind,
		).toBe("video");
	});

	it("rejects scripts, SVG and truncated headers", () => {
		const encoder = new TextEncoder();
		for (const sample of [
			encoder.encode("<svg xmlns='http://www.w3.org/2000/svg'><script/></svg>"),
			encoder.encode("<!doctype html><script>alert(1)</script>"),
			encoder.encode("#!/bin/sh\n"),
			bytes(0x89, 0x50, 0x4e),
			bytes(),
		]) {
			expect(detectCommentMediaFromBytes(sample)).toBeNull();
		}
	});
});

describe("classifyCommentMedia", () => {
	it("ignores parameters and case", () => {
		expect(classifyCommentMedia("Image/PNG; charset=binary")).toBe("image");
		expect(classifyCommentMedia("video/webm")).toBe("video");
		expect(classifyCommentMedia("image/svg+xml")).toBeNull();
		expect(classifyCommentMedia("")).toBeNull();
	});
});

describe("sanitizeCommentMediaFilename and keys", () => {
	it("strips path separators and unusual characters", () => {
		expect(sanitizeCommentMediaFilename("../../etc/passwd")).not.toContain("/");
		expect(sanitizeCommentMediaFilename("a\\b<script>.png")).toBe(
			"a_b_script_.png",
		);
		expect(sanitizeCommentMediaFilename("")).toBe("upload");
		expect(sanitizeCommentMediaFilename("x".repeat(500))).toHaveLength(120);
	});

	it("builds user-scoped keys that verify only for that user", () => {
		vi.spyOn(Date, "now").mockReturnValue(1_800_000_000_000);
		const key = buildCommentMediaObjectKey("user-1", "../shot.png");
		expect(key).toMatch(
			/^comment-media\/user-1\/1800000000000-[0-9a-f-]{36}-\.\._shot\.png$/,
		);
		expect(verifyCommentMediaKeyForUser(key, "user-1")).toBe(true);
		expect(verifyCommentMediaKeyForUser(key, "user-2")).toBe(false);
		expect(verifyCommentMediaKeyForUser(key, "user-")).toBe(false);
		vi.restoreAllMocks();
	});

	it("rejects keys that try to reach into other prefixes", () => {
		expect(
			verifyCommentMediaKeyForUser("comment-media/user-1/a/b.png", "user-1"),
		).toBe(false);
		expect(
			verifyCommentMediaKeyForUser("comment-media/user-1/", "user-1"),
		).toBe(true);
		expect(verifyCommentMediaKeyForUser("other/user-1/a.png", "user-1")).toBe(
			false,
		);
	});
});

describe("URLs and HTML", () => {
	it("encodes each key segment", () => {
		expect(
			publicUrlForR2Key("https://cdn.test/", "comment-media/u/1-a b#c.png"),
		).toBe("https://cdn.test/comment-media/u/1-a%20b%23c.png");
	});

	it("escapes attribute values in generated markup", () => {
		const html = buildCommentMediaHtml({
			kind: "image",
			src: 'https://x.test/a.png" onerror="alert(1)',
			alt: '<b>"hi"&</b>',
			width: 10,
			height: 20,
		});
		expect(html).not.toContain('" onerror="');
		expect(html).toContain("&quot; onerror=&quot;");
		expect(html).toContain('alt="&lt;b&gt;&quot;hi&quot;&amp;&lt;/b&gt;"');
		expect(
			buildCommentMediaHtml({
				kind: "video",
				src: "u",
				alt: "a",
				width: 1,
				height: 2,
			}),
		).toBe(
			'<video src="u" width="1" height="2" controls preload="metadata" title="a"></video>',
		);
	});

	it("clamps display dimensions", () => {
		expect(clampDisplayDimensions(2400, 1200)).toEqual({
			width: 1200,
			height: 600,
		});
		expect(clampDisplayDimensions(300, 200)).toEqual({
			width: 300,
			height: 200,
		});
		expect(clampDisplayDimensions(0, 5)).toEqual({ width: 1, height: 1 });
		expect(clampDisplayDimensions(Number.NaN, 5)).toEqual({
			width: 1,
			height: 1,
		});
	});

	it("caps images below videos", () => {
		expect(maxBytesForCommentMediaKind("image")).toBeLessThan(
			maxBytesForCommentMediaKind("video"),
		);
	});
});

describe("verifyCommentMediaObject", () => {
	const bucket = (head: () => Promise<unknown>) =>
		({ head }) as unknown as R2Bucket;

	it("reports missing, empty and failing objects without throwing", async () => {
		expect(
			await verifyCommentMediaObject(
				bucket(async () => null),
				"k",
			),
		).toEqual({
			ok: false,
			reason: "Object not found",
		});
		expect(
			await verifyCommentMediaObject(
				bucket(async () => ({ size: 0 })),
				"k",
			),
		).toEqual({
			ok: false,
			reason: "Object is empty",
		});
		expect(
			await verifyCommentMediaObject(
				bucket(async () => {
					throw new Error("R2 unavailable");
				}),
				"k",
			),
		).toEqual({ ok: false, reason: "Failed to verify object" });
		expect(
			await verifyCommentMediaObject(
				bucket(async () => ({
					size: 5,
					httpMetadata: { contentType: "image/png" },
				})),
				"k",
			),
		).toEqual({ ok: true, size: 5, contentType: "image/png" });
	});
});
