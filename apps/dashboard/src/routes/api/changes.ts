import { createFileRoute } from "@tanstack/react-router";
import { PRIVATE_ROUTE_HEADERS } from "#/lib/seo";

const MAX_WATCHED_REPOS = 200;

function parseWatchedRepos(url: URL): Set<string> | null {
	if (url.searchParams.get("scope") === "all") return null;
	const raw = url.searchParams.get("repos") ?? "";
	const repos = raw
		.split(",")
		.map((repo) => repo.trim().toLowerCase())
		.filter((repo) => /^[^/\s]+\/[^/\s]+$/.test(repo))
		.slice(0, MAX_WATCHED_REPOS);
	return new Set(repos);
}

function json(body: unknown, status = 200) {
	return Response.json(body, {
		status,
		headers: { "Cache-Control": "private, no-store" },
	});
}

/**
 * Change feed (docs/data-fetching.md, L2).
 *
 * GET /api/changes?since=<cursor>&repos=owner/a,owner/b[&scope=all]
 *
 * Returns `{ cursor, entities, expired }`: entity keys changed since the
 * cursor, limited to repos the viewer can read through the GitHub App (public
 * repos always) and, unless `scope=all`, to the repos the client watches.
 * Storage failures answer "nothing changed" with the client's own cursor, so
 * a D1 outage degrades to focus refetch instead of a refetch storm; once the
 * cursor ages out the client refetches its active queries once.
 */
export const Route = createFileRoute("/api/changes")({
	headers: () => PRIVATE_ROUTE_HEADERS,
	server: {
		handlers: {
			GET: async ({ request }) => {
				const { getAuth } = await import("#/lib/auth.server");
				const session = await getAuth().api.getSession({
					headers: request.headers,
				});
				if (!session) {
					return json({ error: "unauthorized" }, 401);
				}

				const url = new URL(request.url);
				const [{ env }, changes, access] = await Promise.all([
					import("cloudflare:workers"),
					import("#/lib/github-change.server"),
					import("#/lib/github-change-access.server"),
				]);
				const since = changes.decodeChangeCursor(url.searchParams.get("since"));

				try {
					const readable = await access.getReadableRepoSet(session.user.id);
					const result = await changes.readGitHubChanges(env.DB, {
						since,
						access: {
							canRead: (repo, isPrivate) => !isPrivate || readable.has(repo),
							watched: parseWatchedRepos(url),
						},
					});
					return json(result);
				} catch (error) {
					console.warn("[changes] read failed", error);
					return json({
						cursor: since ? changes.encodeChangeCursor(since) : null,
						entities: [],
						expired: false,
						degraded: true,
					});
				}
			},
		},
	},
});
