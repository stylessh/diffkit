import type { RepoViewerPermission } from "../github.types";

export type RepoPermission = NonNullable<RepoViewerPermission["permission"]>;

const RANK: Record<RepoPermission, number> = {
	READ: 0,
	TRIAGE: 1,
	WRITE: 2,
	MAINTAIN: 3,
	ADMIN: 4,
};

export type RepoSettingsCapabilities = {
	openSettings: boolean;
	manageLabels: boolean;
	administer: boolean;
};

export function repoSettingsCapabilities(
	permission: RepoPermission | null,
): RepoSettingsCapabilities {
	const rank = permission === null ? -1 : RANK[permission];
	return {
		openSettings: rank >= RANK.TRIAGE,
		manageLabels: rank >= RANK.TRIAGE,
		administer: rank >= RANK.ADMIN,
	};
}
