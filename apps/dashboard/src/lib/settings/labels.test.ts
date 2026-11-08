import { describe, expect, it } from "vitest";
import {
	LABEL_COLORS,
	labelRequestBody,
	normalizeLabelColor,
	suggestLabelColor,
	validateLabelDraft,
} from "./labels";

const draft = { name: "bug", color: "#D73A4A", description: "" };

describe("label drafts", () => {
	it("accepts a hex colour with or without the hash and sends it normalized", () => {
		expect(normalizeLabelColor(" #D73A4A ")).toBe("d73a4a");
		expect(labelRequestBody({ ...draft, name: " bug " })).toEqual({
			name: "bug",
			color: "d73a4a",
			description: "",
		});
		expect(validateLabelDraft(draft, [])).toBeNull();
	});

	it("rejects bad colours and duplicates regardless of case, but not the label's own name", () => {
		expect(validateLabelDraft({ ...draft, color: "red" }, [])).toMatch(/hex/);
		expect(validateLabelDraft({ ...draft, color: "fff" }, [])).toMatch(/hex/);
		expect(validateLabelDraft(draft, ["Bug", "docs"])).toMatch(
			/already exists/,
		);
		expect(validateLabelDraft(draft, ["docs"])).toBeNull();
	});
});

describe("suggestLabelColor", () => {
	it("offers the first palette colour the repository has not used yet", () => {
		expect(suggestLabelColor([])).toBe(LABEL_COLORS[0]);
		expect(suggestLabelColor(["0075CA", "#d73a4a"])).toBe(LABEL_COLORS[2]);
		expect(suggestLabelColor([...LABEL_COLORS])).toBe(LABEL_COLORS[0]);
	});
});
