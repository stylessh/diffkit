import type {
	GitHubChangeAccess,
	GitHubChangeCursor,
	GitHubChangesResult,
} from "./github-change.server";
import { decodeChangeCursor, encodeChangeCursor } from "./github-change.server";
import { logRouteError, serviceUnavailable } from "./route-safety.server";

/**
 * The logic behind `GET /api/changes` (docs/data-fetching.md, L2).
 *
 * Returns `{ cursor, entities, expired }`: entity keys changed since the
 * cursor, limited to repos the viewer can read through the GitHub App (public
 * repos always) and, unless `scope=all`, to the repos the client watches.
 *
 * Failure modes, all non-fatal for the page:
 * - Session store down: 503 (never 401, which tells the client the user is
 *   signed out).
 * - Change store or GitHub access lookup down: "nothing changed" with the
 *   client's own cursor, so an outage degrades to focus refetch instead of a
 *   refetch storm.
 */

export const MAX_WATCHED_REPOS = 200;
const REPO_PATTERN = /^[^/\s]+\/[^/\s]+$/;

export type ChangesRequestDeps = {
	getSession: (request: Request) => Promise<{ user: { id: string } } | null>;
	getReadableRepoSet: (userId: string) => Promise<Set<string>>;
	readChanges: (options: {
		since: GitHubChangeCursor | null;
		access: GitHubChangeAccess;
	}) => Promise<GitHubChangesResult>;
};

/** `null` means every readable repo (`scope=all`). */
export function parseWatchedRepos(url: URL): Set<string> | null {
	if (url.searchParams.get("scope") === "all") return null;
	const raw = url.searchParams.get("repos") ?? "";
	const repos = raw
		.split(",")
		.map((repo) => repo.trim().toLowerCase())
		.filter((repo) => REPO_PATTERN.test(repo))
		.slice(0, MAX_WATCHED_REPOS);
	return new Set(repos);
}

function json(body: unknown, status = 200) {
	return Response.json(body, {
		status,
		headers: { "Cache-Control": "private, no-store" },
	});
}

export async function handleChangesRequest(
	request: Request,
	deps: ChangesRequestDeps,
): Promise<Response> {
	let session: Awaited<ReturnType<ChangesRequestDeps["getSession"]>>;
	try {
		session = await deps.getSession(request);
	} catch (error) {
		logRouteError("changes", "session lookup failed", error);
		return serviceUnavailable("session_unavailable", 15);
	}
	if (!session) {
		return json({ error: "unauthorized" }, 401);
	}

	const url = new URL(request.url);
	const since = decodeChangeCursor(url.searchParams.get("since"));

	try {
		const readable = await deps.getReadableRepoSet(session.user.id);
		const result = await deps.readChanges({
			since,
			access: {
				// Private repos only when the GitHub App says this user can read them.
				canRead: (repo, isPrivate) => !isPrivate || readable.has(repo),
				watched: parseWatchedRepos(url),
			},
		});
		return json(result);
	} catch (error) {
		logRouteError("changes", "read failed", error);
		return json({
			cursor: since ? encodeChangeCursor(since) : null,
			entities: [],
			expired: false,
			degraded: true,
		});
	}
}
