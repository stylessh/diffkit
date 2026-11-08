import type { AppEnv, AuthUser, Context } from "@emulators/core";
import {
	type GitHubRepo,
	type GitHubStore,
	type GitHubUser,
	getGitHubStore,
} from "@emulators/github";
import type { ShimContext } from "../server.ts";
import { getExtrasStore } from "../store-extras.ts";

/** Public-facing links ("open on GitHub") keep pointing at github.com. */
export const GITHUB_WEB_URL = "https://github.com";

export type ShimRequestContext = Context<AppEnv>;

export function stores(context: ShimContext) {
	return {
		gh: getGitHubStore(context.store),
		extras: getExtrasStore(context.store),
	};
}

export function json(c: ShimRequestContext, data: unknown, status = 200) {
	return c.json(data, status);
}

export function notFound(c: ShimRequestContext) {
	return c.json(
		{
			message: "Not Found",
			documentation_url: "https://docs.github.com/rest",
		},
		404,
	);
}

export function requiresAuth(c: ShimRequestContext) {
	return c.json(
		{
			message: "Requires authentication",
			documentation_url: "https://docs.github.com/rest",
		},
		401,
	);
}

export function getAuthUser(c: ShimRequestContext): AuthUser | undefined {
	return c.get("authUser");
}

export function getViewer(
	gh: GitHubStore,
	c: ShimRequestContext,
): GitHubUser | undefined {
	const auth = getAuthUser(c);
	if (!auth || auth.installation) {
		return undefined;
	}
	return gh.users.findOneBy("login", auth.login);
}

export function ownerLogin(gh: GitHubStore, repo: GitHubRepo) {
	if (repo.owner_type === "Organization") {
		return gh.orgs.get(repo.owner_id)?.login ?? "";
	}
	return gh.users.get(repo.owner_id)?.login ?? "";
}

export function findRepo(gh: GitHubStore, owner: string, name: string) {
	return (
		gh.repos.findOneBy("full_name", `${owner}/${name}`) ??
		gh.repos
			.all()
			.find(
				(repo) =>
					repo.full_name.toLowerCase() === `${owner}/${name}`.toLowerCase(),
			)
	);
}

export function isOrgMember(gh: GitHubStore, orgId: number, userId: number) {
	return gh.teams
		.findBy("org_id", orgId)
		.some((team) =>
			gh.teamMembers
				.findBy("team_id", team.id)
				.some((member) => member.user_id === userId),
		);
}

export function canReadRepo(
	gh: GitHubStore,
	auth: AuthUser | undefined,
	repo: GitHubRepo,
) {
	if (!repo.private) {
		return true;
	}
	if (!auth) {
		return false;
	}
	if (auth.installation) {
		return (
			repo.owner_id === auth.installation.accountId &&
			repo.owner_type === auth.installation.accountType &&
			(auth.installation.repositorySelection === "all" ||
				auth.installation.repositoryIds.includes(repo.id))
		);
	}
	const user = gh.users.findOneBy("login", auth.login);
	if (!user) {
		return false;
	}
	if (user.site_admin) {
		return true;
	}
	if (repo.owner_type === "User") {
		if (repo.owner_id === user.id) {
			return true;
		}
	} else if (isOrgMember(gh, repo.owner_id, user.id)) {
		return true;
	}
	return gh.collaborators
		.findBy("repo_id", repo.id)
		.some((row) => row.user_id === user.id);
}

export function apiUserJson(user: GitHubUser, baseUrl: string) {
	return {
		login: user.login,
		id: user.id,
		node_id: user.node_id,
		avatar_url: user.avatar_url,
		gravatar_id: "",
		url: `${baseUrl}/users/${user.login}`,
		html_url: `${GITHUB_WEB_URL}/${user.login}`,
		type: user.type,
		site_admin: user.site_admin,
	};
}

export function apiOwnerJson(
	gh: GitHubStore,
	repo: GitHubRepo,
	baseUrl: string,
) {
	if (repo.owner_type === "Organization") {
		const org = gh.orgs.get(repo.owner_id);
		return {
			login: org?.login ?? "",
			id: org?.id ?? 0,
			node_id: org?.node_id ?? "",
			avatar_url: `${baseUrl}/avatars/u/${org?.login ?? "ghost"}`,
			url: `${baseUrl}/orgs/${org?.login ?? ""}`,
			html_url: `${GITHUB_WEB_URL}/${org?.login ?? ""}`,
			type: "Organization",
			site_admin: false,
		};
	}
	const user = gh.users.get(repo.owner_id);
	return user ? apiUserJson(user, baseUrl) : null;
}

/** Minimal repository shape (as embedded in notifications / installations). */
export function apiRepoJson(
	gh: GitHubStore,
	repo: GitHubRepo,
	baseUrl: string,
) {
	return {
		id: repo.id,
		node_id: repo.node_id,
		name: repo.name,
		full_name: repo.full_name,
		private: repo.private,
		owner: apiOwnerJson(gh, repo, baseUrl),
		html_url: `${GITHUB_WEB_URL}/${repo.full_name}`,
		description: repo.description,
		fork: repo.fork,
		url: `${baseUrl}/repos/${repo.full_name}`,
		default_branch: repo.default_branch,
		visibility: repo.visibility,
		archived: repo.archived,
		stargazers_count: repo.stargazers_count,
		forks_count: repo.forks_count,
		language: repo.language,
		updated_at: repo.updated_at,
		pushed_at: repo.pushed_at,
	};
}

export function parseIntParam(value: string | undefined) {
	const parsed = Number.parseInt(value ?? "", 10);
	return Number.isFinite(parsed) ? parsed : null;
}

export function paginate<T>(
	c: ShimRequestContext,
	items: T[],
	defaultPerPage = 30,
) {
	const perPage = Math.min(
		100,
		Math.max(1, parseIntParam(c.req.query("per_page")) ?? defaultPerPage),
	);
	const page = Math.max(1, parseIntParam(c.req.query("page")) ?? 1);
	const start = (page - 1) * perPage;
	return items.slice(start, start + perPage);
}

/** Deterministic, cheap string hash (FNV-1a). */
export function hashString(value: string) {
	let hash = 0x811c9dc5;
	for (let index = 0; index < value.length; index++) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}
	return hash >>> 0;
}
