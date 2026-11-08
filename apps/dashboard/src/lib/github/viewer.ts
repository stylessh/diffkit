import { createServerFn } from "@tanstack/react-start";
import {
	buildGitHubAppAuthorizePath,
	buildGitHubAppInstallUrl,
	type GitHubAppAccessState,
} from "../github-access";
import { getGitHubAppSlug } from "../github-app.server";
import { shouldReauthorizeGitHubApp } from "../github-auth-errors";
import {
	getGitHubContext,
	getViewer,
	withGitHubOperationTimeout,
} from "./client";
import {
	getGitHubAppUserInstallations,
	getGitHubAuthenticatedOrganizations,
	getInstallationAccessIndex,
} from "./installations";
import {
	GITHUB_OPERATION_TIMEOUT_MS,
	GITHUB_PAGINATED_OPERATION_TIMEOUT_MS,
} from "./shared";

export const getGitHubViewer = createServerFn({ method: "GET" }).handler(
	async () => {
		const context = await getGitHubContext();
		if (!context) {
			return null;
		}

		const viewer = await getViewer(context);

		return {
			id: viewer.id,
			login: viewer.login,
			name: viewer.name,
			avatarUrl: viewer.avatar_url,
			url: viewer.html_url,
		};
	},
);

export const checkSetupComplete = createServerFn({
	method: "GET",
}).handler(async (): Promise<boolean> => {
	const { getRequestSession } = await import("../auth-runtime");
	const session = await getRequestSession();
	if (!session) {
		return false;
	}

	const { hasGitHubAppUserAccount } = await import("../github-app.server");
	if (!(await hasGitHubAppUserAccount(session.user.id))) {
		return false;
	}

	const { getGitHubAppUserClientByUserId } = await import("../auth-runtime");
	try {
		const appUserOctokit = await getGitHubAppUserClientByUserId(
			session.user.id,
		);
		if (!appUserOctokit) {
			return false;
		}

		await appUserOctokit.request("GET /user/installations", {
			per_page: 1,
		});
		return true;
	} catch (error) {
		if (shouldReauthorizeGitHubApp(error)) {
			return false;
		}
		throw error;
	}
});

export const getGitHubAppAccessState = createServerFn({
	method: "GET",
}).handler(async (): Promise<GitHubAppAccessState | null> => {
	const context = await getGitHubContext();
	if (!context) {
		return null;
	}

	const viewer = await withGitHubOperationTimeout(
		"github app access viewer",
		GITHUB_OPERATION_TIMEOUT_MS,
		() => getViewer(context),
	);
	const appSlug = getGitHubAppSlug();
	const appAuthorizationUrl = buildGitHubAppAuthorizePath();
	const publicInstallUrl = buildGitHubAppInstallUrl(appSlug);
	const [
		{ installations, installationsAvailable },
		authenticatedOrganizations,
	] = await withGitHubOperationTimeout(
		"github app access state",
		GITHUB_PAGINATED_OPERATION_TIMEOUT_MS,
		() =>
			Promise.all([
				getGitHubAppUserInstallations(context.session.user.id),
				getGitHubAuthenticatedOrganizations(context),
			]),
	);

	let organizations = authenticatedOrganizations;

	const viewerLogin = viewer.login;
	const personalInstallation =
		installations.find(
			(installation) =>
				installation.targetType === "User" ||
				installation.account.login.toLowerCase() === viewerLogin.toLowerCase(),
		) ?? null;
	const orgInstallations = installations.filter(
		(installation) => installation.targetType === "Organization",
	);
	const organizationByLogin = new Map(
		organizations.map((organization) => [
			organization.login.toLowerCase(),
			organization,
		]),
	);
	for (const installation of orgInstallations) {
		if (!organizationByLogin.has(installation.account.login.toLowerCase())) {
			organizationByLogin.set(installation.account.login.toLowerCase(), {
				id: installation.account.id ?? installation.id,
				login: installation.account.login,
				avatarUrl: installation.account.avatarUrl,
			});
		}
	}
	organizations = [...organizationByLogin.values()];
	const installedOrganizationLogins = new Set(
		orgInstallations.map((installation) =>
			installation.account.login.toLowerCase(),
		),
	);

	return {
		viewerLogin,
		appSlug,
		appAuthorizationUrl,
		publicInstallUrl,
		installationsAvailable,
		personalInstallation,
		orgInstallations,
		organizations,
		missingOrganizations: organizations.filter(
			(organization) =>
				!installedOrganizationLogins.has(organization.login.toLowerCase()),
		),
	};
});

export type SerializedInstallationAccessIndex = {
	available: boolean;
	allAccessOwners: string[];
	selectedRepos: string[];
};

export const getInstallationAccess = createServerFn({
	method: "GET",
}).handler(async (): Promise<SerializedInstallationAccessIndex> => {
	const context = await getGitHubContext();
	if (!context) {
		return { available: false, allAccessOwners: [], selectedRepos: [] };
	}

	const index = await getInstallationAccessIndex(context);
	return {
		available: index.available,
		allAccessOwners: [...index.allAccessOwners],
		selectedRepos: [...index.selectedRepos],
	};
});
