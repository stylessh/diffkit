import { RequestError } from "octokit";
import { debug } from "../debug";
import type { MyPullsResult, RepositoryRef } from "../github.types";
import {
	emptyInstallationAccessIndex,
	type GitHubAppInstallation,
	type GitHubInstallationAccessIndex,
	type GitHubInstallationTargetType,
	type GitHubOrganization,
	isRepoVisibleWithInstallationAccess,
} from "../github-access";
import {
	getGitHubContext,
	getOrCreateCachedContext,
	listPaginatedGitHubItems,
	withGitHubOperationTimeout,
} from "./client";
import {
	forgetIdentityRead,
	readIdentityThroughMemory,
	rememberIdentityRead,
} from "./identity-memory";
import { dedupeGitHubRead } from "./request-dedup";
import {
	type GitHubClient,
	type GitHubContext,
	type GitHubInstallationAccountPayload,
	type GitHubInstallationRepositoriesPayload,
	normalizeLogin,
	type RepositoryInput,
} from "./shared";

type GitHubUserInstallationPayload = {
	id?: number;
	account?: GitHubInstallationAccountPayload | null;
	html_url?: string | null;
	target_type?: string;
	repository_selection?: string;
	suspended_at?: string | null;
	permissions?: Record<string, string | undefined>;
	app_slug?: string;
};

type GitHubUserInstallationsPayload = {
	total_count?: number;
	installations?: GitHubUserInstallationPayload[];
};

type InstallationRepositoryPayload = NonNullable<
	GitHubInstallationRepositoriesPayload["repositories"]
>[number];

type GitHubAuthenticatedOrgPayload = {
	id?: number;
	login?: string;
	avatar_url?: string | null;
};

function toRepositorySelection(value: string | undefined) {
	return value === "all" || value === "selected" ? value : "unknown";
}

function mapGitHubAppInstallations(
	payload: GitHubUserInstallationsPayload,
): GitHubAppInstallation[] {
	return (payload.installations ?? []).flatMap((installation) => {
		if (!installation.id || !installation.account?.login) {
			return [];
		}

		const targetType = toInstallationTargetType(installation.target_type);

		return [
			{
				id: installation.id,
				account: {
					id: installation.account.id ?? null,
					login: installation.account.login,
					name: null,
					avatarUrl: installation.account.avatar_url ?? null,
					type: toInstallationTargetType(installation.account.type),
				},
				targetType,
				repositorySelection: toRepositorySelection(
					installation.repository_selection,
				),
				manageUrl: installation.html_url ?? null,
				suspendedAt: installation.suspended_at ?? null,
			},
		];
	});
}

const USER_INSTALLATIONS_PAGE_SIZE = 100;
const ROUTING_INSTALLATIONS_RESOURCE = "installations";

async function listUserInstallations(
	appUserOctokit: GitHubClient,
): Promise<GitHubAppInstallation[]> {
	const rawInstallations = await listPaginatedGitHubItems({
		request: (page) =>
			appUserOctokit.request("GET /user/installations", {
				per_page: USER_INSTALLATIONS_PAGE_SIZE,
				page,
			}),
		getItems: (payload) =>
			(payload as GitHubUserInstallationsPayload).installations ?? [],
		label: "github user installations",
		pageSize: USER_INSTALLATIONS_PAGE_SIZE,
	});
	const installations = mapGitHubAppInstallations({
		installations: rawInstallations,
	});
	debug("github-access", "loaded app installations", {
		count: installations.length,
		owners: installations.map((i) => i.account.login),
	});
	return installations;
}

/**
 * Remembering "no installations" would send a user who just installed the
 * app through their OAuth token until the entry expired.
 */
function rememberRoutingInstallations(
	userId: string,
	installations: GitHubAppInstallation[],
) {
	if (installations.length > 0) {
		rememberIdentityRead(userId, ROUTING_INSTALLATIONS_RESOURCE, installations);
	} else {
		forgetIdentityRead(userId, ROUTING_INSTALLATIONS_RESOURCE);
	}
}

/** Always asks GitHub: this is what the access screens and filters show. */
export async function getGitHubAppUserInstallations(userId: string): Promise<{
	installations: GitHubAppInstallation[];
	/** `true` when the app-user token is configured and the API responded. */
	installationsAvailable: boolean;
	appUserOctokit: GitHubClient | null;
}> {
	const { getGitHubAppUserClientByUserId } = await import("../auth-runtime");
	const appUserOctokit = await getGitHubAppUserClientByUserId(userId);
	if (!appUserOctokit) {
		debug("github-access", "no app user client, skipping installations");
		return {
			installations: [],
			installationsAvailable: false,
			appUserOctokit: null,
		};
	}

	// The app-user token exists, so failures from here on are transient:
	// propagate them to the caller instead of failing open.
	const installations = await listUserInstallations(appUserOctokit);
	rememberRoutingInstallations(userId, installations);
	return {
		installations,
		installationsAvailable: true,
		appUserOctokit,
	};
}

/**
 * Installations as of at most `IDENTITY_MEMORY_TTL_MS` ago, for choosing
 * which token a read goes through and which repositories the lists show. A
 * stale answer degrades safely: a new installation is read with the OAuth
 * token as before it existed, and a removed one fails its token mint and
 * falls back to OAuth.
 */
export async function getRoutingInstallations(
	userId: string,
): Promise<GitHubAppInstallation[]> {
	return readIdentityThroughMemory<GitHubAppInstallation[]>({
		userId,
		resource: ROUTING_INSTALLATIONS_RESOURCE,
		shouldRemember: (installations) => installations.length > 0,
		load: async () => {
			const { getGitHubAppUserClientByUserId } = await import(
				"../auth-runtime"
			);
			const appUserOctokit = await getGitHubAppUserClientByUserId(userId);
			if (!appUserOctokit) {
				debug("github-access", "no app user client, skipping installations");
				return [];
			}
			return listUserInstallations(appUserOctokit);
		},
	});
}

export async function getGitHubAuthenticatedOrganizations(
	context: GitHubContext,
): Promise<GitHubOrganization[]> {
	try {
		const organizationsResponse = await context.octokit.request(
			"GET /user/orgs",
			{
				per_page: 100,
			},
		);
		const payload =
			organizationsResponse.data as GitHubAuthenticatedOrgPayload[];
		return payload.flatMap((organization) => {
			if (!organization.id || !organization.login) {
				return [];
			}

			return [
				{
					id: organization.id,
					login: organization.login,
					avatarUrl: organization.avatar_url ?? null,
				},
			];
		});
	} catch (error) {
		console.error("[github-access] failed to load organizations", error);
		return [];
	}
}

type SerializableInstallationAccessIndex = {
	available: boolean;
	allAccessOwners: string[];
	selectedRepos: string[];
};

function installationRepositoryFullName(
	repository: InstallationRepositoryPayload,
) {
	const fullName =
		repository.full_name ??
		(repository.owner?.login && repository.name
			? `${repository.owner.login}/${repository.name}`
			: null);
	return fullName?.toLowerCase() ?? null;
}

/** Needs the app-user client: the endpoint rejects OAuth tokens. */
export async function listInstallationRepositories(
	appUserOctokit: GitHubClient,
	installationId: number,
): Promise<InstallationRepositoryPayload[]> {
	return listPaginatedGitHubItems({
		request: (page) =>
			appUserOctokit.rest.apps.listInstallationReposForAuthenticatedUser({
				installation_id: installationId,
				page,
				per_page: 100,
			}),
		getItems: (payload) =>
			(payload as GitHubInstallationRepositoriesPayload).repositories ?? [],
		label: `installation repos ${installationId}`,
	});
}

/** One listing per installation while serving a request, however many ask. */
function listViewerInstallationRepositories(
	userId: string,
	appUserOctokit: GitHubClient,
	installationId: number,
) {
	return dedupeGitHubRead<InstallationRepositoryPayload[]>({
		userId,
		resource: "installationRepositories",
		params: { installationId },
		fetcher: () => listInstallationRepositories(appUserOctokit, installationId),
	});
}

async function buildInstallationAccessIndex(
	userId: string,
): Promise<SerializableInstallationAccessIndex> {
	const { getGitHubAppUserClientByUserId } = await import("../auth-runtime");
	const appUserOctokit = await getGitHubAppUserClientByUserId(userId);
	if (!appUserOctokit) {
		debug(
			"installation-access",
			"app-user token unavailable, index not available (fail-open)",
		);
		return { available: false, allAccessOwners: [], selectedRepos: [] };
	}

	const installations = (await getRoutingInstallations(userId)).filter(
		(installation) => !installation.suspendedAt,
	);
	const allAccessOwners = installations
		.filter((installation) => installation.repositorySelection === "all")
		.map((installation) => installation.account.login.toLowerCase());
	const selectedRepoLists = await Promise.all(
		installations
			.filter((installation) => installation.repositorySelection === "selected")
			.map(async (installation) => {
				try {
					const repositories = await listViewerInstallationRepositories(
						userId,
						appUserOctokit,
						installation.id,
					);
					return repositories.flatMap(
						(repository) => installationRepositoryFullName(repository) ?? [],
					);
				} catch (error) {
					console.error(
						`[installation-access] failed to list repos for installation ${installation.id}`,
						error,
					);
					return [];
				}
			}),
	);

	return {
		available: true,
		allAccessOwners,
		selectedRepos: selectedRepoLists.flat(),
	};
}

export async function getInstallationAccessIndex(
	context: GitHubContext,
): Promise<GitHubInstallationAccessIndex> {
	const userId = context.session.user.id;
	try {
		const serializable =
			await dedupeGitHubRead<SerializableInstallationAccessIndex>({
				userId,
				resource: "installationAccess",
				params: null,
				fetcher: () => buildInstallationAccessIndex(userId),
			});

		debug("installation-access", "resolved access index", {
			available: serializable.available,
			allAccessOwners: serializable.allAccessOwners,
			selectedRepoCount: serializable.selectedRepos.length,
		});

		return {
			available: serializable.available,
			allAccessOwners: new Set(serializable.allAccessOwners),
			selectedRepos: new Set(serializable.selectedRepos),
		};
	} catch (error) {
		// Transient failure (network, 500): fail open so one bad request doesn't
		// hide every private repo from the user.
		console.error("[installation-access] failed to build access index", error);
		return emptyInstallationAccessIndex();
	}
}

export async function getGitHubContextForInstallation(
	baseContext: GitHubContext,
	installation: GitHubAppInstallation,
) {
	return getOrCreateCachedContext(
		`installation:${installation.id}`,
		async () => {
			if (installation.suspendedAt) {
				return null;
			}

			try {
				debug("github-access", "creating installation client", {
					owner: installation.account.login,
					installationId: installation.id,
				});
				const { getGitHubInstallationClient } = await import(
					"../github.server"
				);
				const installationOctokit = await getGitHubInstallationClient(
					installation.id,
				);
				// Eagerly authenticate to verify the installation token is valid.
				// auth-app authenticates lazily by default, so without this the
				// try/catch cannot catch auth failures.
				await installationOctokit.auth({ type: "installation" });
				debug("github-access", "installation client ready", {
					owner: installation.account.login,
				});
				return {
					...baseContext,
					octokit: installationOctokit,
				};
			} catch (error) {
				console.error(
					"[github-access] installation client failed",
					installation.account.login,
					error,
				);
				return null;
			}
		},
	);
}

/**
 * The installation token belongs to the app, not to the viewer, so it reads
 * a repository only after `viewerCanReadInstallationRepository` has said this
 * viewer can read it. Every other outcome keeps the viewer's own token, where
 * GitHub decides.
 */
export async function getGitHubContextForRepository(input: {
	owner: string;
	repo: string;
}) {
	return getOrCreateCachedContext(
		`repo:${input.owner}/${input.repo}`,
		async () => {
			const context = await getGitHubContext();
			if (!context) {
				return null;
			}

			const installation = findGitHubAppInstallationForOwner(
				await getRoutingInstallations(context.session.user.id),
				input.owner,
			);
			if (!installation) {
				debug("github-access", "no installation for repo owner, using OAuth", {
					owner: input.owner,
					repo: input.repo,
				});
				return context;
			}

			if (
				!(await viewerCanReadInstallationRepository(
					context,
					installation,
					input,
				))
			) {
				debug(
					"github-access",
					"viewer access to repo not confirmed, using OAuth",
					{
						owner: input.owner,
						repo: input.repo,
						installationId: installation.id,
					},
				);
				return context;
			}

			const installationContext = await getGitHubContextForInstallation(
				context,
				installation,
			);
			if (!installationContext) {
				console.error(
					"[github-access] installation client failed, falling back to OAuth token",
					input.owner,
				);
				return context;
			}

			return installationContext;
		},
	);
}

const REPOSITORY_ACCESS_CHECK_TIMEOUT_MS = 5_000;

/**
 * Asks GitHub with the viewer's app-user token, which reaches only what both
 * the viewer and the app can read. An installation on all repositories covers
 * whatever its account owns, so reading the one repository settles it; any
 * other selection has to list the repository for this viewer.
 *
 * Throws when GitHub gave no answer, so that only answers are remembered.
 */
async function askGitHubWhetherViewerCanRead(
	userId: string,
	installation: GitHubAppInstallation,
	params: RepositoryInput,
	signal: AbortSignal,
): Promise<boolean> {
	const { getGitHubAppUserClientByUserId } = await import("../auth-runtime");
	const appUserOctokit = await getGitHubAppUserClientByUserId(userId);
	if (!appUserOctokit) {
		return false;
	}

	if (installation.repositorySelection !== "all") {
		const repositories = await listViewerInstallationRepositories(
			userId,
			appUserOctokit,
			installation.id,
		);
		return repositories.some((repository) =>
			repositoryMatchesInstallationRepository(repository, params),
		);
	}

	try {
		const response = await appUserOctokit.rest.repos.get({
			owner: params.owner,
			repo: params.repo,
			request: { signal },
		});
		// A renamed or transferred repository answers under its new name.
		return repositoryMatchesInstallationRepository(response.data, params);
	} catch (error) {
		if (error instanceof RequestError && error.status === 404) {
			return false;
		}
		throw error;
	}
}

/**
 * Whether this viewer can read a repository of an installation they see.
 * The answer is kept per viewer and repository for `IDENTITY_MEMORY_TTL_MS`,
 * so the reads that follow reuse it. Rejects when GitHub gave no answer (the
 * check failed or timed out); nothing is kept then, and the next read asks
 * again.
 */
export function checkViewerCanReadInstallationRepository(
	context: GitHubContext,
	installation: GitHubAppInstallation,
	params: RepositoryInput,
): Promise<boolean> {
	const userId = context.session.user.id;
	const repository = `${params.owner}/${params.repo}`.toLowerCase();
	return readIdentityThroughMemory<boolean>({
		userId,
		resource: `repositoryRead:${installation.id}:${repository}`,
		load: () =>
			withGitHubOperationTimeout(
				`github repository access check ${repository}`,
				REPOSITORY_ACCESS_CHECK_TIMEOUT_MS,
				(signal) =>
					askGitHubWhetherViewerCanRead(userId, installation, params, signal),
			),
	});
}

/** For choosing a token: no answer counts as "no", so the viewer's is used. */
async function viewerCanReadInstallationRepository(
	context: GitHubContext,
	installation: GitHubAppInstallation,
	params: RepositoryInput,
): Promise<boolean> {
	try {
		return await checkViewerCanReadInstallationRepository(
			context,
			installation,
			params,
		);
	} catch (error) {
		console.error(
			"[github-access] repository access check failed, using OAuth token",
			`${params.owner}/${params.repo}`,
			error,
		);
		return false;
	}
}

function findGitHubAppInstallationForOwner(
	installations: GitHubAppInstallation[],
	owner: string,
) {
	const normalizedOwner = owner.toLowerCase();
	return installations.find(
		(candidate) =>
			!candidate.suspendedAt &&
			(candidate.account.login.toLowerCase() === normalizedOwner ||
				(candidate.targetType === "User" &&
					candidate.account.login.toLowerCase() === normalizedOwner)),
	);
}

async function getGitHubUserContextForOwner(owner: string) {
	return getOrCreateCachedContext(`user-owner:${owner}`, async () => {
		const context = await getGitHubContext();
		if (!context) {
			return null;
		}

		try {
			const { getGitHubAppUserClientByUserId } = await import(
				"../auth-runtime"
			);
			const appUserOctokit = await getGitHubAppUserClientByUserId(
				context.session.user.id,
			);
			if (!appUserOctokit) {
				debug(
					"github-access",
					"no app user client for writes, using OAuth token",
					{ owner },
				);
				return context;
			}

			const installation = findGitHubAppInstallationForOwner(
				await getRoutingInstallations(context.session.user.id),
				owner,
			);
			if (!installation) {
				debug(
					"github-access",
					"no installation for owner, using OAuth token for writes",
					{ owner },
				);
				return context;
			}

			debug("github-access", "using app user token for writes", { owner });
			return {
				...context,
				octokit: appUserOctokit,
			};
		} catch (error) {
			console.error(
				"[github-access] failed to resolve user context, falling back to OAuth token",
				owner,
				error,
			);
			return context;
		}
	});
}

export async function getGitHubUserContextForRepository(input: {
	owner: string;
	repo: string;
}) {
	return getGitHubUserContextForOwner(input.owner);
}

export function repositoryMatchesInstallationRepository(
	repository: InstallationRepositoryPayload,
	params: RepositoryInput,
) {
	const fullName = repository.full_name?.toLowerCase();
	if (fullName === `${params.owner}/${params.repo}`.toLowerCase()) {
		return true;
	}

	return (
		repository.owner?.login !== undefined &&
		repository.name !== undefined &&
		normalizeLogin(repository.owner.login) === normalizeLogin(params.owner) &&
		normalizeLogin(repository.name) === normalizeLogin(params.repo)
	);
}

export function filterItemsByInstallationAccess<
	T extends { repository: RepositoryRef },
>(items: T[], accessIndex: GitHubInstallationAccessIndex): T[] {
	const filtered = items.filter((item) =>
		isRepoVisibleWithInstallationAccess(
			accessIndex,
			item.repository.owner,
			item.repository.name,
			item.repository.isPrivate,
		),
	);

	const removedCount = items.length - filtered.length;
	if (removedCount > 0) {
		const removed = items
			.filter(
				(item) =>
					!isRepoVisibleWithInstallationAccess(
						accessIndex,
						item.repository.owner,
						item.repository.name,
						item.repository.isPrivate,
					),
			)
			.map((item) => item.repository.fullName);

		debug("installation-access", "filtered items by access scope", {
			total: items.length,
			kept: filtered.length,
			removed: removedCount,
			removedRepos: [...new Set(removed)],
		});
	}

	return filtered;
}

export function filterMyPullsResult(
	result: MyPullsResult,
	accessIndex: GitHubInstallationAccessIndex,
): MyPullsResult {
	return {
		...result,
		reviewRequested: filterItemsByInstallationAccess(
			result.reviewRequested,
			accessIndex,
		),
		assigned: filterItemsByInstallationAccess(result.assigned, accessIndex),
		authored: filterItemsByInstallationAccess(result.authored, accessIndex),
		mentioned: filterItemsByInstallationAccess(result.mentioned, accessIndex),
		involved: filterItemsByInstallationAccess(result.involved, accessIndex),
	};
}

function toInstallationTargetType(
	value: string | undefined,
): GitHubInstallationTargetType {
	if (value === "Organization" || value === "User") {
		return value;
	}

	return "Unknown";
}
