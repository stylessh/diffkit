import type {
	OrgMembers,
	OrgSettings,
	OrgTeamMember,
	OrgTeamSummary,
} from "#/lib/settings/org";

export const SAMPLE_ORG_SETTINGS: OrgSettings = {
	login: "acme-labs",
	avatarUrl: "",
	htmlUrl: "",
	name: "Acme Labs",
	description: "Tools for teams that ship every day",
	email: "hello@acme.dev",
	blog: "https://acme.dev",
	location: "Berlin, Germany",
	defaultRepositoryPermission: "read",
	membersCanCreateRepositories: true,
};

export const SAMPLE_ORG_MEMBERS: OrgMembers = {
	members: [
		{ login: "octocat", avatarUrl: "", role: "admin" },
		{ login: "hubot", avatarUrl: "", role: "member" },
		{ login: "monalisa", avatarUrl: "", role: "member" },
		{ login: "defunkt", avatarUrl: "", role: "member" },
	],
	invitations: [],
};

const sampleTeam = (
	id: number,
	slug: string,
	name: string,
	description: string,
): OrgTeamSummary => ({
	id,
	slug,
	name,
	description,
	privacy: "closed",
	membersCount: null,
	reposCount: null,
	htmlUrl: null,
});

export const SAMPLE_ORG_TEAMS: OrgTeamSummary[] = [
	sampleTeam(1, "platform", "Platform", "Infrastructure and tooling"),
	sampleTeam(2, "design", "Design", "Product design and research"),
	sampleTeam(3, "frontend", "Frontend", "Web and desktop clients"),
];

export const SAMPLE_ORG_TEAM_MEMBERS: OrgTeamMember[] = [
	{ login: "octocat", avatarUrl: "", role: "maintainer" },
	{ login: "hubot", avatarUrl: "", role: "member" },
];
