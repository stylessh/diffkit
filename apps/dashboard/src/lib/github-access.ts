export type GitHubInstallationTargetType = "Organization" | "User" | "Unknown";

export type GitHubAppInstallation = {
	id: number;
	account: {
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
