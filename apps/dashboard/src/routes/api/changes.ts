import { createFileRoute } from "@tanstack/react-router";
import { handleChangesRequest } from "#/lib/changes-request.server";
import { guardRoute } from "#/lib/route-safety.server";
import { PRIVATE_ROUTE_HEADERS } from "#/lib/seo";

const handleChanges = guardRoute(
	"changes",
	async (request: Request) => {
		const [{ env }, { getAuth }, changes, access] = await Promise.all([
			import("cloudflare:workers"),
			import("#/lib/auth.server"),
			import("#/lib/github-change.server"),
			import("#/lib/github-change-access.server"),
		]);
		return handleChangesRequest(request, {
			getSession: (incoming) =>
				getAuth().api.getSession({ headers: incoming.headers }),
			getReadableRepoSet: access.getReadableRepoSet,
			readChanges: (options) => changes.readGitHubChanges(env.DB, options),
		});
	},
	"changes_unavailable",
);

export const Route = createFileRoute("/api/changes")({
	headers: () => PRIVATE_ROUTE_HEADERS,
	server: {
		handlers: {
			GET: ({ request }) => handleChanges(request),
		},
	},
});
