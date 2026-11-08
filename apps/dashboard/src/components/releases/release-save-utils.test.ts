import { describe, expect, it } from "vitest";
import type { RepoRelease } from "#/lib/github.types";
import {
	buildReleaseSavePayload,
	formatBytes,
	initialReleaseFormState,
	type ReleaseFormState,
	releaseNotesRangeKey,
	releaseStatusBadges,
	shouldApplyGeneratedReleaseNotes,
	validateReleaseForm,
	validateReleaseTag,
} from "./release-save-utils";

function release(overrides: Partial<RepoRelease> = {}): RepoRelease {
	return {
		id: 42,
		tagName: "v1.0.0",
		name: "First",
		body: "Notes",
		isDraft: false,
		isPrerelease: false,
		isLatest: true,
		createdAt: "2026-11-01T00:00:00Z",
		publishedAt: "2026-11-01T00:00:00Z",
		author: null,
		targetCommitish: "main",
		url: "https://github.com/o/r/releases/tag/v1.0.0",
		tarballUrl: null,
		zipballUrl: null,
		assets: [],
		...overrides,
	};
}

function form(overrides: Partial<ReleaseFormState> = {}): ReleaseFormState {
	return {
		...initialReleaseFormState({ defaultBranch: "main" }),
		tagName: "v2.0.0",
		...overrides,
	};
}

describe("validateReleaseTag", () => {
	it.each([
		"v1.0.0",
		"release/2026-11",
		"pkg@1.2.3",
		"1.0.0-rc.1+build.5",
	])("accepts %s", (tag) => {
		expect(validateReleaseTag(tag)).toBeNull();
	});

	it.each([
		"",
		"has space",
		"a..b",
		"ends.",
		".starts",
		"/lead",
		"trail/",
		"double//slash",
		"x.lock",
		"weird~tag",
		"what?",
		"a@{b",
		"@",
	])("rejects %j", (tag) => {
		expect(validateReleaseTag(tag)).not.toBeNull();
	});
});

describe("validateReleaseForm", () => {
	it("rejects tags that already have a release, except the one being edited", () => {
		expect(
			validateReleaseForm(form({ tagName: "v1.0.0" }), {
				releasedTags: ["v1.0.0"],
			}).tagName,
		).toMatch(/already exists/);
		expect(
			validateReleaseForm(form({ tagName: "v1.0.0" }), {
				releasedTags: ["v1.0.0"],
				editingTag: "v1.0.0",
			}),
		).toEqual({});
	});
});

describe("initialReleaseFormState", () => {
	it("blanks a title GitHub defaulted to the tag", () => {
		const state = initialReleaseFormState({
			release: release({ name: "v1.0.0" }),
			defaultBranch: "main",
		});
		expect(state.name).toBe("");
		expect(state.tagName).toBe("v1.0.0");
		expect(state.makeLatest).toBe(true);
	});
});

describe("buildReleaseSavePayload", () => {
	const base = { owner: "o", repo: "r" };

	it("creates a published release from a new tag with its target branch", () => {
		expect(
			buildReleaseSavePayload({
				...base,
				form: form({ name: "  ", targetCommitish: "develop" }),
				intent: "publish",
				tagExists: false,
			}),
		).toEqual({
			owner: "o",
			repo: "r",
			tagName: "v2.0.0",
			name: "v2.0.0",
			body: "",
			draft: false,
			prerelease: false,
			targetCommitish: "develop",
			makeLatest: "true",
		});
	});

	it("omits the target for existing tags and make_latest for drafts", () => {
		const payload = buildReleaseSavePayload({
			...base,
			form: form(),
			intent: "draft",
			tagExists: true,
		});
		expect(payload).not.toHaveProperty("targetCommitish");
		expect(payload).not.toHaveProperty("makeLatest");
		expect(payload.draft).toBe(true);
	});

	it("never marks a prerelease as latest", () => {
		const payload = buildReleaseSavePayload({
			...base,
			form: form({ prerelease: true, makeLatest: true }),
			intent: "publish",
			tagExists: true,
		});
		expect(payload.makeLatest).toBe("false");
	});

	it("keeps published releases published when saving edits", () => {
		const payload = buildReleaseSavePayload({
			...base,
			form: form({ tagName: "v1.0.0" }),
			intent: "draft",
			existing: release(),
			tagExists: true,
		});
		expect(payload).toMatchObject({ releaseId: 42, draft: false });
		// Latest switch untouched → don't send make_latest at all.
		expect(payload).not.toHaveProperty("makeLatest");
	});

	it("only sends make_latest on edits when the switch changed", () => {
		const existing = release({ isLatest: false });
		expect(
			buildReleaseSavePayload({
				...base,
				form: initialReleaseFormState({
					release: existing,
					defaultBranch: "main",
				}),
				intent: "publish",
				existing,
				tagExists: true,
			}),
		).not.toHaveProperty("makeLatest");
		expect(
			buildReleaseSavePayload({
				...base,
				form: {
					...initialReleaseFormState({
						release: existing,
						defaultBranch: "main",
					}),
					makeLatest: true,
				},
				intent: "publish",
				existing,
				tagExists: true,
			}).makeLatest,
		).toBe("true");
	});

	it("publishes a draft as latest by default", () => {
		const draft = release({ isDraft: true, isLatest: false });
		const payload = buildReleaseSavePayload({
			...base,
			form: initialReleaseFormState({ release: draft, defaultBranch: "main" }),
			intent: "publish",
			existing: draft,
			tagExists: false,
		});
		expect(payload).toMatchObject({
			releaseId: 42,
			draft: false,
			makeLatest: "true",
		});
	});
});

describe("shouldApplyGeneratedReleaseNotes", () => {
	it("rejects notes once the range or the notes changed", () => {
		const key = releaseNotesRangeKey(
			form({ previousTagName: "v1.0.0", targetCommitish: "main" }),
		);
		expect(key).toBe("v1.0.0...main->v2.0.0");
		const args = {
			currentKey: key,
			requestKey: key,
			currentNotes: "",
			baselineNotes: "",
		};
		expect(shouldApplyGeneratedReleaseNotes(args)).toBe(true);
		expect(
			shouldApplyGeneratedReleaseNotes({ ...args, currentKey: "other" }),
		).toBe(false);
		expect(
			shouldApplyGeneratedReleaseNotes({ ...args, currentNotes: "typed" }),
		).toBe(false);
	});
});

describe("releaseStatusBadges", () => {
	it("hides latest on drafts", () => {
		expect(
			releaseStatusBadges({
				isDraft: true,
				isPrerelease: false,
				isLatest: true,
			}),
		).toEqual(["draft"]);
		expect(
			releaseStatusBadges({
				isDraft: false,
				isPrerelease: true,
				isLatest: false,
			}),
		).toEqual(["prerelease"]);
	});
});

describe("formatBytes", () => {
	it("formats sizes with sensible precision", () => {
		expect(formatBytes(0)).toBe("0 B");
		expect(formatBytes(512)).toBe("512 B");
		expect(formatBytes(1536)).toBe("1.5 KB");
		expect(formatBytes(10 * 1024 * 1024)).toBe("10 MB");
		expect(formatBytes(1234567890)).toBe("1.15 GB");
	});
});
