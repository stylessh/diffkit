export type GitHubInstallationTargetType = "Organization" | "User" | "Unknown";

export type GitHubAppInstallation = {
	id: number;
	account: {
		id: number | null;
		login: string;
		name: string | null;
		avatarUrl: string | null;
		type: GitHubInstallationTargetType;
	};
	targetType: GitHubInstallationTargetType;
	repositorySelection: "all" | "selected" | "unknown";
	manageUrl: string | null;
	suspendedAt: string | null;
};

export type GitHubOrganization = {
	id: number;
	login: string;
	avatarUrl: string | null;
};

export type GitHubAppAccessState = {
	viewerLogin: string;
	appSlug: string | null;
	appAuthorizationUrl: string | null;
	publicInstallUrl: string | null;
	/** Whether the installations endpoint was reachable (false with OAuth App tokens). */
	installationsAvailable: boolean;
	personalInstallation: GitHubAppInstallation | null;
	orgInstallations: GitHubAppInstallation[];
	organizations: GitHubOrganization[];
	missingOrganizations: GitHubOrganization[];
};

export function buildGitHubAppInstallUrl(slug: string | null | undefined) {
	return slug ? `https://github.com/apps/${slug}/installations/new` : null;
}

export function buildGitHubAppAuthorizePath(returnTo = "/setup") {
	const params = new URLSearchParams({ returnTo });
	return `/api/github/app/authorize?${params.toString()}`;
}

export function buildGitHubOrganizationInstallationsUrl(login: string) {
	return `https://github.com/organizations/${login}/settings/installations`;
}

function normalizeLogin(login: string) {
	return login.trim().toLowerCase();
}

export function findInstallationForOwner(
	state: GitHubAppAccessState,
	owner: string,
) {
	const normalizedOwner = normalizeLogin(owner);

	if (normalizeLogin(state.viewerLogin) === normalizedOwner) {
		return state.personalInstallation;
	}

	return (
		state.orgInstallations.find(
			(installation) =>
				normalizeLogin(installation.account.login) === normalizedOwner,
		) ?? null
	);
}

export function getAccessHrefForOwner(
	state: GitHubAppAccessState | null | undefined,
	owner: string | null | undefined,
	fallbackHref?: string,
) {
	if (!state || !owner) {
		return fallbackHref ?? null;
	}

	const normalizedOwner = normalizeLogin(owner);
	if (!state.installationsAvailable && state.appAuthorizationUrl) {
		return state.appAuthorizationUrl;
	}

	const installation = findInstallationForOwner(state, owner);
	if (installation?.manageUrl) {
		return installation.manageUrl;
	}

	if (
		normalizeLogin(state.viewerLogin) !== normalizedOwner &&
		state.organizations.some(
			(organization) => normalizeLogin(organization.login) === normalizedOwner,
		)
	) {
		return buildGitHubOrganizationInstallationsUrl(owner);
	}

	return state.publicInstallUrl ?? fallbackHref ?? null;
}

// ---------------------------------------------------------------------------
// Installation access index
// ---------------------------------------------------------------------------

/**
 * A pre-computed index of which repos/owners are accessible via the GitHub App
 * installations. Used to filter private repos so the OAuth token doesn't leak
 * access beyond what the user configured in their App installation.
 */
export type GitHubInstallationAccessIndex = {
	/** `false` when the app-user token isn't available (no app auth yet). */
	available: boolean;
	/** Normalized owner logins with `repositorySelection: "all"`. */
	allAccessOwners: Set<string>;
	/** Normalized `owner/repo` strings for `repositorySelection: "selected"`. */
	selectedRepos: Set<string>;
};

const EMPTY_INSTALLATION_ACCESS_INDEX: GitHubInstallationAccessIndex = {
	available: false,
	allAccessOwners: new Set(),
	selectedRepos: new Set(),
};

export function emptyInstallationAccessIndex(): GitHubInstallationAccessIndex {
	return EMPTY_INSTALLATION_ACCESS_INDEX;
}

/**
 * Returns `true` when a repo should be visible given the current installation
 * access index.
 *
 * Rules:
 * - Public repos always pass.
 * - When the index isn't available (no app setup), all repos pass (fail-open).
 * - Private repos pass only when the owning account has an "all" installation
 *   **or** the specific repo is in the "selected" set.
 */
export function isRepoVisibleWithInstallationAccess(
	index: GitHubInstallationAccessIndex,
	owner: string,
	repo: string,
	isPrivate: boolean | null,
): boolean {
	// Only skip the check when the repo is *explicitly* public.
	// `null` (unknown visibility) is treated as potentially private.
	if (isPrivate === false) return true;
	if (!index.available) return true;

	const normalizedOwner = normalizeLogin(owner);
	if (index.allAccessOwners.has(normalizedOwner)) return true;
	return index.selectedRepos.has(`${normalizedOwner}/${repo.toLowerCase()}`);
}
