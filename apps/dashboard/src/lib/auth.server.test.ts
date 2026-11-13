import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestD1 } from "./testing/d1-sqlite";

const ORIGIN = "https://diffkit.test";
const EMULATOR_URL = "http://emulator.test";

const runtime = vi.hoisted(() => ({
	db: null as unknown as D1Database,
	env: {} as Record<string, unknown>,
	emulatorUrl: null as string | null,
}));

vi.mock("cloudflare:workers", () => ({
	env: runtime.env,
	waitUntil: vi.fn(),
}));
vi.mock("../db", async () => {
	const { drizzle } = await import("drizzle-orm/d1");
	const schema = await import("../db/schema");
	return { getDb: () => drizzle(runtime.db, { schema }) };
});
vi.mock("./github-emulator.server", () => ({
	getGitHubEmulatorUrl: () => runtime.emulatorUrl,
	getGitHubOAuthOrigin: () => runtime.emulatorUrl ?? "https://github.com",
}));

const { DISABLED_AUTH_PATHS, getAuth } = await import("./auth.server");

/** Every endpoint the dashboard and the OAuth redirects reach. */
const USED_AUTH_PATHS = [
	"/sign-in/social",
	"/callback/:id",
	"/sign-in/oauth2",
	"/oauth2/callback/:providerId",
	"/get-session",
	"/sign-out",
	"/ok",
	"/error",
];

/**
 * `disabledPaths` matches literal paths, so this parameterised route cannot be
 * listed. It only accepts a token issued by `/request-password-reset`, which
 * is disabled.
 */
const UNREACHABLE_AUTH_PATHS = ["/reset-password/:token"];

type GitHubIdentity = {
	id: number;
	login: string;
	email: string;
	token: string;
};

const ADA: GitHubIdentity = {
	id: 1001,
	login: "ada",
	email: "shared@example.test",
	token: "token-ada",
};
const NEW_HOLDER: GitHubIdentity = {
	id: 2002,
	login: "newcomer",
	email: "shared@example.test",
	token: "token-newcomer",
};
const GRACE: GitHubIdentity = {
	id: 3003,
	login: "grace",
	email: "grace@example.test",
	token: "token-grace",
};

function stubGitHub(identity: GitHubIdentity) {
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: RequestInfo | URL) => {
			const { pathname } = new URL(
				input instanceof Request ? input.url : String(input),
			);
			if (pathname === "/login/oauth/access_token") {
				return Response.json({
					access_token: identity.token,
					token_type: "bearer",
					scope: "repo,read:org,user:email",
				});
			}
			if (pathname === "/user") {
				return Response.json({
					id: identity.id,
					login: identity.login,
					name: identity.login,
					email: null,
					avatar_url: `https://avatars.example.test/${identity.login}.png`,
				});
			}
			if (pathname === "/user/emails") {
				return Response.json([
					{ email: identity.email, primary: true, verified: true },
				]);
			}
			throw new Error(`Unexpected request to ${pathname}`);
		}),
	);
}

function cookieHeader(jar: Map<string, string>) {
	return Array.from(jar, ([name, value]) => `${name}=${value}`).join("; ");
}

function storeCookies(jar: Map<string, string>, response: Response) {
	for (const cookie of response.headers.getSetCookie()) {
		const [pair, ...attributes] = cookie.split(";");
		const separator = pair.indexOf("=");
		const name = pair.slice(0, separator);
		const expired = attributes.some(
			(attribute) => attribute.trim().toLowerCase() === "max-age=0",
		);
		if (expired) {
			jar.delete(name);
		} else {
			jar.set(name, pair.slice(separator + 1));
		}
	}
}

function post(path: string, body: unknown, jar: Map<string, string>) {
	return getAuth().handler(
		new Request(`${ORIGIN}/api/auth${path}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Origin: ORIGIN,
				Cookie: cookieHeader(jar),
			},
			body: JSON.stringify(body),
		}),
	);
}

/**
 * One browser's GitHub sign-in: start the flow, then follow GitHub's redirect
 * back to the callback. Returns where the callback sent the browser and the
 * cookies it ended up with.
 */
async function signIn(identity: GitHubIdentity) {
	stubGitHub(identity);
	const jar = new Map<string, string>();

	const start = await post(
		runtime.emulatorUrl ? "/sign-in/oauth2" : "/sign-in/social",
		runtime.emulatorUrl
			? { providerId: "github", callbackURL: "/", errorCallbackURL: "/login" }
			: { provider: "github", callbackURL: "/", errorCallbackURL: "/login" },
		jar,
	);
	if (!start.ok) {
		throw new Error(`Starting the sign-in answered ${start.status}`);
	}
	storeCookies(jar, start);
	const { url } = (await start.json()) as { url: string };
	const state = new URL(url).searchParams.get("state");

	const callbackPath = runtime.emulatorUrl
		? "/oauth2/callback/github"
		: "/callback/github";
	const callback = await getAuth().handler(
		new Request(
			`${ORIGIN}/api/auth${callbackPath}?code=code-${identity.id}&state=${state}`,
			{ headers: { Cookie: cookieHeader(jar) } },
		),
	);
	storeCookies(jar, callback);

	return {
		location: new URL(callback.headers.get("Location") ?? "", ORIGIN),
		jar,
	};
}

async function sessionUser(jar: Map<string, string>) {
	const response = await getAuth().handler(
		new Request(`${ORIGIN}/api/auth/get-session`, {
			headers: { Cookie: cookieHeader(jar) },
		}),
	);
	const body = (await response.json()) as {
		user: { id: string; email: string };
	} | null;
	return body?.user ?? null;
}

let sqlite: ReturnType<typeof createTestD1>["sqlite"];

function accountRows() {
	return sqlite
		.prepare(
			"select user_id, account_id, access_token from account order by account_id",
		)
		.all();
}

beforeEach(() => {
	const d1 = createTestD1(["0000_pretty_the_call.sql"]);
	runtime.db = d1.db;
	sqlite = d1.sqlite;
	runtime.env.BETTER_AUTH_URL = ORIGIN;
	runtime.env.BETTER_AUTH_SECRET = "test-secret-with-at-least-32-characters";
	runtime.env.GITHUB_OAUTH_CLIENT_ID = "oauth-client";
	runtime.env.GITHUB_OAUTH_CLIENT_SECRET = "oauth-secret";
	vi.spyOn(console, "warn").mockImplementation(() => undefined);
	vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe.each([
	{ mode: "github.com", emulatorUrl: null },
	{ mode: "the demo emulator", emulatorUrl: EMULATOR_URL },
])("GitHub sign-in through $mode", ({ emulatorUrl }) => {
	beforeEach(() => {
		runtime.emulatorUrl = emulatorUrl;
	});

	it("creates a user on the first sign-in and reuses it, with the fresh token, on the next", async () => {
		const first = await signIn(ADA);
		expect(first.location.pathname).toBe("/");
		const firstUser = await sessionUser(first.jar);
		expect(firstUser?.email).toBe(ADA.email);

		const returning = await signIn({ ...ADA, token: "token-ada-renewed" });
		expect(returning.location.pathname).toBe("/");
		expect((await sessionUser(returning.jar))?.id).toBe(firstUser?.id);

		expect(accountRows()).toEqual([
			{
				user_id: firstUser?.id,
				account_id: String(ADA.id),
				access_token: "token-ada-renewed",
			},
		]);
	});

	it("gives a second GitHub account its own user", async () => {
		const ada = await sessionUser((await signIn(ADA)).jar);
		const grace = await sessionUser((await signIn(GRACE)).jar);

		expect(grace?.email).toBe(GRACE.email);
		expect(grace?.id).not.toBe(ada?.id);
	});

	it("refuses a different GitHub account whose verified email matches an existing user", async () => {
		const ada = await sessionUser((await signIn(ADA)).jar);

		const refused = await signIn(NEW_HOLDER);

		expect(refused.location.pathname).toBe("/login");
		expect(refused.location.searchParams.get("error")).toBe(
			"account_not_linked",
		);
		expect(await sessionUser(refused.jar)).toBeNull();
		expect(accountRows()).toEqual([
			{
				user_id: ada?.id,
				account_id: String(ADA.id),
				access_token: ADA.token,
			},
		]);
	});

	it("answers 404 on every disabled endpoint, even with a valid session", async () => {
		const { jar } = await signIn(ADA);

		for (const path of DISABLED_AUTH_PATHS) {
			const viaPost = await post(path, {}, jar);
			const viaGet = await getAuth().handler(
				new Request(`${ORIGIN}/api/auth${path}`, {
					headers: { Cookie: cookieHeader(jar) },
				}),
			);
			expect([viaPost.status, viaGet.status], path).toEqual([404, 404]);
		}
	});

	it("registers no endpoint that is neither used nor disabled", () => {
		const registered = new Set(
			Object.values(getAuth().api).flatMap((endpoint) =>
				"path" in endpoint && typeof endpoint.path === "string"
					? [endpoint.path]
					: [],
			),
		);
		const accounted = new Set([
			...USED_AUTH_PATHS,
			...DISABLED_AUTH_PATHS,
			...UNREACHABLE_AUTH_PATHS,
		]);

		expect(registered.size).toBeGreaterThan(USED_AUTH_PATHS.length);
		expect([...registered].filter((path) => !accounted.has(path))).toEqual([]);
	});
});
