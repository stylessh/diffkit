import { describe, expect, it, vi } from "vitest";
import {
	buildCommentMediaHtml,
	buildCommentMediaObjectKey,
	detectCommentMediaFromBytes,
	verifyCommentMediaKeyForUser,
} from "./comment-media.server";

const encode = (text: string) => new TextEncoder().encode(text);

describe("detectCommentMediaFromBytes", () => {
	it("identifies files by signature, whatever the client claimed", () => {
		const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
		expect(detectCommentMediaFromBytes(new Uint8Array(png))?.contentType).toBe(
			"image/png",
		);
		expect(
			detectCommentMediaFromBytes(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))
				?.contentType,
		).toBe("image/jpeg");
		expect(detectCommentMediaFromBytes(encode("GIF89a...."))?.contentType).toBe(
			"image/gif",
		);
		expect(
			detectCommentMediaFromBytes(
				new Uint8Array([0, 0, 0, 0x18, ...encode("ftypmp42")]),
			)?.contentType,
		).toBe("video/mp4");
	});

	it("rejects SVG, HTML, scripts and truncated headers", () => {
		for (const sample of [
			encode("<svg xmlns='http://www.w3.org/2000/svg'><script/></svg>"),
			encode("<!doctype html><script>alert(1)</script>"),
			encode("#!/bin/sh\n"),
			new Uint8Array([0x89, 0x50, 0x4e]),
			new Uint8Array(),
		]) {
			expect(detectCommentMediaFromBytes(sample)).toBeNull();
		}
	});
});

describe("comment media object keys", () => {
	it("scopes keys to the uploading user and strips path separators from names", () => {
		vi.spyOn(Date, "now").mockReturnValue(1_800_000_000_000);
		const key = buildCommentMediaObjectKey("user-1", "../../etc/passwd");
		vi.restoreAllMocks();

		expect(key.startsWith("comment-media/user-1/")).toBe(true);
		expect(key.slice("comment-media/user-1/".length)).not.toContain("/");
		expect(verifyCommentMediaKeyForUser(key, "user-1")).toBe(true);
		expect(verifyCommentMediaKeyForUser(key, "user-2")).toBe(false);
	});

	it("rejects keys that reach into other prefixes or nested paths", () => {
		expect(
			verifyCommentMediaKeyForUser("comment-media/user-1/a/b.png", "user-1"),
		).toBe(false);
		expect(verifyCommentMediaKeyForUser("other/user-1/a.png", "user-1")).toBe(
			false,
		);
	});
});

describe("buildCommentMediaHtml", () => {
	it("escapes attribute values so a URL or alt text cannot inject markup", () => {
		const html = buildCommentMediaHtml({
			kind: "image",
			src: 'https://x.test/a.png" onerror="alert(1)',
			alt: '<b>"hi"&</b>',
			width: 10,
			height: 20,
		});
		expect(html).not.toContain('" onerror="');
		expect(html).toContain('alt="&lt;b&gt;&quot;hi&quot;&amp;&lt;/b&gt;"');
	});
});
