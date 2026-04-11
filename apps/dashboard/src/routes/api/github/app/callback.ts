import { createFileRoute } from "@tanstack/react-router";
import { getAuth } from "#/lib/auth.server";
import { exchangeGitHubAppUserCode } from "#/lib/github-app.server";
import { PRIVATE_ROUTE_HEADERS } from "#/lib/seo";

const STATE_COOKIE = "github_app_oauth_state";
const RETURN_TO_COOKIE = "github_app_oauth_return_to";
const DEFAULT_RETURN_TO = "/?show-org-setup=true";

function getCookie(request: Request, name: string) {
	const cookieHeader = request.headers.get("cookie") ?? "";
	for (const cookie of cookieHeader.split(";")) {
		const [rawName, ...rawValue] = cookie.trim().split("=");
		if (rawName === name) {
			return decodeURIComponent(rawValue.join("="));
		}
	}

	return null;
}

function clearCookie(name: string, requestUrl: string) {
	const secure = new URL(requestUrl).protocol === "https:" ? "; Secure" : "";
	return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

function normalizeReturnTo(value: string | null) {
	if (!value || !value.startsWith("/") || value.startsWith("//")) {
		return DEFAULT_RETURN_TO;
	}

	return value;
}

function redirectWithClearedCookies(request: Request, href: string) {
	const response = new Response(null, {
		status: 302,
		headers: { Location: new URL(href, request.url).toString() },
	});
	response.headers.append("Set-Cookie", clearCookie(STATE_COOKIE, request.url));
	response.headers.append(
		"Set-Cookie",
		clearCookie(RETURN_TO_COOKIE, request.url),
	);
	return response;
}

export const Route = createFileRoute("/api/github/app/callback")({
	headers: () => PRIVATE_ROUTE_HEADERS,
	server: {
		handlers: {
			GET: async ({ request }) => {
				const requestUrl = new URL(request.url);
				const code = requestUrl.searchParams.get("code");
				const state = requestUrl.searchParams.get("state");
				const expectedState = getCookie(request, STATE_COOKIE);
				const returnTo = normalizeReturnTo(
					getCookie(request, RETURN_TO_COOKIE),
				);

				if (!code || !state || !expectedState || state !== expectedState) {
					return redirectWithClearedCookies(
						request,
						`${DEFAULT_RETURN_TO}&github-app-error=invalid-state`,
					);
				}

				const auth = getAuth();
				const session = await auth.api.getSession({ headers: request.headers });
				if (!session) {
					const loginParams = new URLSearchParams({ redirect: returnTo });
					return redirectWithClearedCookies(
						request,
						`/login?${loginParams.toString()}`,
					);
				}

				try {
					await exchangeGitHubAppUserCode({
						code,
						redirectUri: new URL(
							"/api/github/app/callback",
							request.url,
						).toString(),
						userId: session.user.id,
					});
				} catch (error) {
					console.error("[github-app-oauth] failed to exchange code", error);
					return redirectWithClearedCookies(
						request,
						`${DEFAULT_RETURN_TO}&github-app-error=exchange-failed`,
					);
				}

				return redirectWithClearedCookies(request, returnTo);
			},
		},
	},
});
