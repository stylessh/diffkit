import { describe, expect, it } from "vitest";
import { createTextReferenceResolver, parseGitHubUrl } from "./github-links";

describe("parseGitHubUrl", () => {
	it.each([
		["https://github.com/acme/web", "/acme/web", "repo"],
		["https://github.com/acme/web.git", "/acme/web", "repo"],
		["https://github.com/acme/web/pull/12", "/acme/web/pull/12", "pull"],
		[
			"https://github.com/acme/web/pull/12/files",
			"/acme/web/review/12",
			"pull",
		],
		[
			"https://github.com/acme/web/pull/12#issuecomment-99",
			"/acme/web/pull/12#issuecomment-99",
			"pull",
		],
		[
			"https://github.com/acme/web/pull/12/commits/1a2b3c4d",
			"/acme/web/commit/1a2b3c4d",
			"commit",
		],
		["https://www.github.com/acme/web/issues/7", "/acme/web/issues/7", "issue"],
		[
			"https://github.com/acme/web/commit/1a2b3c4d5e",
			"/acme/web/commit/1a2b3c4d5e",
			"commit",
		],
		[
			"https://github.com/acme/web/releases/tag/v1.2.0",
			"/acme/web/releases/v1.2.0",
			"release",
		],
		[
			"https://github.com/acme/web/blob/main/src/app.ts#L10-L12",
			"/acme/web/blob/main/src/app.ts#L10-L12",
			null,
		],
		[
			"https://github.com/acme/web/compare/main...feat",
			"/acme/web/compare/main...feat",
			null,
		],
		[
			"https://github.com/acme/web/actions/runs/42",
			"/acme/web/actions/runs/42",
			null,
		],
	])("maps %s to %s", (url, path, kind) => {
		const link = parseGitHubUrl(url);
		expect(link?.path).toBe(path);
		expect(link?.reference?.kind ?? null).toBe(kind);
	});

	it.each([
		"https://github.com/octocat",
		"https://github.com/orgs/acme/teams",
		"https://github.com/settings/profile",
		"https://github.com/acme/web/wiki/Home",
		"https://github.com/acme/web/pull/abc",
		"https://gitlab.com/acme/web/pull/1",
		"javascript:alert(1)",
		"/acme/web/pull/1",
	])("keeps %s external", (url) => {
		expect(parseGitHubUrl(url)).toBeNull();
	});
});

describe("createTextReferenceResolver", () => {
	it("scopes bare references to the current repository", () => {
		const resolve = createTextReferenceResolver({ owner: "acme", repo: "web" });
		expect(resolve({ kind: "number", repo: null, number: 3 })).toMatchObject({
			kind: "issueOrPull",
			owner: "acme",
			repo: "web",
			number: 3,
		});
		expect(
			resolve({
				kind: "commit",
				repo: { owner: "acme", repo: "api" },
				sha: "1a2b3c4",
			}),
		).toMatchObject({
			kind: "commit",
			owner: "acme",
			repo: "api",
			href: "/acme/api/commit/1a2b3c4",
		});
	});

	it("leaves bare references unlinked outside a repository", () => {
		const resolve = createTextReferenceResolver(null);
		expect(resolve({ kind: "number", repo: null, number: 3 })).toBeNull();
		expect(
			resolve({
				kind: "number",
				repo: { owner: "acme", repo: "api" },
				number: 3,
			}),
		).not.toBeNull();
	});
});
