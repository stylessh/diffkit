/**
 * Who can reach a repository: direct collaborators with their role, pending
 * invitations and teams.
 */
import type { GitHubRepo } from "@emulators/github";
import type { ShimContext } from "../server.ts";
import {
	isPermission,
	isRole,
	type RepoInvitationRow,
	roleOf,
} from "../store-settings.ts";
import {
	apiRepoJson,
	apiUserJson,
	findRepo,
	GITHUB_WEB_URL,
	getViewer,
	notFound,
} from "./common.ts";
import { encodeNodeId } from "./enrich.ts";
import {
	guardRepo,
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

export function registerAccessShims(context: ShimContext) {
	const { app, baseUrl } = context;

	const invitationJson = (repo: GitHubRepo, row: RepoInvitationRow) => {
		const { gh } = settingsStores(context);
		const invitee = gh.users.get(row.invitee_id);
		const inviter = gh.users.get(row.inviter_id);
		return {
			id: row.id,
			node_id: encodeNodeId("RepositoryInvitation", row.id),
			repository: apiRepoJson(gh, repo, baseUrl),
			invitee: invitee ? apiUserJson(invitee, baseUrl) : null,
			inviter: inviter ? apiUserJson(inviter, baseUrl) : null,
			permissions: row.permissions,
			created_at: row.created_at,
			expired: false,
			url: `${baseUrl}/user/repository_invitations/${row.id}`,
			html_url: `${GITHUB_WEB_URL}/${repo.full_name}/invitations`,
		};
	};

	wrap(context, "GET", "/repos/:owner/:repo/collaborators", async (c, next) => {
		const { gh } = settingsStores(context);
		const repo = findRepo(gh, c.req.param("owner"), c.req.param("repo"));
		const affiliation = c.req.query("affiliation");
		const wanted = c.req.query("permission");
		await passThrough<Array<{ login: string }>>(c, next, (users) =>
			users.flatMap((entry) => {
				const user = gh.users.findOneBy("login", entry.login);
				const row = gh.collaborators
					.findBy("repo_id", repo?.id ?? 0)
					.find((candidate) => candidate.user_id === user?.id);
				if (!repo || !user || !row) {
					return [];
				}
				if (wanted && wanted !== row.permission) {
					return [];
				}
				const isMember =
					repo.owner_type === "Organization" &&
					orgRole(gh, repo.owner_id, user.id) !== null;
				if (affiliation === "outside" && isMember) {
					return [];
				}
				return [
					{
						...entry,
						permissions: permissionFlags(row.permission),
						role_name: roleOf(row.permission),
					},
				];
			}),
		);
		return undefined;
	});

	app.put("/repos/:owner/:repo/collaborators/:username", async (c) => {
		const repo = guardRepo(context, c, "admin");
		if (isResponse(repo)) {
			return repo;
		}
		const { gh, settings } = settingsStores(context);
		const target = gh.users.findOneBy("login", c.req.param("username"));
		if (!target) {
			return notFound(c);
		}
		const body = await readBody(c);
		const permission = body.permission ?? "push";
		if (!isPermission(permission)) {
			return invalidField(c, "Repository", "permission");
		}
		if (repo.owner_type === "User" && repo.owner_id === target.id) {
			return c.body(null, 204);
		}
		const existing = gh.collaborators
			.findBy("repo_id", repo.id)
			.find((row) => row.user_id === target.id);
		if (existing) {
			gh.collaborators.update(existing.id, { permission });
			return c.body(null, 204);
		}
		const isOrgMember =
			repo.owner_type === "Organization" &&
			orgRole(gh, repo.owner_id, target.id) !== null;
		// Seeded collaborators stand for invitations that were already accepted.
		if (isOrgMember || context.store.getData("diffkit.seeding")) {
			gh.collaborators.insert({
				repo_id: repo.id,
				user_id: target.id,
				permission,
			});
			return c.body(null, 204);
		}
		const pending = settings.repoInvitations
			.findBy("repo_id", repo.id)
			.find((row) => row.invitee_id === target.id);
		const inviter = getViewer(gh, c) ?? gh.users.get(repo.owner_id);
		const row = pending
			? settings.repoInvitations.update(pending.id, {
					permissions: roleOf(permission),
				})
			: settings.repoInvitations.insert({
					repo_id: repo.id,
					invitee_id: target.id,
					inviter_id: inviter?.id ?? 0,
					permissions: roleOf(permission),
				});
		return row ? c.json(invitationJson(repo, row), 201) : notFound(c);
	});

	app.get("/repos/:owner/:repo/invitations", (c) => {
		const repo = guardRepo(context, c, "admin");
		if (isResponse(repo)) {
			return repo;
		}
		const rows = settingsStores(context)
			.settings.repoInvitations.findBy("repo_id", repo.id)
			.sort((a, b) => a.id - b.id);
		return c.json(
			pageWithLinks(c, rows).map((row) => invitationJson(repo, row)),
		);
	});

	const findInvitation = (repo: GitHubRepo, id: string) => {
		const row = settingsStores(context).settings.repoInvitations.get(
			Number(id),
		);
		return row?.repo_id === repo.id ? row : undefined;
	};

	app.patch("/repos/:owner/:repo/invitations/:invitation_id", async (c) => {
		const repo = guardRepo(context, c, "admin");
		if (isResponse(repo)) {
			return repo;
		}
		const row = findInvitation(repo, c.req.param("invitation_id"));
		if (!row) {
			return notFound(c);
		}
		const body = await readBody(c);
		if (!isRole(body.permissions)) {
			return invalidField(c, "RepositoryInvitation", "permissions");
		}
		const updated = settingsStores(context).settings.repoInvitations.update(
			row.id,
			{ permissions: body.permissions },
		);
		return updated ? c.json(invitationJson(repo, updated)) : notFound(c);
	});

	app.delete("/repos/:owner/:repo/invitations/:invitation_id", (c) => {
		const repo = guardRepo(context, c, "admin");
		if (isResponse(repo)) {
			return repo;
		}
		const row = findInvitation(repo, c.req.param("invitation_id"));
		if (!row) {
			return notFound(c);
		}
		settingsStores(context).settings.repoInvitations.delete(row.id);
		return c.body(null, 204);
	});

	const teamPermission = (teamId: number, repoId: number) => {
		const { gh, settings } = settingsStores(context);
		return (
			settings.teamRepoRoles
				.findBy("repo_id", repoId)
				.find((row) => row.team_id === teamId)?.permission ??
			gh.teams.get(teamId)?.permission ??
			"pull"
		);
	};

	app.get("/repos/:owner/:repo/teams", (c) => {
		const repo = guardRepo(context, c);
		if (isResponse(repo)) {
			return repo;
		}
		const { gh } = settingsStores(context);
		const teams = gh.teamRepos
			.findBy("repo_id", repo.id)
			.flatMap((link) => gh.teams.get(link.team_id) ?? [])
			.sort((a, b) => a.id - b.id);
		return c.json(
			pageWithLinks(c, teams).map((team) => {
				const permission = teamPermission(team.id, repo.id);
				return {
					...teamJson(context, team, permission),
					permissions: permissionFlags(
						isPermission(permission) ? permission : "pull",
					),
				};
			}),
		);
	});

	const teamRepoTarget = (c: Parameters<typeof guardRepo>[1]) => {
		const { gh } = settingsStores(context);
		const org = gh.orgs.findOneBy("login", c.req.param("org") ?? "");
		const team = org
			? gh.teams
					.findBy("org_id", org.id)
					.find((row) => row.slug === c.req.param("team_slug"))
			: undefined;
		const repo = findRepo(
			gh,
			c.req.param("owner") ?? "",
			c.req.param("repo") ?? "",
		);
		return team && repo ? { team, repo } : null;
	};

	wrap(
		context,
		"PUT",
		"/orgs/:org/teams/:team_slug/repos/:owner/:repo",
		async (c, next) => {
			const body = await readBody(c);
			if (body.permission !== undefined && !isPermission(body.permission)) {
				return invalidField(c, "Team", "permission");
			}
			await passThrough(c, next);
			const target = teamRepoTarget(c);
			if (!target) {
				return undefined;
			}
			const { settings } = settingsStores(context);
			const permission = isPermission(body.permission)
				? body.permission
				: "push";
			const existing = settings.teamRepoRoles
				.findBy("repo_id", target.repo.id)
				.find((row) => row.team_id === target.team.id);
			if (existing) {
				settings.teamRepoRoles.update(existing.id, { permission });
			} else {
				settings.teamRepoRoles.insert({
					team_id: target.team.id,
					repo_id: target.repo.id,
					permission,
				});
			}
			return undefined;
		},
	);

	wrap(
		context,
		"DELETE",
		"/orgs/:org/teams/:team_slug/repos/:owner/:repo",
		async (c, next) => {
			await passThrough(c, next);
			const target = teamRepoTarget(c);
			if (!target) {
				return undefined;
			}
			const { settings } = settingsStores(context);
			for (const row of settings.teamRepoRoles.findBy(
				"repo_id",
				target.repo.id,
			)) {
				if (row.team_id === target.team.id) {
					settings.teamRepoRoles.delete(row.id);
				}
			}
			return undefined;
		},
	);
}
