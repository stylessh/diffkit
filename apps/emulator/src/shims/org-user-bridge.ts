/**
 * GitHub answers `GET /users/<org>` (and `/users/<org>/repos`) for
 * organizations too, with `type: "Organization"`. emulate only serves them
 * under `/orgs`, so forward those two paths when the login is an org.
 */
import { getGitHubStore } from "@emulators/github";
import type { ShimContext } from "../server.ts";

const USERS_PATH = /^\/users\/([^/]+)(\/repos)?\/?$/u;

export async function bridgeOrgAsUser(
	context: ShimContext,
	request: Request,
	fetch: (request: Request) => Promise<Response>,
): Promise<Response | null> {
	if (request.method !== "GET") {
		return null;
	}
	const url = new URL(request.url);
	const match = url.pathname.match(USERS_PATH);
	if (!match) {
		return null;
	}
	const login = decodeURIComponent(match[1]);
	const gh = getGitHubStore(context.store);
	if (
		gh.users.findOneBy("login", login) ||
		!gh.orgs.findOneBy("login", login)
	) {
		return null;
	}
	const target = new URL(
		`/orgs/${encodeURIComponent(login)}${match[2] ?? ""}${url.search}`,
		url,
	);
	const response = await fetch(
		new Request(target, { headers: request.headers }),
	);
	if (match[2] || !response.ok) {
		return response;
	}
	const org = (await response.json()) as Record<string, unknown>;
	return Response.json({
		...org,
		type: "Organization",
		bio: org.description ?? null,
		avatar_url: `${context.baseUrl}/avatars/u/${login}`,
		html_url: `https://github.com/${login}`,
	});
}
