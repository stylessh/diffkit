import { createFileRoute } from "@tanstack/react-router";
import { getAuth } from "#/lib/auth.server";
import { getGitHubAppAuthConfig } from "#/lib/github-app.server";
import { handleGitHubAppAuthorize } from "#/lib/github-app-oauth.server";
import { getGitHubOAuthOrigin } from "#/lib/github-emulator.server";
import { guardRoute } from "#/lib/route-safety.server";
import { PRIVATE_ROUTE_HEADERS } from "#/lib/seo";

const handleAuthorize = guardRoute(
	"github-app-authorize",
	(request: Request) =>
		handleGitHubAppAuthorize(request, {
			getSession: (incoming) =>
				getAuth().api.getSession({ headers: incoming.headers }),
			getClientId: () => getGitHubAppAuthConfig().clientId,
			oauthOrigin: getGitHubOAuthOrigin,
		}),
	"authorize_unavailable",
);

export const Route = createFileRoute("/api/github/app/authorize")({
	headers: () => PRIVATE_ROUTE_HEADERS,
	server: {
		handlers: {
			GET: ({ request }) => handleAuthorize(request),
		},
	},
});
