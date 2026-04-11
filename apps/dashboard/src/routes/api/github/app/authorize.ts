import { createFileRoute } from "@tanstack/react-router";
import { getAuth } from "#/lib/auth.server";
import { getGitHubAppAuthConfig } from "#/lib/github-app.server";
import { PRIVATE_ROUTE_HEADERS } from "#/lib/seo";

const STATE_COOKIE = "github_app_oauth_state";
const RETURN_TO_COOKIE = "github_app_oauth_return_to";
const DEFAULT_RETURN_TO = "/?show-org-setup=true";

function normalizeReturnTo(value: string | null) {
	if (!value || !value.startsWith("/") || value.startsWith("//")) {
		return DEFAULT_RETURN_TO;
	}

	return value;
}

function serializeCookie({
	maxAge,
	name,
	requestUrl,
	value,
}: {
	maxAge: number;
	name: string;
	requestUrl: string;
	value: string;
}) {
	const secure = new URL(requestUrl).protocol === "https:" ? "; Secure" : "";
	return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export const Route = createFileRoute("/api/github/app/authorize")({
	headers: () => PRIVATE_ROUTE_HEADERS,
	server: {
		handlers: {
			GET: async ({ request }) => {
				const auth = getAuth();
				const session = await auth.api.getSession({ headers: request.headers });
				const requestUrl = new URL(request.url);
				const returnTo = normalizeReturnTo(
					requestUrl.searchParams.get("returnTo"),
				);

				if (!session) {
					const loginUrl = new URL("/login", request.url);
					loginUrl.searchParams.set("redirect", returnTo);
					return Response.redirect(loginUrl.toString(), 302);
				}

				const state = crypto.randomUUID();
				const githubApp = getGitHubAppAuthConfig();
				const callbackUrl = new URL("/api/github/app/callback", request.url);
				const authorizeUrl = new URL(
					"https://github.com/login/oauth/authorize",
				);
				authorizeUrl.searchParams.set("client_id", githubApp.clientId);
				authorizeUrl.searchParams.set("redirect_uri", callbackUrl.toString());
				authorizeUrl.searchParams.set("state", state);

				const response = new Response(null, {
					status: 302,
					headers: { Location: authorizeUrl.toString() },
				});
				response.headers.append(
					"Set-Cookie",
					serializeCookie({
						maxAge: 10 * 60,
						name: STATE_COOKIE,
						requestUrl: request.url,
						value: state,
					}),
				);
				response.headers.append(
					"Set-Cookie",
					serializeCookie({
						maxAge: 10 * 60,
						name: RETURN_TO_COOKIE,
						requestUrl: request.url,
						value: returnTo,
					}),
				);

				return response;
			},
		},
	},
});
