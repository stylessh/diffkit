import { drizzle } from "drizzle-orm/d1";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "../db/schema";
import { createTestD1 } from "./testing/d1-sqlite";

const runtime = vi.hoisted(() => ({
	db: null as unknown as D1Database,
	env: {} as Record<string, string | undefined>,
}));

vi.mock("cloudflare:workers", () => ({
	env: runtime.env,
	waitUntil: vi.fn(),
}));
vi.mock("../db", async () => {
	const { drizzle: createDrizzle } = await import("drizzle-orm/d1");
	const dbSchema = await import("../db/schema");
	return {
		getDb: () => createDrizzle(runtime.db, { schema: dbSchema }),
	};
});
vi.mock("./github-emulator.server", () => ({
	getGitHubOAuthOrigin: () => "https://github.com",
}));

const { getGitHubAppUserAccessTokenByUserId, verifyGitHubWebhookSignature } =
	await import("./github-app.server");
const { normalizeGitHubAppPrivateKey } = await import("./github-private-key");

describe("normalizeGitHubAppPrivateKey", () => {
	it("converts PKCS#1 RSA private keys to PKCS#8", () => {
		const normalized = normalizeGitHubAppPrivateKey(
			"-----BEGIN RSA PRIVATE KEY-----\\nAQID\\n-----END RSA PRIVATE KEY-----",
		);

		expect(normalized).toContain("-----BEGIN PRIVATE KEY-----");
		expect(normalized).toContain("-----END PRIVATE KEY-----");
		expect(normalized).not.toContain("RSA PRIVATE KEY");
		expect(normalized).not.toContain("AQID");
	});

	it("preserves PKCS#8 private keys while normalizing escaped newlines", () => {
		expect(
			normalizeGitHubAppPrivateKey(
				"-----BEGIN PRIVATE KEY-----\\nAQID\\n-----END PRIVATE KEY-----",
			),
		).toBe("-----BEGIN PRIVATE KEY-----\nAQID\n-----END PRIVATE KEY-----");
	});
});

async function sign(body: string, secret: string) {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = new Uint8Array(
		await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)),
	);
	return Array.from(signature, (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");
}

describe("verifyGitHubWebhookSignature", () => {
	const secret = "It's a Secret to Everybody";
	const body = '{"zen":"Keep it logically awesome."}';

	it("accepts a valid signature, in either hex case", async () => {
		const hex = await sign(body, secret);
		for (const value of [hex, hex.toUpperCase()]) {
			expect(
				await verifyGitHubWebhookSignature({
					body,
					secret,
					signature: `sha256=${value}`,
				}),
			).toBe(true);
		}
	});

	it("rejects a tampered body, a wrong secret and a flipped bit", async () => {
		const hex = await sign(body, secret);
		const signature = `sha256=${hex}`;
		expect(
			await verifyGitHubWebhookSignature({
				body: `${body} `,
				secret,
				signature,
			}),
		).toBe(false);
		expect(
			await verifyGitHubWebhookSignature({
				body,
				secret: "other",
				signature,
			}),
		).toBe(false);
		const flipped = `${hex.slice(0, -1)}${hex.endsWith("0") ? "1" : "0"}`;
		expect(
			await verifyGitHubWebhookSignature({
				body,
				secret,
				signature: `sha256=${flipped}`,
			}),
		).toBe(false);
	});

	it("rejects malformed signatures without throwing", async () => {
		const hex = await sign(body, secret);
		const malformed: Array<string | null> = [
			null,
			"",
			hex,
			"sha1=abc",
			"sha256=",
			"sha256=zz",
			`sha256=${hex.slice(0, 62)}`,
			`sha256=${hex}00`,
			// parseInt("1g", 16) is 1; every pair must be real hex.
			`sha256=${"1g".repeat(32)}`,
			`sha256=${hex.slice(0, 62)}-1`,
			`sha256= ${hex.slice(1)}`,
		];
		for (const signature of malformed) {
			expect(
				await verifyGitHubWebhookSignature({ body, secret, signature }),
			).toBe(false);
		}
	});
});

describe("GitHub App user tokens", () => {
	const now = () => Math.floor(Date.now() / 1000) * 1000;
	const fetchMock = vi.fn();

	function orm() {
		return drizzle(runtime.db, { schema });
	}

	async function seed(app?: Partial<typeof schema.account.$inferInsert>) {
		const db = orm();
		const at = new Date(now());
		await db.insert(schema.user).values({
			id: "u1",
			name: "Ada",
			email: "ada@example.com",
			emailVerified: true,
			createdAt: at,
			updatedAt: at,
		});
		await db.insert(schema.account).values({
			id: "oauth-1",
			accountId: "12345",
			providerId: "github",
			userId: "u1",
			accessToken: "gho_oauth_token",
			createdAt: at,
			updatedAt: at,
		});
		if (app) {
			await db.insert(schema.account).values({
				id: "app-1",
				accountId: "12345",
				providerId: "github-app",
				userId: "u1",
				accessToken: "ghu_old",
				refreshToken: "ghr_old",
				accessTokenExpiresAt: new Date(now() - 60_000),
				refreshTokenExpiresAt: new Date(now() + 86_400_000),
				createdAt: at,
				updatedAt: at,
				...app,
			});
		}
	}

	async function appRow() {
		const [row] = await orm()
			.select()
			.from(schema.account)
			.where(
				(await import("drizzle-orm")).eq(
					schema.account.providerId,
					"github-app",
				),
			);
		return row;
	}

	function tokenResponse(body: unknown, init: ResponseInit = { status: 200 }) {
		return new Response(JSON.stringify(body), {
			headers: { "Content-Type": "application/json" },
			...init,
		});
	}

	beforeEach(() => {
		runtime.db = createTestD1(["0000_pretty_the_call.sql"]).db;
		runtime.env.GITHUB_APP_CLIENT_ID = "app-client";
		runtime.env.GITHUB_APP_CLIENT_SECRET = "app-secret";
		fetchMock.mockReset();
		vi.stubGlobal("fetch", fetchMock);
		vi.spyOn(console, "error").mockImplementation(() => undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns a token that is not about to expire without calling GitHub", async () => {
		await seed({ accessTokenExpiresAt: new Date(now() + 3_600_000) });
		expect(await getGitHubAppUserAccessTokenByUserId("u1")).toBe("ghu_old");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("treats a token inside the 5 minute buffer as expired and refreshes it", async () => {
		await seed({ accessTokenExpiresAt: new Date(now() + 4 * 60_000) });
		fetchMock.mockResolvedValue(
			tokenResponse({
				access_token: "ghu_new",
				refresh_token: "ghr_new",
				expires_in: 28_800,
				refresh_token_expires_in: 15_811_200,
				scope: "",
			}),
		);

		expect(await getGitHubAppUserAccessTokenByUserId("u1")).toBe("ghu_new");

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe("https://github.com/login/oauth/access_token");
		const sent = new URLSearchParams(String(init.body));
		expect(Object.fromEntries(sent)).toEqual({
			client_id: "app-client",
			client_secret: "app-secret",
			grant_type: "refresh_token",
			refresh_token: "ghr_old",
		});
		const row = await appRow();
		expect(row.accessToken).toBe("ghu_new");
		expect(row.refreshToken).toBe("ghr_new");
		expect(row.accessTokenExpiresAt?.getTime()).toBeGreaterThan(Date.now());
	});

	it("shares one refresh between concurrent callers", async () => {
		await seed({});
		let release: (response: Response) => void = () => undefined;
		fetchMock.mockReturnValue(
			new Promise<Response>((resolve) => {
				release = resolve;
			}),
		);

		const calls = [
			getGitHubAppUserAccessTokenByUserId("u1"),
			getGitHubAppUserAccessTokenByUserId("u1"),
			getGitHubAppUserAccessTokenByUserId("u1"),
		];
		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
		release(
			tokenResponse({ access_token: "ghu_new", refresh_token: "ghr_new" }),
		);

		expect(await Promise.all(calls)).toEqual(["ghu_new", "ghu_new", "ghu_new"]);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("does not refresh with an expired refresh token", async () => {
		await seed({ refreshTokenExpiresAt: new Date(now() - 1000) });
		expect(await getGitHubAppUserAccessTokenByUserId("u1")).toBeNull();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("surfaces GitHub's refusal, including non-JSON errors, and keeps the stored tokens", async () => {
		await seed({});
		const failures: Array<[Response, RegExp]> = [
			[
				tokenResponse({
					error: "bad_refresh_token",
					error_description:
						"The refresh token passed is incorrect or expired.",
				}),
				/incorrect or expired/,
			],
			[
				new Response("<html>Bad gateway</html>", { status: 502 }),
				/HTTP 502|Bad Gateway/,
			],
		];
		for (const [response, message] of failures) {
			fetchMock.mockResolvedValueOnce(response);
			await expect(getGitHubAppUserAccessTokenByUserId("u1")).rejects.toThrow(
				message,
			);
			expect((await appRow()).refreshToken).toBe("ghr_old");
		}
		fetchMock.mockResolvedValue(tokenResponse({ access_token: "ghu_new" }));
		expect(await getGitHubAppUserAccessTokenByUserId("u1")).toBe("ghu_new");
	});

	it("retries a failed token write once so the rotated refresh token is not lost", async () => {
		await seed({});
		const realPrepare = runtime.db.prepare.bind(runtime.db);
		let updates = 0;
		runtime.db = {
			...runtime.db,
			prepare: (sql: string) => {
				if (sql.trim().toLowerCase().startsWith("update") && updates++ === 0) {
					throw new Error("D1_ERROR: transient");
				}
				return realPrepare(sql);
			},
		} as unknown as D1Database;
		fetchMock.mockResolvedValue(
			tokenResponse({ access_token: "ghu_new", refresh_token: "ghr_new" }),
		);

		expect(await getGitHubAppUserAccessTokenByUserId("u1")).toBe("ghu_new");

		expect((await appRow()).refreshToken).toBe("ghr_new");
		expect(console.error).not.toHaveBeenCalled();
	});

	it("still returns the refreshed token when D1 rejects the write, without logging it", async () => {
		await seed({});
		const realPrepare = runtime.db.prepare.bind(runtime.db);
		runtime.db = {
			...runtime.db,
			prepare: (sql: string) => {
				if (sql.trim().toLowerCase().startsWith("update")) {
					throw new Error(
						`Failed query: ${sql}\nparams: ghu_leaky_token_value_1`,
					);
				}
				return realPrepare(sql);
			},
		} as unknown as D1Database;
		fetchMock.mockResolvedValue(
			tokenResponse({ access_token: "ghu_new", refresh_token: "ghr_new" }),
		);

		expect(await getGitHubAppUserAccessTokenByUserId("u1")).toBe("ghu_new");

		const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
		expect(logged).toContain("failed to store refreshed app user token");
		expect(logged).not.toContain("ghu_leaky");
	});
});
