import { describe, expect, it } from "vitest";
import {
	changedFields,
	draftFromSettings,
	mapRepoGeneralSettings,
	type RawRepoSettings,
	toApiPatch,
	validateRepoGeneralDraft,
} from "./repo-general";

const raw: RawRepoSettings = {
	owner: { login: "acme", type: "Organization" },
	name: "api",
	full_name: "acme/api",
	html_url: "https://github.com/acme/api",
	description: "The API",
	private: true,
	default_branch: "main",
};

describe("mapRepoGeneralSettings", () => {
	it("falls back to GitHub's defaults when the viewer cannot see merge options", () => {
		const settings = mapRepoGeneralSettings(raw);
		expect(settings).toMatchObject({
			visibility: "private",
			isOrgOwned: true,
			allowSquashMerge: true,
			allowMergeCommit: true,
			allowRebaseMerge: true,
			allowAutoMerge: false,
			deleteBranchOnMerge: false,
			homepage: "",
		});
	});

	it("keeps internal visibility, which private alone cannot express", () => {
		expect(
			mapRepoGeneralSettings({ ...raw, visibility: "internal" }).visibility,
		).toBe("internal");
	});
});

describe("changedFields and toApiPatch", () => {
	const saved = draftFromSettings(mapRepoGeneralSettings(raw));

	it("sends only the fields that changed, trimmed, under GitHub's names", () => {
		const changes = changedFields(saved, {
			...saved,
			description: "  A faster API  ",
			allowAutoMerge: true,
		});
		expect(changes).toEqual({
			description: "A faster API",
			allowAutoMerge: true,
		});
		expect(toApiPatch(changes)).toEqual({
			description: "A faster API",
			allow_auto_merge: true,
		});
	});

	it("reports no change when only whitespace differs", () => {
		expect(
			changedFields(saved, { ...saved, description: "The API  " }),
		).toEqual({});
	});

	it("never forwards a field the draft model does not know", () => {
		expect(
			toApiPatch({ archived: true, allowAutoMerge: true } as never),
		).toEqual({ allow_auto_merge: true });
	});
});

describe("validateRepoGeneralDraft", () => {
	const base = draftFromSettings(mapRepoGeneralSettings(raw));

	it("keeps at least one merge method enabled", () => {
		expect(
			validateRepoGeneralDraft({
				...base,
				allowSquashMerge: false,
				allowMergeCommit: false,
				allowRebaseMerge: false,
			}),
		).toBe("Allow at least one merge method.");
		expect(
			validateRepoGeneralDraft({
				...base,
				allowSquashMerge: false,
				allowMergeCommit: false,
			}),
		).toBeNull();
	});

	it("rejects a website that is not http(s)", () => {
		expect(
			validateRepoGeneralDraft({ ...base, homepage: "javascript:alert(1)" }),
		).toMatch(/http/);
		expect(
			validateRepoGeneralDraft({ ...base, homepage: "https://acme.dev" }),
		).toBeNull();
	});
});
