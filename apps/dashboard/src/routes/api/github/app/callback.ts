import { createFileRoute } from "@tanstack/react-router";
import { getAuth } from "#/lib/auth.server";
import { exchangeGitHubAppUserCode } from "#/lib/github-app.server";
import { handleGitHubAppCallback } from "#/lib/github-app-oauth.server";
import { guardRoute } from "#/lib/route-safety.server";
import { PRIVATE_ROUTE_HEADERS } from "#/lib/seo";

const handleCallback = guardRoute(
	"github-app-callback",
	(request: Request) =>
		handleGitHubAppCallback(request, {
			getSession: (incoming) =>
				getAuth().api.getSession({ headers: incoming.headers }),
			exchangeCode: exchangeGitHubAppUserCode,
		}),
	"callback_unavailable",
);

export const Route = createFileRoute("/api/github/app/callback")({
	headers: () => PRIVATE_ROUTE_HEADERS,
	server: {
		handlers: {
			GET: ({ request }) => handleCallback(request),
		},
	},
});
