import { describe, expect, it } from "vitest";
import {
	findCommentMediaUploadPlaceholderRange,
	getCommentMediaUploadPlaceholderText,
	getCommentMediaUploadToken,
	replaceCommentMediaUploadPlaceholder,
} from "./markdown-editor-upload";

describe("comment media upload placeholders", () => {
	it("builds a unique token and visible uploading line", () => {
		const id = "8809c50e-6305-4947-8434-60b8eb52978f";
		expect(getCommentMediaUploadToken(id)).toBe(`[[DIFFKIT_UPLOAD:${id}]]`);
		expect(getCommentMediaUploadPlaceholderText(id)).toBe(
			`⏳ Uploading asset… [[DIFFKIT_UPLOAD:${id}]]`,
		);
		expect(getCommentMediaUploadPlaceholderText(id, "a.png")).toBe(
			`⏳ Uploading “a.png”… [[DIFFKIT_UPLOAD:${id}]]`,
		);
	});

	it("replaces sibling placeholders independently", () => {
		const first = getCommentMediaUploadPlaceholderText("one", "one.png");
		const second = getCommentMediaUploadPlaceholderText("two", "two.png");
		const content = `${first}\n${second}\n`;

		const afterFirst = replaceCommentMediaUploadPlaceholder(
			content,
			"one",
			`<img src="one" alt="one" />\n`,
		);
		expect(afterFirst).toContain(`<img src="one" alt="one" />`);
		expect(afterFirst).toContain(second);
		expect(afterFirst).not.toContain("DIFFKIT_UPLOAD:one");

		const afterBoth = replaceCommentMediaUploadPlaceholder(
			afterFirst,
			"two",
			`<img src="two" alt="two" />\n`,
		);
		expect(afterBoth).toContain(`<img src="one" alt="one" />`);
		expect(afterBoth).toContain(`<img src="two" alt="two" />`);
		expect(afterBoth).not.toContain("DIFFKIT_UPLOAD");
		expect(afterBoth).not.toContain("Uploading");
	});

	it("finds the exact range for a placeholder among siblings", () => {
		const first = getCommentMediaUploadPlaceholderText("one", "one.png");
		const second = getCommentMediaUploadPlaceholderText("two", "two.png");
		const content = `${first}\n${second}\n`;

		const range = findCommentMediaUploadPlaceholderRange(content, "two");
		expect(range).toEqual({
			from: first.length + 1,
			to: first.length + 1 + second.length,
		});
	});

	it("falls back to a bare token when the visible line was edited away", () => {
		const content = "before [[DIFFKIT_UPLOAD:abc]] after";
		expect(replaceCommentMediaUploadPlaceholder(content, "abc", "DONE")).toBe(
			"before DONE after",
		);
	});

	it("leaves content untouched when the placeholder is gone", () => {
		expect(replaceCommentMediaUploadPlaceholder("hello", "nope", "X")).toBe(
			"hello",
		);
	});
});
