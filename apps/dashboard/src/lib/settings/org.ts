export type OrgRole = "admin" | "member";

export type DefaultRepoPermission = "none" | "read" | "write" | "admin";

export type OrgProfileDraft = {
	name: string;
	description: string;
	email: string;
	blog: string;
	location: string;
	defaultRepositoryPermission: DefaultRepoPermission;
	membersCanCreateRepositories: boolean;
};

export type OrgSettings = OrgProfileDraft & {
	login: string;
	avatarUrl: string;
	htmlUrl: string;
};

export type RawOrg = {
	login: string;
	avatar_url: string;
	html_url: string;
	name?: string | null;
	description?: string | null;
	email?: string | null;
	blog?: string | null;
	location?: string | null;
	default_repository_permission?: string | null;
	members_can_create_repositories?: boolean | null;
};

const DEFAULT_PERMISSIONS: readonly DefaultRepoPermission[] = [
	"none",
	"read",
	"write",
	"admin",
];

export const DEFAULT_PERMISSION_OPTIONS: {
	value: DefaultRepoPermission;
	label: string;
}[] = [
	{ value: "none", label: "No permission" },
	{ value: "read", label: "Read" },
	{ value: "write", label: "Write" },
	{ value: "admin", label: "Admin" },
];

function parseDefaultPermission(
	value: string | null | undefined,
): DefaultRepoPermission {
	return DEFAULT_PERMISSIONS.find((entry) => entry === value) ?? "read";
}

/** Org fields beyond the public profile are only sent to the org's admins. */
export function mapOrgSettings(raw: RawOrg): OrgSettings {
	return {
		login: raw.login,
		avatarUrl: raw.avatar_url,
		htmlUrl: raw.html_url,
		name: raw.name ?? "",
		description: raw.description ?? "",
		email: raw.email ?? "",
		blog: raw.blog ?? "",
		location: raw.location ?? "",
		defaultRepositoryPermission: parseDefaultPermission(
			raw.default_repository_permission,
		),
		membersCanCreateRepositories: raw.members_can_create_repositories ?? true,
	};
}

export function orgDraftFromSettings(settings: OrgSettings): OrgProfileDraft {
	return {
		name: settings.name,
		description: settings.description,
		email: settings.email,
		blog: settings.blog,
		location: settings.location,
		defaultRepositoryPermission: settings.defaultRepositoryPermission,
		membersCanCreateRepositories: settings.membersCanCreateRepositories,
	};
}

const ORG_API_FIELDS: Record<keyof OrgProfileDraft, string> = {
	name: "name",
	description: "description",
	email: "email",
	blog: "blog",
	location: "location",
	defaultRepositoryPermission: "default_repository_permission",
	membersCanCreateRepositories: "members_can_create_repositories",
};

function normalizeOrgDraft(draft: OrgProfileDraft): OrgProfileDraft {
	return {
		...draft,
		name: draft.name.trim(),
		description: draft.description.trim(),
		email: draft.email.trim(),
		blog: draft.blog.trim(),
		location: draft.location.trim(),
	};
}

export function changedOrgFields(
	saved: OrgProfileDraft,
	draft: OrgProfileDraft,
): Partial<OrgProfileDraft> {
	const next = normalizeOrgDraft(draft);
	const changes: Record<string, unknown> = {};
	for (const key of Object.keys(ORG_API_FIELDS) as (keyof OrgProfileDraft)[]) {
		if (next[key] !== saved[key]) changes[key] = next[key];
	}
	return changes as Partial<OrgProfileDraft>;
}

export function toOrgApiPatch(changes: Partial<OrgProfileDraft>) {
	const patch: Record<string, string | boolean> = {};
	for (const [key, value] of Object.entries(changes)) {
		const apiName = ORG_API_FIELDS[key as keyof OrgProfileDraft];
		if (apiName !== undefined && value !== undefined) patch[apiName] = value;
	}
	return patch;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isHttpUrl(value: string) {
	try {
		const url = new URL(value);
		return url.protocol === "http:" || url.protocol === "https:";
	} catch {
		return false;
	}
}

export function validateOrgDraft(draft: OrgProfileDraft) {
	if (draft.email.trim() !== "" && !EMAIL.test(draft.email.trim())) {
		return "Enter a valid email address.";
	}
	if (draft.blog.trim() !== "" && !isHttpUrl(draft.blog.trim())) {
		return "The website must be an http or https URL.";
	}
	if (draft.description.trim().length > 160) {
		return "The description can be at most 160 characters.";
	}
	return null;
}

export type OrgMember = {
	login: string;
	avatarUrl: string;
	role: OrgRole;
};

export type OrgInvitation = {
	id: number;
	label: string;
	role: OrgRole;
};

export type RawOrgMember = { login: string; avatar_url: string };

export type RawOrgInvitation = {
	id: number;
	login?: string | null;
	email?: string | null;
	role?: string;
};

export function mapOrgMembers(
	members: RawOrgMember[],
	admins: RawOrgMember[],
): OrgMember[] {
	const adminLogins = new Set(admins.map((admin) => admin.login.toLowerCase()));
	return members
		.map(
			(member): OrgMember => ({
				login: member.login,
				avatarUrl: member.avatar_url,
				role: adminLogins.has(member.login.toLowerCase()) ? "admin" : "member",
			}),
		)
		.sort((a, b) => {
			if (a.role !== b.role) return a.role === "admin" ? -1 : 1;
			return a.login.localeCompare(b.login);
		});
}

export function mapOrgInvitation(raw: RawOrgInvitation): OrgInvitation | null {
	const label = raw.login ?? raw.email;
	if (!label) return null;
	return {
		id: raw.id,
		label,
		role: raw.role === "admin" ? "admin" : "member",
	};
}

export type OrgMembers = {
	members: OrgMember[];
	invitations: OrgInvitation[];
};

export type Invitee =
	| { kind: "login"; login: string }
	| { kind: "email"; email: string };

const LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

export function parseInvitee(input: string): Invitee | null {
	const value = input.trim().replace(/^@/, "");
	if (EMAIL.test(value)) return { kind: "email", email: value };
	return LOGIN.test(value) ? { kind: "login", login: value } : null;
}

export type OrgTeamPrivacy = "closed" | "secret";

export type OrgTeamSummary = {
	id: number;
	slug: string;
	name: string;
	description: string;
	privacy: OrgTeamPrivacy;
	membersCount: number | null;
	reposCount: number | null;
	htmlUrl: string | null;
};

export type RawOrgTeam = {
	id: number;
	slug: string;
	name: string;
	description?: string | null;
	privacy?: string;
	members_count?: number;
	repos_count?: number;
	html_url?: string;
};

export function mapOrgTeam(raw: RawOrgTeam): OrgTeamSummary {
	return {
		id: raw.id,
		slug: raw.slug,
		name: raw.name,
		description: raw.description ?? "",
		privacy: raw.privacy === "secret" ? "secret" : "closed",
		membersCount: raw.members_count ?? null,
		reposCount: raw.repos_count ?? null,
		htmlUrl: raw.html_url ?? null,
	};
}

export type OrgTeamDraft = {
	name: string;
	description: string;
	privacy: OrgTeamPrivacy;
};

export function validateOrgTeamDraft(
	draft: OrgTeamDraft,
	otherNames: readonly string[],
) {
	const name = draft.name.trim();
	if (name === "") return "Enter a team name.";
	if (otherNames.some((other) => other.toLowerCase() === name.toLowerCase())) {
		return "A team with that name already exists.";
	}
	return null;
}

export type TeamRole = "member" | "maintainer";

export type OrgTeamMember = {
	login: string;
	avatarUrl: string;
	role: TeamRole;
};

export type RawTeamMember = { login: string; avatar_url: string };

export function mapTeamMembers(
	members: RawTeamMember[],
	maintainers: RawTeamMember[],
): OrgTeamMember[] {
	const maintainerLogins = new Set(
		maintainers.map((maintainer) => maintainer.login.toLowerCase()),
	);
	return members
		.map(
			(member): OrgTeamMember => ({
				login: member.login,
				avatarUrl: member.avatar_url,
				role: maintainerLogins.has(member.login.toLowerCase())
					? "maintainer"
					: "member",
			}),
		)
		.sort((a, b) => {
			if (a.role !== b.role) return a.role === "maintainer" ? -1 : 1;
			return a.login.localeCompare(b.login);
		});
}

export type OrgSettingsCapabilities = {
	manage: boolean;
};

export function orgSettingsCapabilities(
	role: OrgRole | null,
): OrgSettingsCapabilities {
	return { manage: role === "admin" };
}
