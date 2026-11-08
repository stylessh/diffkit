/**
 * State behind the repository and organization settings endpoints that emulate
 * has no collections for: Actions variables, invitations, rulesets, webhook
 * delivery history, per-repository team roles and a few flags emulate drops.
 */
import type { Entity, Store } from "@emulators/core";
import type { GitHubCollaborator } from "@emulators/github";

export type RepoRole = "read" | "triage" | "write" | "maintain" | "admin";

const ROLE_BY_PERMISSION: Record<GitHubCollaborator["permission"], RepoRole> = {
	pull: "read",
	triage: "triage",
	push: "write",
	maintain: "maintain",
	admin: "admin",
};

export function roleOf(permission: GitHubCollaborator["permission"]) {
	return ROLE_BY_PERMISSION[permission];
}

export function permissionOf(role: RepoRole) {
	const entry = Object.entries(ROLE_BY_PERMISSION).find(
		([, candidate]) => candidate === role,
	);
	return (entry?.[0] ?? "pull") as GitHubCollaborator["permission"];
}

export function isPermission(
	value: unknown,
): value is GitHubCollaborator["permission"] {
	return typeof value === "string" && value in ROLE_BY_PERMISSION;
}

export function isRole(value: unknown): value is RepoRole {
	return (
		typeof value === "string" &&
		Object.values(ROLE_BY_PERMISSION).includes(value as RepoRole)
	);
}

export interface RepoFlagsRow extends Entity {
	repo_id: number;
	allow_update_branch: boolean;
}

export interface VariableRow extends Entity {
	repo_id: number;
	name: string;
	value: string;
}

export interface RepoInvitationRow extends Entity {
	repo_id: number;
	invitee_id: number;
	inviter_id: number;
	permissions: RepoRole;
}

export type OrgInvitationRole = "admin" | "direct_member" | "billing_manager";

export interface OrgInvitationRow extends Entity {
	org_id: number;
	login: string | null;
	email: string | null;
	role: OrgInvitationRole;
	inviter_id: number;
	team_ids: number[];
}

export interface RulesetRow extends Entity {
	repo_id: number;
	name: string;
	target: "branch" | "tag" | "push";
	enforcement: "active" | "disabled" | "evaluate";
	conditions: { ref_name: { include: string[]; exclude: string[] } };
	rules: Array<{ type: string; parameters?: Record<string, unknown> }>;
	bypass_actors: Array<{
		actor_id: number | null;
		actor_type: string;
		bypass_mode: string;
	}>;
}

export interface HookDeliveryRow extends Entity {
	hook_id: number;
	guid: string;
	delivered_at: string;
	redelivery: boolean;
	duration: number;
	status: string;
	status_code: number;
	event: string;
	action: string | null;
	payload: Record<string, unknown>;
	/** Id of the dispatcher delivery this row mirrors, for hooks that really fire. */
	source_id: number | null;
}

export interface TeamRepoRoleRow extends Entity {
	team_id: number;
	repo_id: number;
	permission: GitHubCollaborator["permission"];
}

export interface ProtectionFlagsRow extends Entity {
	repo_id: number;
	branch_name: string;
	required_conversation_resolution: boolean;
	lock_branch: boolean;
}

export interface OrgSettingsRow extends Entity {
	org_id: number;
	two_factor_requirement_enabled: boolean;
}

export function getSettingsStore(store: Store) {
	return {
		repoFlags: store.collection<RepoFlagsRow>("diffkit.repo_flags", [
			"repo_id",
		]),
		variables: store.collection<VariableRow>("diffkit.variables", ["repo_id"]),
		repoInvitations: store.collection<RepoInvitationRow>(
			"diffkit.repo_invitations",
			["repo_id"],
		),
		orgInvitations: store.collection<OrgInvitationRow>(
			"diffkit.org_invitations",
			["org_id"],
		),
		rulesets: store.collection<RulesetRow>("diffkit.rulesets", ["repo_id"]),
		hookDeliveries: store.collection<HookDeliveryRow>(
			"diffkit.hook_deliveries",
			["hook_id"],
		),
		teamRepoRoles: store.collection<TeamRepoRoleRow>(
			"diffkit.team_repo_roles",
			["team_id", "repo_id"],
		),
		protectionFlags: store.collection<ProtectionFlagsRow>(
			"diffkit.protection_flags",
			["repo_id"],
		),
		orgSettings: store.collection<OrgSettingsRow>("diffkit.org_settings", [
			"org_id",
		]),
	};
}

export type SettingsStore = ReturnType<typeof getSettingsStore>;
