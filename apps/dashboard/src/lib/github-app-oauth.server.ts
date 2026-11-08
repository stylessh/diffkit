import { normalizeAuthRedirect } from "./auth-redirect";
import { readCookieValue } from "./cookies";
import { logRouteError } from "./route-safety.server";

const STATE_COOKIE = "github_app_oauth_state";
const RETURN_TO_COOKIE = "github_app_oauth_return_to";
const DEFAULT_RETURN_TO = "/setup";
const COOKIE_MAX_AGE_SECONDS = 10 * 60;

type SessionResult = { user: { id: string } } | null;

export function normalizeReturnTo(value: string | null | undefined) {
	return normalizeAuthRedirect(value, DEFAULT_RETURN_TO);
}

function shouldUseSecureCookie(requestUrl: string) {
	const { protocol, hostname } = new URL(requestUrl);
	if (protocol === "https:") return true;
	return !["localhost", "127.0.0.1", "[::1]"].includes(hostname);
}

function serializeCookie(
	name: string,
	value: string,
	maxAge: number,
	requestUrl: string,
) {
	const secure = shouldUseSecureCookie(requestUrl) ? "; Secure" : "";
	return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function constantTimeEqual(left: string, right: string) {
	const encoder = new TextEncoder();
	const a = encoder.encode(left);
	const b = encoder.encode(right);
	let mismatch = a.length ^ b.length;
	for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
		mismatch |= (a[index] ?? 0) ^ (b[index] ?? 0);
	}
	return mismatch === 0;
}

function redirect(request: Request, href: string, cookies: string[]): Response {
	// Not Response.redirect(): its headers are immutable.
	const response = new Response(null, {
		status: 302,
		headers: { Location: new URL(href, request.url).toString() },
	});
	for (const cookie of cookies) {
		response.headers.append("Set-Cookie", cookie);
	}
	return response;
}

function clearedCookies(request: Request) {
	return [
		serializeCookie(STATE_COOKIE, "", 0, request.url),
		serializeCookie(RETURN_TO_COOKIE, "", 0, request.url),
	];
}

function setupError(request: Request, code: string) {
	return redirect(
		request,
		`${DEFAULT_RETURN_TO}?github-app-error=${code}`,
		clearedCookies(request),
	);
}

function loginRedirect(request: Request, returnTo: string, cookies: string[]) {
	const params = new URLSearchParams({ redirect: returnTo });
	return redirect(request, `/login?${params.toString()}`, cookies);
}

export type AuthorizeDeps = {
	getSession: (request: Request) => Promise<SessionResult>;
	getClientId: () => string;
	oauthOrigin: () => string;
	generateState?: () => string;
};

export async function handleGitHubAppAuthorize(
	request: Request,
	deps: AuthorizeDeps,
): Promise<Response> {
	const requestUrl = new URL(request.url);
	const returnTo = normalizeReturnTo(requestUrl.searchParams.get("returnTo"));

	let session: SessionResult;
	try {
		session = await deps.getSession(request);
	} catch (error) {
		logRouteError("github-app-oauth", "session lookup failed", error);
		return setupError(request, "session-unavailable");
	}
	if (!session) {
		return loginRedirect(request, returnTo, []);
	}

	let clientId: string;
	try {
		clientId = deps.getClientId();
	} catch (error) {
		logRouteError("github-app-oauth", "GitHub App is not configured", error);
		return setupError(request, "not-configured");
	}

	const state = (deps.generateState ?? (() => crypto.randomUUID()))();
	const authorizeUrl = new URL("/login/oauth/authorize", deps.oauthOrigin());
	authorizeUrl.searchParams.set("client_id", clientId);
	authorizeUrl.searchParams.set(
		"redirect_uri",
		new URL("/api/github/app/callback", request.url).toString(),
	);
	authorizeUrl.searchParams.set("state", state);

	return redirect(request, authorizeUrl.toString(), [
		serializeCookie(STATE_COOKIE, state, COOKIE_MAX_AGE_SECONDS, request.url),
		serializeCookie(
			RETURN_TO_COOKIE,
			returnTo,
			COOKIE_MAX_AGE_SECONDS,
			request.url,
		),
	]);
}

export type CallbackDeps = {
	getSession: (request: Request) => Promise<SessionResult>;
	exchangeCode: (input: {
		code: string;
		redirectUri: string;
		userId: string;
	}) => Promise<void>;
};

export async function handleGitHubAppCallback(
	request: Request,
	deps: CallbackDeps,
): Promise<Response> {
	const requestUrl = new URL(request.url);
	const code = requestUrl.searchParams.get("code");
	const state = requestUrl.searchParams.get("state");
	const cookieHeader = request.headers.get("cookie");
	const expectedState = readCookieValue(cookieHeader, STATE_COOKIE);
	const returnTo = normalizeReturnTo(
		readCookieValue(cookieHeader, RETURN_TO_COOKIE),
	);

	if (
		!code ||
		!state ||
		!expectedState ||
		!constantTimeEqual(state, expectedState)
	) {
		return setupError(request, "invalid-state");
	}

	let session: SessionResult;
	try {
		session = await deps.getSession(request);
	} catch (error) {
		logRouteError("github-app-oauth", "session lookup failed", error);
		return setupError(request, "session-unavailable");
	}
	if (!session) {
		return loginRedirect(request, returnTo, clearedCookies(request));
	}

	try {
		await deps.exchangeCode({
			code,
			redirectUri: new URL("/api/github/app/callback", request.url).toString(),
			userId: session.user.id,
		});
	} catch (error) {
		logRouteError("github-app-oauth", "failed to exchange code", error);
		return setupError(request, "exchange-failed");
	}

	return redirect(request, returnTo, clearedCookies(request));
}
