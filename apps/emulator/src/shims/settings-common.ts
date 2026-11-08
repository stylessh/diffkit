import { createHash } from "node:crypto";
import { type Next, setLinkHeader } from "@emulators/core";
import type {
	GitHubCollaborator,
	GitHubOrg,
	GitHubRepo,
	GitHubStore,
	GitHubTeam,
	GitHubUser,
} from "@emulators/github";
import type { ShimContext } from "../server.ts";
import { getSettingsStore } from "../store-settings.ts";
import {
	canReadRepo,
	findRepo,
	GITHUB_WEB_URL,
	getAuthUser,
	getViewer,
	notFound,
	requiresAuth,
	type ShimRequestContext,
	stores,
} from "./common.ts";

export function settingsStores(context: ShimContext) {
	return {
		gh: stores(context).gh,
		settings: getSettingsStore(context.store),
	};
}

/** Reads the JSON body without consuming it, so emulate's handler can read it too. */
export async function readBody(c: ShimRequestContext) {
	try {
		const body = await c.req.raw.clone().json();
		return body && typeof body === "object" && !Array.isArray(body)
			? (body as Record<string, unknown>)
			: {};
	} catch {
		return {};
	}
}

export function fail(
	c: ShimRequestContext,
	status: 403 | 404 | 409 | 422,
	message: string,
	errors?: unknown[],
) {
	return c.json(
		{
			message,
			...(errors ? { errors } : {}),
			documentation_url: "https://docs.github.com/rest",
		},
		status,
	);
}

export function invalidField(
	c: ShimRequestContext,
	resource: string,
	field: string,
	code = "invalid",
) {
	return fail(c, 422, "Validation Failed", [{ resource, code, field }]);
}

/**
 * Registers a wrapper around emulate's own handler for `method` + `pattern`.
 * The HTTP layer routes a request to one route only, so a shim that wants to
 * reuse emulate's answer is middleware that calls `next()` (see `passThrough`).
 */
export function wrap(
	context: ShimContext,
	method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
	pattern: string,
	handler: (c: ShimRequestContext, next: Next) => Promise<Response | undefined>,
) {
	context.app.use(pattern, (c, next) =>
		c.req.method.toUpperCase() === method ? handler(c, next) : next(),
	);
}

/**
 * Runs emulate's handler and returns the status it answered with. `finish`
 * runs once emulate has committed its change and picks the JSON body to send;
 * a failing handler throws, so neither `finish` nor the caller's code after
 * `await passThrough` ever sees a failure.
 */
export async function passThrough<T = unknown>(
	c: ShimRequestContext,
	next: Next,
	finish?: (data: T) => unknown,
) {
	let status = 200;
	const { json, body } = c;
	c.json = (data, code, headers) => {
		status = code ?? 200;
		return json.call(c, finish ? finish(data as T) : data, code, headers);
	};
	c.body = (content, code, headers) => {
		status = code ?? 200;
		return body.call(c, content, code, headers);
	};
	await next();
	return status;
}

/** Role in the org: only a maintainer of the "Members" team is an owner. */
export function orgRole(gh: GitHubStore, orgId: number, userId: number) {
	let role: "admin" | "member" | null = null;
	for (const team of gh.teams.findBy("org_id", orgId)) {
		const membership = gh.teamMembers
			.findBy("team_id", team.id)
			.find((row) => row.user_id === userId);
		if (!membership) {
			continue;
		}
		role = role ?? "member";
		if (team.slug === "members" && membership.role === "maintainer") {
			role = "admin";
		}
	}
	return role;
}

export function orgOwner(gh: GitHubStore, org: GitHubOrg, userLogin: string) {
	const user = gh.users.findOneBy("login", userLogin);
	return user ? orgRole(gh, org.id, user.id) === "admin" : false;
}

const LEVELS: GitHubCollaborator["permission"][] = [
	"pull",
	"triage",
	"push",
	"maintain",
	"admin",
];

export function permissionFlags(
	level: GitHubCollaborator["permission"] | null,
) {
	const rank = level ? LEVELS.indexOf(level) : -1;
	return {
		admin: rank >= 4,
		maintain: rank >= 3,
		push: rank >= 2,
		triage: rank >= 1,
		pull: rank >= 0,
	};
}

function higher(
	a: GitHubCollaborator["permission"] | null,
	b: GitHubCollaborator["permission"] | null,
) {
	if (!a || !b) {
		return a ?? b;
	}
	return LEVELS.indexOf(a) >= LEVELS.indexOf(b) ? a : b;
}

const BASE_LEVEL: Record<string, GitHubCollaborator["permission"] | null> = {
	read: "pull",
	write: "push",
	admin: "admin",
	none: null,
};

export function userRepoLevel(
	gh: GitHubStore,
	user: GitHubUser,
	repo: GitHubRepo,
) {
	if (user.site_admin) {
		return "admin" as const;
	}
	let level: GitHubCollaborator["permission"] | null = repo.private
		? null
		: "pull";
	if (repo.owner_type === "User") {
		if (repo.owner_id === user.id) {
			return "admin" as const;
		}
	} else {
		const role = orgRole(gh, repo.owner_id, user.id);
		if (role === "admin") {
			return "admin" as const;
		}
		if (role) {
			const org = gh.orgs.get(repo.owner_id);
			level = higher(
				level,
				BASE_LEVEL[org?.default_repository_permission ?? ""] ?? null,
			);
		}
	}
	const collaborator = gh.collaborators
		.findBy("repo_id", repo.id)
		.find((row) => row.user_id === user.id);
	return higher(level, collaborator?.permission ?? null);
}

/**
 * Resolves `:owner/:repo` for a settings route. Returns the repository, or the
 * response to send (404 for unreadable repositories, 401/403 when `admin` is
 * required and the caller is not one).
 */
export function guardRepo(
	context: ShimContext,
	c: ShimRequestContext,
	access: "read" | "admin" = "read",
): GitHubRepo | Response {
	const { gh } = stores(context);
	const auth = getAuthUser(c);
	const repo = findRepo(
		gh,
		c.req.param("owner") ?? "",
		c.req.param("repo") ?? "",
	);
	if (!repo || !canReadRepo(gh, auth, repo)) {
		return notFound(c);
	}
	if (access === "read") {
		return repo;
	}
	if (!auth) {
		return requiresAuth(c);
	}
	if (auth.installation) {
		return repo;
	}
	const viewer = getViewer(gh, c);
	if (!viewer || userRepoLevel(gh, viewer, repo) !== "admin") {
		return fail(c, 403, "Must have admin rights to Repository.");
	}
	return repo;
}

export function guardOrg(
	context: ShimContext,
	c: ShimRequestContext,
	access: "member" | "admin" = "member",
): GitHubOrg | Response {
	const { gh } = stores(context);
	const org = gh.orgs.findOneBy("login", c.req.param("org") ?? "");
	if (!org) {
		return notFound(c);
	}
	const auth = getAuthUser(c);
	if (!auth) {
		return requiresAuth(c);
	}
	if (auth.installation) {
		return org;
	}
	const viewer = getViewer(gh, c);
	const role = viewer ? orgRole(gh, org.id, viewer.id) : null;
	if (access === "admin" ? role !== "admin" : !role) {
		return fail(c, 403, "You must be an organization owner.");
	}
	return org;
}

export function isResponse(value: unknown): value is Response {
	return value instanceof Response;
}

/** Deterministic UUID-shaped id, so seeded and replayed deliveries are stable. */
export function uuidFrom(seed: string) {
	const hex = createHash("sha1").update(seed).digest("hex");
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function pageParams(
	c: ShimRequestContext,
	{ fallback = 30, max = 100 }: { fallback?: number; max?: number } = {},
) {
	const requested = Number.parseInt(c.req.query("per_page") ?? "", 10);
	const page = Number.parseInt(c.req.query("page") ?? "", 10);
	return {
		perPage: Math.min(
			max,
			Math.max(1, Number.isFinite(requested) ? requested : fallback),
		),
		page: Math.max(1, Number.isFinite(page) ? page : 1),
	};
}

/** One page of `rows` plus the `Link` header octokit.paginate follows. */
export function pageWithLinks<T>(
	c: ShimRequestContext,
	rows: T[],
	options?: { fallback?: number; max?: number },
) {
	const { page, perPage } = pageParams(c, options);
	setLinkHeader(c, rows.length, page, perPage);
	return rows.slice((page - 1) * perPage, page * perPage);
}

export function teamJson(
	context: ShimContext,
	team: GitHubTeam,
	permission: string = team.permission,
): Record<string, unknown> {
	const { gh } = stores(context);
	const org = gh.orgs.get(team.org_id);
	const parent = team.parent_id ? gh.teams.get(team.parent_id) : undefined;
	return {
		id: team.id,
		node_id: team.node_id,
		url: `${context.baseUrl}/teams/${team.id}`,
		html_url: `${GITHUB_WEB_URL}/orgs/${org?.login ?? ""}/teams/${team.slug}`,
		name: team.name,
		slug: team.slug,
		description: team.description,
		privacy: team.privacy,
		notification_setting: "notifications_enabled",
		permission,
		members_url: `${context.baseUrl}/teams/${team.id}/members{/member}`,
		repositories_url: `${context.baseUrl}/teams/${team.id}/repos`,
		parent: parent ? teamJson(context, parent) : null,
		members_count: gh.teamMembers.findBy("team_id", team.id).length,
		repos_count: gh.teamRepos.findBy("team_id", team.id).length,
	};
}
