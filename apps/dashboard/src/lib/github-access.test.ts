import { describe, expect, it } from "vitest";
import {
	buildGitHubAppInstallUrl,
	buildGitHubOrganizationInstallationsUrl,
	findInstallationForOwner,
	type GitHubAppAccessState,
	getAccessHrefForOwner,
} from "./github-access";

const state: GitHubAppAccessState = {
	viewerLogin: "adn",
	appSlug: "diff-kit",
	publicInstallUrl: "https://github.com/apps/diff-kit/installations/new",
	personalInstallation: {
		id: 1,
		account: {
			login: "adn",
			name: null,
			avatarUrl: null,
			type: "User",
		},
		targetType: "User",
		repositorySelection: "selected",
		manageUrl: "https://github.com/settings/installations/1",
		suspendedAt: null,
	},
	orgInstallations: [
		{
			id: 2,
			account: {
				login: "supabase",
				name: null,
				avatarUrl: null,
				type: "Organization",
			},
			targetType: "Organization",
			repositorySelection: "all",
			manageUrl:
				"https://github.com/organizations/supabase/settings/installations/2",
			suspendedAt: null,
		},
	],
	organizations: [
		{ id: 10, login: "supabase", avatarUrl: null },
		{ id: 11, login: "vercel", avatarUrl: null },
	],
	missingOrganizations: [{ id: 11, login: "vercel", avatarUrl: null }],
};

describe("buildGitHubAppInstallUrl", () => {
	it("builds the public GitHub app install URL", () => {
		expect(buildGitHubAppInstallUrl("diff-kit")).toBe(
			"https://github.com/apps/diff-kit/installations/new",
		);
	});
});

describe("findInstallationForOwner", () => {
	it("returns the personal installation for the viewer account", () => {
		expect(findInstallationForOwner(state, "adn")?.id).toBe(1);
	});

	it("returns the matching organization installation", () => {
		expect(findInstallationForOwner(state, "supabase")?.id).toBe(2);
	});
});

describe("getAccessHrefForOwner", () => {
	it("prefers the existing installation management URL", () => {
		expect(getAccessHrefForOwner(state, "supabase")).toBe(
			"https://github.com/organizations/supabase/settings/installations/2",
		);
	});

	it("falls back to the public install URL when the org is missing", () => {
		expect(getAccessHrefForOwner(state, "vercel")).toBe(
			"https://github.com/organizations/vercel/settings/installations",
		);
	});

	it("uses the provided fallback URL without state", () => {
		expect(
			getAccessHrefForOwner(null, "vercel", "https://fallback.example"),
		).toBe("https://fallback.example");
	});
});

describe("buildGitHubOrganizationInstallationsUrl", () => {
	it("builds the organization installations settings URL", () => {
		expect(buildGitHubOrganizationInstallationsUrl("supabase")).toBe(
			"https://github.com/organizations/supabase/settings/installations",
		);
	});
});
