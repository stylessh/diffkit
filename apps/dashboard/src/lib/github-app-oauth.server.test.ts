import { afterEach, describe, expect, it, vi } from "vitest";
import {
	type AuthorizeDeps,
	type CallbackDeps,
	handleGitHubAppAuthorize,
	handleGitHubAppCallback,
} from "./github-app-oauth.server";

const ORIGIN = "https://diffkit.test";

afterEach(() => {
	vi.restoreAllMocks();
});

function setCookies(response: Response) {
	return response.headers.getSetCookie();
}

function cookieValue(response: Response, name: string) {
	const cookie = setCookies(response).find((entry) =>
		entry.startsWith(`${name}=`),
	);
	return cookie
		? decodeURIComponent(cookie.slice(name.length + 1).split(";")[0])
		: null;
}

function authorizeDeps(overrides: Partial<AuthorizeDeps> = {}): AuthorizeDeps {
	return {
		getSession: async () => ({ user: { id: "u1" } }),
		getClientId: () => "Iv1.client",
		oauthOrigin: () => "https://github.com",
		generateState: () => "state-123",
		...overrides,
	};
}

describe("GitHub App authorize", () => {
	it("redirects to GitHub with state and a same-origin callback", async () => {
		const response = await handleGitHubAppAuthorize(
			new Request(
				`${ORIGIN}/api/github/app/authorize?returnTo=/acme/api/pull/4`,
			),
			authorizeDeps(),
		);
		expect(response.status).toBe(302);
		const location = new URL(response.headers.get("Location") ?? "");
		expect(location.origin + location.pathname).toBe(
			"https://github.com/login/oauth/authorize",
		);
		expect(location.searchParams.get("client_id")).toBe("Iv1.client");
		expect(location.searchParams.get("state")).toBe("state-123");
		expect(location.searchParams.get("redirect_uri")).toBe(
			`${ORIGIN}/api/github/app/callback`,
		);
		expect(cookieValue(response, "github_app_oauth_state")).toBe("state-123");
		expect(cookieValue(response, "github_app_oauth_return_to")).toBe(
			"/acme/api/pull/4",
		);
	});

	it("sets HttpOnly, SameSite=Lax, Secure and a short Max-Age on its cookies", async () => {
		const response = await handleGitHubAppAuthorize(
			new Request(`${ORIGIN}/api/github/app/authorize`),
			authorizeDeps(),
		);
		const cookies = setCookies(response);
		expect(cookies).toHaveLength(2);
		for (const cookie of cookies) {
			expect(cookie).toContain("; HttpOnly");
			expect(cookie).toContain("; SameSite=Lax");
			expect(cookie).toContain("; Secure");
			expect(cookie).toContain("; Max-Age=600");
			expect(cookie).toContain("; Path=/");
		}
	});

	it("is Secure behind a TLS-terminating proxy, and only skips it on localhost", async () => {
		const secure = async (url: string) =>
			setCookies(
				await handleGitHubAppAuthorize(new Request(url), authorizeDeps()),
			)[0].includes("; Secure");
		expect(
			await secure("http://app.example.com/api/github/app/authorize"),
		).toBe(true);
		expect(await secure("http://localhost:3000/api/github/app/authorize")).toBe(
			false,
		);
	});

	it.each([
		"https://evil.com/x",
		"//evil.com",
		"/\\evil.com",
		"/\t/evil.com",
		"javascript:alert(1)",
	])("falls back to /setup for returnTo=%j", async (returnTo) => {
		const response = await handleGitHubAppAuthorize(
			new Request(
				`${ORIGIN}/api/github/app/authorize?returnTo=${encodeURIComponent(returnTo)}`,
			),
			authorizeDeps(),
		);
		expect(cookieValue(response, "github_app_oauth_return_to")).toBe("/setup");
	});

	it("sends signed-out users to /login with a safe redirect and no cookies", async () => {
		const response = await handleGitHubAppAuthorize(
			new Request(`${ORIGIN}/api/github/app/authorize?returnTo=/a/b`),
			authorizeDeps({ getSession: async () => null }),
		);
		expect(response.status).toBe(302);
		expect(response.headers.get("Location")).toBe(
			`${ORIGIN}/login?redirect=%2Fa%2Fb`,
		);
		expect(setCookies(response)).toEqual([]);
	});

	it("redirects to /setup with an error instead of throwing when D1 is down", async () => {
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		const response = await handleGitHubAppAuthorize(
			new Request(`${ORIGIN}/api/github/app/authorize`),
			authorizeDeps({
				getSession: async () => {
					throw new Error("D1_ERROR");
				},
			}),
		);
		expect(response.headers.get("Location")).toBe(
			`${ORIGIN}/setup?github-app-error=session-unavailable`,
		);
	});
});

function callbackRequest(
	query: string,
	cookies: Record<string, string> = {
		github_app_oauth_state: "state-123",
		github_app_oauth_return_to: "/acme/api",
	},
) {
	return new Request(`${ORIGIN}/api/github/app/callback?${query}`, {
		headers: {
			cookie: Object.entries(cookies)
				.map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
				.join("; "),
		},
	});
}

function callbackDeps(overrides: Partial<CallbackDeps> = {}) {
	const exchangeCode = vi.fn(async () => undefined);
	const deps: CallbackDeps = {
		getSession: async () => ({ user: { id: "u1" } }),
		exchangeCode,
		...overrides,
	};
	return { deps, exchangeCode };
}

function clearedCookieNames(response: Response) {
	return setCookies(response)
		.filter(
			(cookie) => cookie.includes("Max-Age=0") && cookie.includes("HttpOnly"),
		)
		.map((cookie) => cookie.split("=")[0]);
}

const BOTH_COOKIES = ["github_app_oauth_state", "github_app_oauth_return_to"];

describe("GitHub App callback", () => {
	it("exchanges the code for the signed-in user and returns to the stored path", async () => {
		const { deps, exchangeCode } = callbackDeps();
		const response = await handleGitHubAppCallback(
			callbackRequest("code=abc&state=state-123"),
			deps,
		);
		expect(exchangeCode).toHaveBeenCalledWith({
			code: "abc",
			redirectUri: `${ORIGIN}/api/github/app/callback`,
			userId: "u1",
		});
		expect(response.status).toBe(302);
		expect(response.headers.get("Location")).toBe(`${ORIGIN}/acme/api`);
		expect(clearedCookieNames(response)).toEqual(BOTH_COOKIES);
	});

	it("rejects a missing code, state or cookie with a well-formed error URL", async () => {
		const cases: Array<[string, Record<string, string> | undefined]> = [
			["state=state-123", undefined],
			["code=abc", undefined],
			["code=abc&state=other", undefined],
			["code=abc&state=state-123", {}],
			["code=abc&state=", { github_app_oauth_state: "" }],
			["code=abc&state=state-12", undefined],
		];
		for (const [query, cookies] of cases) {
			const { deps, exchangeCode } = callbackDeps();
			const response = await handleGitHubAppCallback(
				callbackRequest(query, cookies),
				deps,
			);
			expect(response.headers.get("Location"), query).toBe(
				`${ORIGIN}/setup?github-app-error=invalid-state`,
			);
			expect(exchangeCode).not.toHaveBeenCalled();
			expect(clearedCookieNames(response)).toEqual(BOTH_COOKIES);
		}
	});

	it.each([
		"https://evil.com/phish",
		"//evil.com/phish",
		"/\\evil.com",
		"/\t/evil.com",
	])("never redirects off-site, even if the return_to cookie is %j", async (returnTo) => {
		const { deps } = callbackDeps();
		const response = await handleGitHubAppCallback(
			callbackRequest("code=abc&state=state-123", {
				github_app_oauth_state: "state-123",
				github_app_oauth_return_to: returnTo,
			}),
			deps,
		);
		const location = new URL(response.headers.get("Location") ?? "");
		expect(location.origin).toBe(ORIGIN);
		expect(location.pathname).toBe("/setup");
	});

	it("does not crash on cookies with broken percent-encoding", async () => {
		const { deps } = callbackDeps();
		const request = new Request(
			`${ORIGIN}/api/github/app/callback?code=abc&state=%E0%A4%A`,
			{
				headers: {
					cookie:
						"github_app_oauth_state=%E0%A4%A; github_app_oauth_return_to=%",
				},
			},
		);
		const response = await handleGitHubAppCallback(request, deps);
		expect(response.status).toBe(302);
		expect(response.headers.get("Location")).toContain("invalid-state");
	});

	it("sends signed-out users to /login, keeping the stored path", async () => {
		const { deps, exchangeCode } = callbackDeps({
			getSession: async () => null,
		});
		const response = await handleGitHubAppCallback(
			callbackRequest("code=abc&state=state-123"),
			deps,
		);
		expect(response.headers.get("Location")).toBe(
			`${ORIGIN}/login?redirect=%2Facme%2Fapi`,
		);
		expect(exchangeCode).not.toHaveBeenCalled();
		expect(clearedCookieNames(response)).toEqual(BOTH_COOKIES);
	});

	it("reports an exchange failure without echoing the code or token details", async () => {
		const error = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		const { deps } = callbackDeps({
			exchangeCode: async () => {
				throw new Error(
					"GitHub App user token request failed: bad_verification_code",
				);
			},
		});
		const response = await handleGitHubAppCallback(
			callbackRequest("code=super-secret-code&state=state-123"),
			deps,
		);
		expect(response.headers.get("Location")).toBe(
			`${ORIGIN}/setup?github-app-error=exchange-failed`,
		);
		expect(clearedCookieNames(response)).toEqual(BOTH_COOKIES);
		expect(JSON.stringify(error.mock.calls)).not.toContain("super-secret-code");
	});
});
