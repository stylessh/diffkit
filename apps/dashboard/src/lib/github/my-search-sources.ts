import type { GitHubAppInstallation } from "../github-access";
import {
	getRemainingSearchTimeoutMs,
	withGitHubOperationTimeout,
} from "./client";
import {
	getGitHubContextForInstallation,
	getRoutingInstallations,
} from "./installations";
import type { GitHubSearchOwnerScope } from "./search-query";
import { type GitHubContext, normalizeLogin } from "./shared";

export type GitHubGraphQLSearchSource = {
	label: string;
	context: GitHubContext;
	owner?: GitHubSearchOwnerScope;
	excludeOwners?: GitHubSearchOwnerScope[];
	/** Set when `context` reads with this installation's token, not the viewer's. */
	installation?: GitHubAppInstallation;
};

type InstallationSearchSource = {
	label: string;
	context: GitHubContext;
	owner: GitHubSearchOwnerScope;
	installation: GitHubAppInstallation;
};

export const MY_SEARCH_SOURCE_TIMEOUT_MS = 8_000;

/**
 * Persist orgs that returned an OAuth restriction so the OAuth fallback can
 * skip them on future fetches (see `getMySearchSources`). Awaited inline —
 * the worker is configured with `no_handle_cross_request_promise_resolution`
 * so a fire-and-forget write would race the response and get cancelled.
 * Errors are swallowed: this is best-effort optimization, not correctness.
 */
export async function persistForbiddenOrgs(userId: string, orgs: string[]) {
	try {
		const { recordForbiddenOrgs } = await import("../forbidden-orgs-store");
		await recordForbiddenOrgs(userId, orgs);
	} catch (error) {
		console.error("[github-search] failed to persist forbidden orgs", error);
	}
}

export function extractForbiddenOrg(error: unknown): string | null {
	const message = error instanceof Error ? error.message : String(error ?? "");
	if (
		!message.includes("OAuth App access restrictions") &&
		!message.includes("FORBIDDEN")
	) {
		return null;
	}
	const match = message.match(/the `([^`]+)` organization/);
	return match?.[1] ?? null;
}

function ownerScopeKey(scope: GitHubSearchOwnerScope) {
	return `${scope.targetType}:${normalizeLogin(scope.login)}`;
}

function toSearchOwnerScope(
	installation: GitHubAppInstallation,
): GitHubSearchOwnerScope | null {
	if (
		installation.suspendedAt ||
		(installation.targetType !== "Organization" &&
			installation.targetType !== "User")
	) {
		return null;
	}

	return {
		login: installation.account.login,
		targetType: installation.targetType,
	};
}

function addExcludedOwnerScope(
	excludedOwners: Map<string, GitHubSearchOwnerScope>,
	scope: GitHubSearchOwnerScope,
) {
	excludedOwners.set(ownerScopeKey(scope), scope);
}

async function toInstallationSource(
	context: GitHubContext,
	installation: GitHubAppInstallation,
	deadlineAt: number,
): Promise<InstallationSearchSource | null> {
	const owner = toSearchOwnerScope(installation);
	if (!owner) {
		return null;
	}

	const installationContext = await withGitHubOperationTimeout(
		`github installation context ${installation.id}`,
		getRemainingSearchTimeoutMs(deadlineAt, MY_SEARCH_SOURCE_TIMEOUT_MS),
		() => getGitHubContextForInstallation(context, installation),
	).catch((error) => {
		console.error(
			"[github-search] failed to create installation source",
			installation.account.login,
			error,
		);
		return null;
	});
	if (!installationContext) {
		return null;
	}

	return {
		label: `installation:${installation.id}:${owner.login}`,
		context: installationContext,
		owner,
		installation,
	};
}

export async function getMySearchSources(
	context: GitHubContext,
	viewerLogin: string,
	deadlineAt: number,
): Promise<GitHubGraphQLSearchSource[]> {
	const installations = await withGitHubOperationTimeout(
		"github search source discovery",
		getRemainingSearchTimeoutMs(deadlineAt, MY_SEARCH_SOURCE_TIMEOUT_MS),
		() => getRoutingInstallations(context.session.user.id),
	).catch((error): GitHubAppInstallation[] => {
		console.error("[github-search] failed to discover search sources", error);
		return [];
	});

	const installationSources = await Promise.all(
		installations.map((installation) =>
			toInstallationSource(context, installation, deadlineAt),
		),
	);
	const sources = installationSources.filter(
		(source): source is InstallationSearchSource => source !== null,
	);
	const excludedOAuthOwners = new Map<string, GitHubSearchOwnerScope>();
	for (const { installation, owner } of sources) {
		const coversViewerAccount =
			owner.targetType === "User" &&
			installation.repositorySelection === "all" &&
			normalizeLogin(owner.login) === normalizeLogin(viewerLogin);
		if (owner.targetType === "Organization" || coversViewerAccount) {
			addExcludedOwnerScope(excludedOAuthOwners, owner);
		}
	}

	// Seed the OAuth fallback's exclusion list with orgs we already know are
	// blocked by an OAuth App restriction. Without this we'd re-issue the same
	// failing search on every reload — surfacing the "restricted third-party
	// access" warning and burning per-source timeout budget.
	//
	// Self-heal: if the user has now installed the app on an org that was
	// previously forbidden, drop the persisted entry so we treat it normally
	// going forward.
	const installedOrgKeys = new Set(
		installations.map((installation) =>
			normalizeLogin(installation.account.login),
		),
	);
	try {
		const { getForbiddenOrgsForUser, clearForbiddenOrgsForUser } = await import(
			"../forbidden-orgs-store"
		);
		const knownForbiddenOrgs = await getForbiddenOrgsForUser(
			context.session.user.id,
		);
		const stillForbidden: string[] = [];
		const recovered: string[] = [];
		for (const org of knownForbiddenOrgs) {
			if (installedOrgKeys.has(normalizeLogin(org))) {
				recovered.push(org);
			} else {
				stillForbidden.push(org);
			}
		}
		if (recovered.length > 0) {
			try {
				await clearForbiddenOrgsForUser(context.session.user.id, recovered);
			} catch (error) {
				console.error(
					"[github-search] failed to clear recovered forbidden orgs",
					error,
				);
			}
		}
		for (const org of stillForbidden) {
			addExcludedOwnerScope(excludedOAuthOwners, {
				login: org,
				targetType: "Organization",
			});
		}
	} catch (error) {
		console.error("[github-search] failed to load known forbidden orgs", error);
	}

	return [
		...sources,
		{
			label: "oauth:fallback",
			context,
			excludeOwners: [...excludedOAuthOwners.values()],
		},
	];
}
