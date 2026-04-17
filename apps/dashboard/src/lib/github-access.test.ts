import { describe, expect, it } from "vitest";
import {
	buildGitHubAppInstallUrl,
	buildGitHubOrganizationInstallationsUrl,
	findInstallationForOwner,
	type GitHubAppAccessState,
	type GitHubInstallationAccessIndex,
	getAccessHrefForOwner,
	isRepoVisibleWithInstallationAccess,
} from "./github-access";

const state: GitHubAppAccessState = {
	viewerLogin: "adn",
	appSlug: "diff-kit",
	appAuthorizationUrl:
		"/api/github/app/authorize?returnTo=%2F%3Fshow-org-setup%3Dtrue",
	publicInstallUrl: "https://github.com/apps/diff-kit/installations/new",
	installationsAvailable: true,
	personalInstallation: {
		id: 1,
		account: {
			id: 100,
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
				id: 200,
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

	it("uses app authorization when installation status is unavailable", () => {
		expect(
			getAccessHrefForOwner(
				{ ...state, installationsAvailable: false },
				"supabase",
			),
		).toBe("/api/github/app/authorize?returnTo=%2F%3Fshow-org-setup%3Dtrue");
	});
});

describe("buildGitHubOrganizationInstallationsUrl", () => {
	it("builds the organization installations settings URL", () => {
		expect(buildGitHubOrganizationInstallationsUrl("supabase")).toBe(
			"https://github.com/organizations/supabase/settings/installations",
		);
	});
});

describe("isRepoVisibleWithInstallationAccess", () => {
	const index: GitHubInstallationAccessIndex = {
		available: true,
		allAccessOwners: new Set(["supabase"]),
		selectedRepos: new Set(["adn/private-app", "adn/secret-tool"]),
	};

	it("always allows public repos regardless of index", () => {
		expect(
			isRepoVisibleWithInstallationAccess(index, "random-org", "repo", false),
		).toBe(true);
	});

	it("allows private repos from an owner with 'all' access", () => {
		expect(
			isRepoVisibleWithInstallationAccess(
				index,
				"supabase",
				"private-repo",
				true,
			),
		).toBe(true);
	});

	it("allows private repos in the selected set", () => {
		expect(
			isRepoVisibleWithInstallationAccess(index, "adn", "private-app", true),
		).toBe(true);
	});

	it("blocks private repos not in the selected set", () => {
		expect(
			isRepoVisibleWithInstallationAccess(index, "adn", "other-private", true),
		).toBe(false);
	});

	it("blocks private repos from owners without any installation", () => {
		expect(
			isRepoVisibleWithInstallationAccess(
				index,
				"vercel",
				"private-repo",
				true,
			),
		).toBe(false);
	});

	it("fails open when the index is unavailable", () => {
		const unavailable: GitHubInstallationAccessIndex = {
			available: false,
			allAccessOwners: new Set(),
			selectedRepos: new Set(),
		};
		expect(
			isRepoVisibleWithInstallationAccess(
				unavailable,
				"any-org",
				"private-repo",
				true,
			),
		).toBe(true);
	});

	it("treats unknown visibility (null) as potentially private", () => {
		expect(
			isRepoVisibleWithInstallationAccess(index, "adn", "private-app", null),
		).toBe(true);
		expect(
			isRepoVisibleWithInstallationAccess(index, "adn", "other-private", null),
		).toBe(false);
		expect(
			isRepoVisibleWithInstallationAccess(index, "vercel", "some-repo", null),
		).toBe(false);
	});

	it("is case-insensitive for owner and repo matching", () => {
		expect(
			isRepoVisibleWithInstallationAccess(
				index,
				"Supabase",
				"Private-Repo",
				true,
			),
		).toBe(true);
		expect(
			isRepoVisibleWithInstallationAccess(index, "ADN", "Private-App", true),
		).toBe(true);
	});
});
