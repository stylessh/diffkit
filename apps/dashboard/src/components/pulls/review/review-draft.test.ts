import { describe, expect, it } from "vitest";
import { EMPTY_REVIEW_DRAFT, reviewDraftReducer } from "./review-draft";

describe("reviewDraftReducer", () => {
	it("anchors a selection dragged upwards across sides on its last line", () => {
		const draft = reviewDraftReducer(EMPTY_REVIEW_DRAFT, {
			type: "compose",
			path: "src/a.ts",
			range: { start: 12, side: "additions", end: 9, endSide: "deletions" },
		});

		expect(draft.composing?.form).toEqual({
			path: "src/a.ts",
			line: 12,
			side: "RIGHT",
			startLine: 9,
			startSide: "LEFT",
		});
	});

	it("closes the composer when its comment joins the pending review", () => {
		const composing = reviewDraftReducer(EMPTY_REVIEW_DRAFT, {
			type: "compose",
			path: "src/a.ts",
			range: { start: 4, side: "deletions", end: 4 },
		});
		const form = composing.composing?.form;
		if (!form) throw new Error("expected an open composer");

		const added = reviewDraftReducer(composing, {
			type: "add",
			comment: { ...form, body: "Why this?" },
		});

		expect(added.composing).toBeNull();
		expect(added.pending).toEqual([
			{ path: "src/a.ts", line: 4, side: "LEFT", body: "Why this?" },
		]);
	});
});
