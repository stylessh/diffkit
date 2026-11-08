/**
 * Organization settings: profile fields, member roles, pending invitations
 * and teams. Roles follow GitHub: only a maintainer of the org's "Members"
 * team is an owner, so promoting someone to team maintainer elsewhere does not
 * make them one.
 */
import type { Next } from "@emulators/core";
import type { GitHubOrg } from "@emulators/github";
import type { ShimContext } from "../server.ts";
import {
	isPermission,
	type OrgInvitationRole,
	type OrgInvitationRow,
} from "../store-settings.ts";
import {
	apiUserJson,
	getViewer,
	notFound,
	type ShimRequestContext,
} from "./common.ts";
import { encodeNodeId } from "./enrich.ts";
import {
	guardOrg,
	invalidField,
	isResponse,
	orgRole,
	pageWithLinks,
	passThrough,
	permissionFlags,
	readBody,
	settingsStores,
	teamJson,
	wrap,
} from "./settings-common.ts";

const INVITATION_ROLES: OrgInvitationRole[] = [
	"admin",
	"direct_member",
	"billing_manager",
];
const BASE_PERMISSIONS = ["read", "write", "admin", "none"];

export function registerOrgSettingsShims(context: ShimContext) {
	const { app, baseUrl } = context;

	const orgBrief = (org: GitHubOrg) => ({
		login: org.login,
		id: org.id,
		node_id: org.node_id,
		url: `${baseUrl}/orgs/${org.login}`,
		repos_url: `${baseUrl}/orgs/${org.login}/repos`,
		events_url: `${baseUrl}/orgs/${org.login}/events`,
		hooks_url: `${baseUrl}/orgs/${org.login}/hooks`,
		issues_url: `${baseUrl}/orgs/${org.login}/issues`,
		members_url: `${baseUrl}/orgs/${org.login}/members{/member}`,
		public_members_url: `${baseUrl}/orgs/${org.login}/public_members{/member}`,
		avatar_url: `${baseUrl}/avatars/u/${org.login}`,
		description: org.description,
	});

	const decorateOrg = (c: ShimRequestContext, orgJson: { id: number }) => {
		const { gh, settings } = settingsStores(context);
		const org = gh.orgs.get(orgJson.id);
		const viewer = getViewer(gh, c);
		if (!org) {
			return orgJson;
		}
		const members = new Set(
			gh.teams
				.findBy("org_id", org.id)
				.flatMap((team) =>
					gh.teamMembers.findBy("team_id", team.id).map((row) => row.user_id),
				),
		).size;
		return {
			...orgJson,
			two_factor_requirement_enabled:
				settings.orgSettings.findOneBy("org_id", org.id)
					?.two_factor_requirement_enabled ?? false,
			...(viewer && orgRole(gh, org.id, viewer.id) === "admin"
				? {
						plan: {
							name: "team",
							space: 976_562_499,
							private_repos: 999_999,
							filled_seats: members,
							seats: members + 2,
						},
					}
				: {}),
		};
	};

	wrap(context, "GET", "/orgs/:org", async (c, next) => {
		await passThrough<{ id: number }>(c, next, (org) => decorateOrg(c, org));
		return undefined;
	});

	wrap(context, "PATCH", "/orgs/:org", async (c, next) => {
		const org = guardOrg(context, c, "admin");
		if (isResponse(org)) {
			return org;
		}
		const body = await readBody(c);
		if (
			"default_repository_permission" in body &&
			!BASE_PERMISSIONS.includes(String(body.default_repository_permission))
		) {
			return invalidField(c, "Organization", "default_repository_permission");
		}
		for (const field of [
			"members_can_create_repositories",
			"two_factor_requirement_enabled",
		]) {
			if (field in body && typeof body[field] !== "boolean") {
				return invalidField(c, "Organization", field);
			}
		}
		await passThrough<{ id: number }>(c, next, (json) => {
			const { gh, settings } = settingsStores(context);
			if (typeof body.blog === "string") {
				gh.orgs.update(org.id, { blog: body.blog });
			}
			if (typeof body.two_factor_requirement_enabled === "boolean") {
				const row = settings.orgSettings.findOneBy("org_id", org.id);
				if (row) {
					settings.orgSettings.update(row.id, {
						two_factor_requirement_enabled: body.two_factor_requirement_enabled,
					});
				} else {
					settings.orgSettings.insert({
						org_id: org.id,
						two_factor_requirement_enabled: body.two_factor_requirement_enabled,
					});
				}
			}
			return {
				...decorateOrg(c, json),
				blog: gh.orgs.get(org.id)?.blog ?? "",
			};
		});
		return undefined;
	});

	const membershipJson = (
		org: GitHubOrg,
		userId: number,
		state: "active" | "pending" = "active",
	) => {
		const { gh } = settingsStores(context);
		const user = gh.users.get(userId);
		return {
			url: `${baseUrl}/orgs/${org.login}/memberships/${user?.login ?? ""}`,
			state,
			role: orgRole(gh, org.id, userId) ?? "member",
			organization_url: `${baseUrl}/orgs/${org.login}`,
			organization: orgBrief(org),
			user: user ? apiUserJson(user, baseUrl) : null,
		};
	};

	app.get("/user/memberships/orgs/:org", (c) => {
		const org = guardOrg(context, c);
		if (isResponse(org)) {
			return org;
		}
		const viewer = getViewer(settingsStores(context).gh, c);
		return viewer ? c.json(membershipJson(org, viewer.id)) : notFound(c);
	});

	app.get("/orgs/:org/members", (c) => {
		const org = guardOrg(context, c);
		if (isResponse(org)) {
			return org;
		}
		const role = (c.req.query("role") ?? "all").toLowerCase();
		if (!["all", "admin", "member"].includes(role)) {
			return invalidField(c, "Organization", "role");
		}
		const { gh } = settingsStores(context);
		const ids = new Set(
			gh.teams
				.findBy("org_id", org.id)
				.flatMap((team) =>
					gh.teamMembers.findBy("team_id", team.id).map((row) => row.user_id),
				),
		);
		const users = [...ids]
			.sort((a, b) => a - b)
			.flatMap((id) => gh.users.get(id) ?? [])
			.filter(
				(user) => role === "all" || orgRole(gh, org.id, user.id) === role,
			);
		return c.json(
			pageWithLinks(c, users).map((user) => apiUserJson(user, baseUrl)),
		);
	});

	type MembershipJson = { role: string; user: { id: number } };
	const ownerRole = (org: GitHubOrg) => (json: MembershipJson) => ({
		...json,
		role:
			orgRole(settingsStores(context).gh, org.id, json.user.id) ?? json.role,
	});

	wrap(context, "GET", "/orgs/:org/memberships/:username", async (c, next) => {
		const org = settingsStores(context).gh.orgs.findOneBy(
			"login",
			c.req.param("org"),
		);
		await passThrough<MembershipJson>(
			c,
			next,
			org ? ownerRole(org) : undefined,
		);
		return undefined;
	});

	wrap(context, "PUT", "/orgs/:org/memberships/:username", async (c, next) => {
		const org = guardOrg(context, c, "admin");
		if (isResponse(org)) {
			return org;
		}
		await passThrough<MembershipJson>(c, next, ownerRole(org));
		return undefined;
	});

	wrap(context, "DELETE", "/orgs/:org/members/:username", (c, next) => {
		const org = guardOrg(context, c, "admin");
		return Promise.resolve(
			isResponse(org) ? org : next().then(() => undefined),
		);
	});

	const invitationJson = (org: GitHubOrg, row: OrgInvitationRow) => {
		const { gh } = settingsStores(context);
		const inviter = gh.users.get(row.inviter_id);
		return {
			id: row.id,
			login: row.login,
			node_id: encodeNodeId("OrganizationInvitation", row.id),
			email: row.email,
			role: row.role,
			created_at: row.created_at,
			failed_at: null,
			failed_reason: null,
			inviter: inviter ? apiUserJson(inviter, baseUrl) : null,
			team_count: row.team_ids.length,
			invitation_teams_url: `${baseUrl}/orgs/${org.login}/invitations/${row.id}/teams`,
			invitation_source: "member",
		};
	};

	app.get("/orgs/:org/invitations", (c) => {
		const org = guardOrg(context, c, "admin");
		if (isResponse(org)) {
			return org;
		}
		const role = c.req.query("role");
		const rows = settingsStores(context)
			.settings.orgInvitations.findBy("org_id", org.id)
			.filter((row) => !role || role === "all" || row.role === role)
			.sort((a, b) => a.id - b.id);
		return c.json(
			pageWithLinks(c, rows).map((row) => invitationJson(org, row)),
		);
	});

	app.post("/orgs/:org/invitations", async (c) => {
		const org = guardOrg(context, c, "admin");
		if (isResponse(org)) {
			return org;
		}
		const { gh, settings } = settingsStores(context);
		const body = await readBody(c);
		const role = body.role ?? "direct_member";
		if (!INVITATION_ROLES.includes(role as OrgInvitationRole)) {
			return invalidField(c, "OrganizationInvitation", "role");
		}
		const invitee =
			typeof body.invitee_id === "number"
				? gh.users.get(body.invitee_id)
				: typeof body.login === "string"
					? gh.users.findOneBy("login", body.login)
					: undefined;
		const email = typeof body.email === "string" ? body.email.trim() : null;
		const hasTarget = body.invitee_id !== undefined || body.login !== undefined;
		if ((hasTarget && !invitee) || (!hasTarget && !email)) {
			return invalidField(
				c,
				"OrganizationInvitation",
				hasTarget ? "invitee_id" : "email",
			);
		}
		const known =
			invitee ?? gh.users.all().find((user) => user.email === email);
		const pending = settings.orgInvitations.findBy("org_id", org.id);
		const alreadyThere = known && orgRole(gh, org.id, known.id) !== null;
		const alreadyInvited = pending.some((row) =>
			invitee ? row.login === invitee.login : row.email === email,
		);
		if (alreadyThere || alreadyInvited) {
			return invalidField(
				c,
				"OrganizationInvitation",
				invitee ? "invitee_id" : "email",
				"already_exists",
			);
		}
		const teamIds = Array.isArray(body.team_ids)
			? body.team_ids.filter((id): id is number => typeof id === "number")
			: [];
		if (teamIds.some((id) => gh.teams.get(id)?.org_id !== org.id)) {
			return invalidField(c, "OrganizationInvitation", "team_ids");
		}
		const row = settings.orgInvitations.insert({
			org_id: org.id,
			login: invitee?.login ?? null,
			email: invitee ? null : email,
			role: role as OrgInvitationRole,
			inviter_id: getViewer(gh, c)?.id ?? 0,
			team_ids: teamIds,
		});
		return c.json(invitationJson(org, row), 201);
	});

	app.delete("/orgs/:org/invitations/:invitation_id", (c) => {
		const org = guardOrg(context, c, "admin");
		if (isResponse(org)) {
			return org;
		}
		const { settings } = settingsStores(context);
		const row = settings.orgInvitations.get(
			Number(c.req.param("invitation_id")),
		);
		if (row?.org_id !== org.id) {
			return notFound(c);
		}
		settings.orgInvitations.delete(row.id);
		return c.body(null, 204);
	});

	const withCounts = (team: { id: number }) => {
		const row = settingsStores(context).gh.teams.get(team.id);
		return row ? teamJson(context, row) : team;
	};
	const countTeams = async (c: ShimRequestContext, next: Next) => {
		await passThrough<Array<{ id: number }> | { id: number }>(
			c,
			next,
			(data) => (Array.isArray(data) ? data.map(withCounts) : withCounts(data)),
		);
		return undefined;
	};
	wrap(context, "GET", "/orgs/:org/teams", countTeams);
	wrap(context, "POST", "/orgs/:org/teams", countTeams);
	wrap(context, "GET", "/orgs/:org/teams/:team_slug", countTeams);
	wrap(context, "PATCH", "/orgs/:org/teams/:team_slug", countTeams);

	const teamBySlug = (c: ShimRequestContext) => {
		const { gh } = settingsStores(context);
		const org = gh.orgs.findOneBy("login", c.req.param("org"));
		return org
			? gh.teams
					.findBy("org_id", org.id)
					.find((row) => row.slug === c.req.param("team_slug"))
			: undefined;
	};

	wrap(context, "DELETE", "/orgs/:org/teams/:team_slug", async (c, next) => {
		const team = teamBySlug(c);
		await passThrough(c, next);
		const { settings } = settingsStores(context);
		for (const row of settings.teamRepoRoles.findBy("team_id", team?.id ?? 0)) {
			settings.teamRepoRoles.delete(row.id);
		}
		return undefined;
	});

	wrap(context, "GET", "/orgs/:org/teams/:team_slug/repos", async (c, next) => {
		const team = teamBySlug(c);
		await passThrough<Array<{ id: number }>>(c, next, (repos) =>
			repos.map((repo) => {
				const permission =
					settingsStores(context)
						.settings.teamRepoRoles.findBy("team_id", team?.id ?? 0)
						.find((row) => row.repo_id === repo.id)?.permission ??
					team?.permission;
				return {
					...repo,
					permissions: permissionFlags(
						isPermission(permission) ? permission : "pull",
					),
				};
			}),
		);
		return undefined;
	});
}
