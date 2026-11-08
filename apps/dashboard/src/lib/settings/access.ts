export type RepoRole = "read" | "triage" | "write" | "maintain" | "admin";

export const REPO_ROLES: readonly {
	value: RepoRole;
	label: string;
	description: string;
}[] = [
	{ value: "read", label: "Read", description: "View and clone" },
	{ value: "triage", label: "Triage", description: "Manage issues and PRs" },
	{ value: "write", label: "Write", description: "Push to the repository" },
	{ value: "maintain", label: "Maintain", description: "Manage without admin" },
	{ value: "admin", label: "Admin", description: "Full access" },
];

const ROLE_BY_WORD: Record<string, RepoRole> = {
	read: "read",
	pull: "read",
	triage: "triage",
	write: "write",
	push: "write",
	maintain: "maintain",
	admin: "admin",
};

export function roleLabel(role: RepoRole) {
	return REPO_ROLES.find((entry) => entry.value === role)?.label ?? role;
}

export function parseRole(word: string | undefined | null): RepoRole | null {
	return word ? (ROLE_BY_WORD[word.toLowerCase()] ?? null) : null;
}

/** The collaborators API names the roles by the permission they grant. */
export function toApiPermission(role: RepoRole) {
	switch (role) {
		case "read":
			return "pull";
		case "write":
			return "push";
		default:
			return role;
	}
}

type RawPermissions = {
	admin?: boolean;
	maintain?: boolean;
	push?: boolean;
	triage?: boolean;
	pull?: boolean;
};

export type RawCollaborator = {
	login: string;
	avatar_url: string;
	role_name?: string;
	permissions?: RawPermissions;
};

export type RawInvitation = {
	id: number;
	invitee?: { login: string; avatar_url: string } | null;
	permissions?: string;
};

export type RawRepoTeam = {
	id: number;
	slug: string;
	name: string;
	description?: string | null;
	permission?: string;
	privacy?: string;
	html_url?: string;
};

function roleFromPermissions(permissions: RawPermissions | undefined) {
	if (permissions?.admin) return "admin";
	if (permissions?.maintain) return "maintain";
	if (permissions?.push) return "write";
	if (permissions?.triage) return "triage";
	return "read";
}

type CollaboratorBase = {
	login: string;
	avatarUrl: string;
	role: RepoRole;
	roleLabel: string;
};

export type RepoCollaborator =
	| ({ status: "active" } & CollaboratorBase)
	| ({ status: "pending"; invitationId: number } & CollaboratorBase);

/** An organization's custom role is named freely; its permission flags decide the built-in role. */
export function mapCollaborator(raw: RawCollaborator): RepoCollaborator {
	const builtIn = parseRole(raw.role_name);
	const role = builtIn ?? roleFromPermissions(raw.permissions);
	return {
		status: "active",
		login: raw.login,
		avatarUrl: raw.avatar_url,
		role,
		roleLabel: builtIn ? roleLabel(role) : (raw.role_name ?? roleLabel(role)),
	};
}

export function mapInvitation(raw: RawInvitation): RepoCollaborator | null {
	if (!raw.invitee) return null;
	const role = parseRole(raw.permissions) ?? "read";
	return {
		status: "pending",
		invitationId: raw.id,
		login: raw.invitee.login,
		avatarUrl: raw.invitee.avatar_url,
		role,
		roleLabel: roleLabel(role),
	};
}

export type RepoTeam = {
	id: number;
	slug: string;
	name: string;
	description: string | null;
	role: RepoRole;
	isSecret: boolean;
	htmlUrl: string | null;
};

export function mapRepoTeam(raw: RawRepoTeam): RepoTeam {
	return {
		id: raw.id,
		slug: raw.slug,
		name: raw.name,
		description: raw.description ?? null,
		role: parseRole(raw.permission) ?? "read",
		isSecret: raw.privacy === "secret",
		htmlUrl: raw.html_url ?? null,
	};
}

export type TeamOption = { slug: string; name: string };

export type RepoAccess = {
	collaborators: RepoCollaborator[];
	teams: RepoTeam[];
	teamsAvailable: boolean;
	addableTeams: TeamOption[];
};

export function sortCollaborators(list: RepoCollaborator[]) {
	return [...list].sort((a, b) => {
		if (a.status !== b.status) return a.status === "active" ? -1 : 1;
		return a.login.localeCompare(b.login);
	});
}
