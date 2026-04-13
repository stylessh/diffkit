import { useSyncExternalStore } from "react";

export type WarningAction =
	| {
			kind: "link";
			label: string;
			href: string;
	  }
	| {
			kind: "github-access";
			label: string;
			href?: string;
			owner?: string;
			repo?: string;
	  };

export type WarningSeverity = "warning" | "error";

export interface Warning {
	id: string;
	message: string;
	severity?: WarningSeverity;
	dismissible?: boolean;
	action?: WarningAction;
}

let warnings: Warning[] = [];
const listeners = new Set<() => void>();

function emitChange() {
	for (const listener of listeners) {
		listener();
	}
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

function getSnapshot() {
	return warnings;
}

export function addWarning(warning: Warning) {
	if (warnings.some((w) => w.id === warning.id)) return;
	warnings = [...warnings, warning];
	emitChange();
}

export function removeWarning(id: string) {
	warnings = warnings.filter((w) => w.id !== id);
	emitChange();
}

export function useWarnings() {
	return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Surface warnings for organizations that returned FORBIDDEN due to
 * OAuth App access restrictions during search queries.
 */
export function surfaceForbiddenOrgWarnings(orgs: string[] | undefined) {
	if (!orgs || orgs.length === 0) return;

	for (const org of orgs) {
		addWarning({
			id: `forbidden-org:${org}`,
			message: `The ${org} organization has restricted third-party access. Configure access to include its repositories.`,
			dismissible: true,
			action: {
				kind: "github-access",
				label: "Configure access",
				owner: org,
			},
		});
	}
}

const GITHUB_API_TIMEOUT_WARNING_ID = "github-api-timeout";

/**
 * Surface a warning when GitHub API requests are timing out,
 * indicating GitHub may be experiencing issues.
 */
export function surfaceTimeoutWarning(timedOut: boolean | undefined) {
	if (!timedOut) {
		removeWarning(GITHUB_API_TIMEOUT_WARNING_ID);
		return;
	}

	addWarning({
		id: GITHUB_API_TIMEOUT_WARNING_ID,
		message:
			"Some requests are taking too long and timing out. Data may be incomplete.",
		severity: "error",
		dismissible: true,
	});
}

/**
 * Check a MutationResult for permission errors and surface a warning.
 * Call this client-side after a mutation returns.
 */
export function checkPermissionWarning(
	result: { ok: boolean; error?: string; installUrl?: string },
	repo: string,
) {
	if (!result.ok && result.error) {
		const isInsufficientPermissions = result.error.includes(
			"Insufficient permissions",
		);
		const isOrgRestriction = result.error.includes(
			"OAuth App access restrictions",
		);

		if (isInsufficientPermissions || isOrgRestriction) {
			const [owner = repo] = repo.split("/");

			addWarning({
				id: `permissions:${repo}`,
				message: isOrgRestriction
					? `The organization that owns ${repo} has restricted third-party access. You need to request or grant access.`
					: `Your GitHub App may not have sufficient permissions for ${repo}.`,
				dismissible: true,
				action: {
					kind: "github-access",
					label: "Configure access",
					href: result.installUrl,
					owner,
					repo,
				},
			});
		}
	}
}
