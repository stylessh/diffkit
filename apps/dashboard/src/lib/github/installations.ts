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
} from "./client";
import { dedupeGitHubRead } from "./request-dedup";
import type { RepoCollaboratorsInput } from "./reviews";
import {
	type GitHubClient,
	type GitHubContext,
	type GitHubInstallationAccountPayload,
	type GitHubInstallationRepositoriesPayload,
	normalizeLogin,
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
	const PAGE_SIZE = 100;
	const firstResponse = await appUserOctokit.request(
		"GET /user/installations",
		{ per_page: PAGE_SIZE },
	);
	const firstPayload = firstResponse.data as GitHubUserInstallationsPayload;
	const firstPage = firstPayload.installations ?? [];
	const allRawInstallations = [...firstPage];

	if (firstPage.length >= PAGE_SIZE) {
		let page = 2;
		while (true) {
			const response = await appUserOctokit.request("GET /user/installations", {
				per_page: PAGE_SIZE,
				page,
			});
			const payload = response.data as GitHubUserInstallationsPayload;
			const pageItems = payload.installations ?? [];
			allRawInstallations.push(...pageItems);

			if (pageItems.length < PAGE_SIZE) {
				break;
			}
			page += 1;
		}
	}

	const installations = mapGitHubAppInstallations({
		installations: allRawInstallations,
	});
	debug("github-access", "loaded app installations", {
		count: installations.length,
		owners: installations.map((i) => i.account.login),
	});
	return {
		installations,
		installationsAvailable: true,
		appUserOctokit,
	};
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

export async function getInstallationAccessIndex(
	context: GitHubContext,
): Promise<GitHubInstallationAccessIndex> {
	try {
		const serializable =
			await dedupeGitHubRead<SerializableInstallationAccessIndex>({
				userId: context.session.user.id,
				resource: "installationAccess",
				params: null,
				fetcher: async () => {
					debug("installation-access", "fetching access index (cache miss)");
					const { installations, installationsAvailable, appUserOctokit } =
						await getGitHubAppUserInstallations(context.session.user.id);

					if (!installationsAvailable) {
						debug(
							"installation-access",
							"app-user token unavailable, index not available (fail-open)",
						);
						return {
							available: false,
							allAccessOwners: [],
							selectedRepos: [],
						};
					}

					debug("installation-access", "processing installations", {
						count: installations.length,
						owners: installations.map((i) => i.account.login),
					});

					const allAccessOwners: string[] = [];
					const selectedRepos: string[] = [];

					for (const installation of installations) {
						if (installation.suspendedAt) {
							debug("installation-access", "skipping suspended installation", {
								owner: installation.account.login,
								installationId: installation.id,
							});
							continue;
						}

						const ownerLogin = installation.account.login.toLowerCase();

						if (installation.repositorySelection === "all") {
							debug(
								"installation-access",
								`owner "${ownerLogin}" has "all" repo access`,
							);
							allAccessOwners.push(ownerLogin);
							continue;
						}

						if (installation.repositorySelection === "selected") {
							if (!appUserOctokit) {
								continue;
							}

							try {
								// Use the app-user client (not the OAuth client) —
								// this endpoint requires a GitHub App user-to-server token.
								const repos = await listPaginatedGitHubItems({
									request: (page) =>
										appUserOctokit.rest.apps.listInstallationReposForAuthenticatedUser(
											{
												installation_id: installation.id,
												page,
												per_page: 100,
											},
										),
									getItems: (payload) =>
										((payload as GitHubInstallationRepositoriesPayload)
											.repositories ?? []) as NonNullable<
											GitHubInstallationRepositoriesPayload["repositories"]
										>,
									label: `installation-access repos ${installation.id}`,
								});

								const repoNames: string[] = [];
								for (const repo of repos) {
									const fullName =
										repo.full_name ??
										(repo.owner?.login && repo.name
											? `${repo.owner.login}/${repo.name}`
											: null);
									if (fullName) {
										const normalized = fullName.toLowerCase();
										selectedRepos.push(normalized);
										repoNames.push(normalized);
									}
								}

								debug(
									"installation-access",
									`owner "${ownerLogin}" has "selected" repo access`,
									{
										installationId: installation.id,
										repoCount: repoNames.length,
										repos: repoNames,
									},
								);
							} catch (error) {
								console.error(
									`[installation-access] failed to list repos for installation ${installation.id}`,
									error,
								);
							}
						}
					}

					debug("installation-access", "access index built", {
						allAccessOwners,
						selectedRepoCount: selectedRepos.length,
						selectedRepos,
					});

					return {
						available: true,
						allAccessOwners,
						selectedRepos,
					};
				},
			});

		debug("installation-access", "resolved access index", {
			available: serializable.available,
			allAccessOwners: serializable.allAccessOwners,
			selectedRepoCount: serializable.selectedRepos.length,
			selectedRepos: serializable.selectedRepos,
		});

		return {
			available: serializable.available,
			allAccessOwners: new Set(serializable.allAccessOwners),
			selectedRepos: new Set(serializable.selectedRepos),
		};
	} catch (error) {
		// Transient failure (network, 500): fail open so one bad request doesn't
		// hide every private repo from the user.
		debug(
			"installation-access",
			"transient error building access index, failing open",
		);
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

export async function getGitHubContextForOwner(owner: string) {
	return getOrCreateCachedContext(`owner:${owner}`, async () => {
		const context = await getGitHubContext();
		if (!context) {
			return null;
		}

		const { installations } = await getGitHubAppUserInstallations(
			context.session.user.id,
		);
		const installation = findGitHubAppInstallationForOwner(
			installations,
			owner,
		);
		if (!installation) {
			debug("github-access", "no installation for owner, using OAuth token", {
				owner,
			});
			return context;
		}

		const installationContext = await getGitHubContextForInstallation(
			context,
			installation,
		);
		if (!installationContext) {
			console.error(
				"[github-access] installation client failed, falling back to OAuth token",
				owner,
			);
			return context;
		}

		return installationContext;
	});
}

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

			const { installations } = await getGitHubAppUserInstallations(
				context.session.user.id,
			);
			const installation = findGitHubAppInstallationForOwner(
				installations,
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
				installation.repositorySelection === "selected" &&
				!(await appInstallationHasRepositoryAccess(
					context,
					installation,
					input,
				))
			) {
				debug(
					"github-access",
					"installation does not include repo, using OAuth",
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

async function appInstallationHasRepositoryAccess(
	context: GitHubContext,
	installation: GitHubAppInstallation,
	params: RepoCollaboratorsInput,
) {
	if (installation.repositorySelection === "all") {
		return true;
	}

	if (installation.repositorySelection !== "selected") {
		return false;
	}

	try {
		const { getGitHubAppUserClientByUserId } = await import("../auth-runtime");
		const appUserOctokit = await getGitHubAppUserClientByUserId(
			context.session.user.id,
		);
		if (!appUserOctokit) {
			return false;
		}

		const repositories = await listPaginatedGitHubItems({
			request: (page) =>
				appUserOctokit.rest.apps.listInstallationReposForAuthenticatedUser({
					installation_id: installation.id,
					page,
					per_page: 100,
				}),
			getItems: (payload) =>
				((payload as GitHubInstallationRepositoriesPayload).repositories ??
					[]) as NonNullable<
					GitHubInstallationRepositoriesPayload["repositories"]
				>,
		});

		return repositories.some((repository) =>
			repositoryMatchesInstallationRepository(repository, params),
		);
	} catch {
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

			const { installations } = await getGitHubAppUserInstallations(
				context.session.user.id,
			);
			const installation = findGitHubAppInstallationForOwner(
				installations,
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
	repository: NonNullable<
		GitHubInstallationRepositoriesPayload["repositories"]
	>[number],
	params: RepoCollaboratorsInput,
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
