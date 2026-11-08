import type {
	GitHubChangeAccess,
	GitHubChangeCursor,
	GitHubChangesResult,
} from "./github-change.server";
import { decodeChangeCursor, encodeChangeCursor } from "./github-change.server";
import { logRouteError, serviceUnavailable } from "./route-safety.server";

const MAX_WATCHED_REPOS = 200;
const REPO_PATTERN = /^[^/\s]+\/[^/\s]+$/;

export type ChangesRequestDeps = {
	getSession: (request: Request) => Promise<{ user: { id: string } } | null>;
	getReadableRepoSet: (userId: string) => Promise<Set<string>>;
	readChanges: (options: {
		since: GitHubChangeCursor | null;
		access: GitHubChangeAccess;
	}) => Promise<GitHubChangesResult>;
};

function parseWatchedRepos(url: URL): Set<string> | "all" {
	if (url.searchParams.get("scope") === "all") return "all";
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
		// 503, not 401: a 401 tells the client the user signed out.
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
				canRead: (repo, isPrivate) => !isPrivate || readable.has(repo),
				watched: parseWatchedRepos(url),
			},
		});
		return json(result);
	} catch (error) {
		// "Nothing changed" with the client's own cursor, so an outage cannot
		// trigger a refetch storm.
		logRouteError("changes", "read failed", error);
		return json({
			cursor: since ? encodeChangeCursor(since) : null,
			entities: [],
			expired: false,
			degraded: true,
		});
	}
}
