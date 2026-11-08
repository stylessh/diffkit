import "@tanstack/react-start/server-only";
import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { account } from "../db/schema";
import { debug } from "./debug";
import { getGitHubOAuthOrigin } from "./github-emulator.server";
import { normalizeGitHubAppPrivateKey } from "./github-private-key";
import { GITHUB_REQUEST_TIMEOUT_MS } from "./github-request-policy";
import { describeError } from "./route-safety.server";

export const GITHUB_OAUTH_PROVIDER_ID = "github";
const GITHUB_APP_USER_PROVIDER_ID = "github-app";

type StoredAccount = typeof account.$inferSelect;

const TOKEN_EXPIRY_MARGIN_MS = 5 * 60 * 1000;

type EnvStringKey =
	| "GITHUB_OAUTH_CLIENT_ID"
	| "GITHUB_CLIENT_ID"
	| "GITHUB_OAUTH_CLIENT_SECRET"
	| "GITHUB_CLIENT_SECRET"
	| "GITHUB_APP_CLIENT_ID"
	| "GITHUB_APP_CLIENT_SECRET"
	| "GITHUB_APP_ID"
	| "GITHUB_APP_PRIVATE_KEY"
	| "GITHUB_APP_SLUG"
	| "GITHUB_WEBHOOK_SECRET";

type AppUserToken = {
	accessToken: string;
	refreshToken: string | null;
	accessTokenExpiresAt: Date | null;
	refreshTokenExpiresAt: Date | null;
	scope: string | null;
};

type AppUserTokenState =
	| { status: "missing" }
	| { status: "fresh"; accessToken: string }
	| { status: "refreshable"; refreshToken: string }
	| { status: "expired" };

function readEnvString(key: EnvStringKey): string | undefined {
	const value: unknown = env[key];
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

function firstDefined(...values: Array<string | undefined>) {
	return values.find((value) => value !== undefined);
}

export function getGitHubOAuthConfig() {
	const clientId = firstDefined(
		readEnvString("GITHUB_OAUTH_CLIENT_ID"),
		readEnvString("GITHUB_CLIENT_ID"),
	);
	const clientSecret = firstDefined(
		readEnvString("GITHUB_OAUTH_CLIENT_SECRET"),
		readEnvString("GITHUB_CLIENT_SECRET"),
	);

	if (!clientId || !clientSecret) {
		throw new Error(
			"Missing GitHub OAuth credentials. Set GITHUB_OAUTH_CLIENT_ID and GITHUB_OAUTH_CLIENT_SECRET.",
		);
	}

	return { clientId, clientSecret };
}

export function getGitHubAppAuthConfig() {
	const clientId = readEnvString("GITHUB_APP_CLIENT_ID");
	const clientSecret = readEnvString("GITHUB_APP_CLIENT_SECRET");

	if (!clientId || !clientSecret) {
		throw new Error(
			"Missing GitHub App credentials. Set GITHUB_APP_CLIENT_ID and GITHUB_APP_CLIENT_SECRET.",
		);
	}

	return { clientId, clientSecret };
}

export function getGitHubAppId(): string | null {
	return readEnvString("GITHUB_APP_ID") ?? null;
}

export function getGitHubAppPrivateKey(): string | null {
	const privateKey = readEnvString("GITHUB_APP_PRIVATE_KEY");
	return privateKey ? normalizeGitHubAppPrivateKey(privateKey) : null;
}

export function getGitHubAppSlug(): string | null {
	return readEnvString("GITHUB_APP_SLUG") ?? null;
}

export function getGitHubWebhookSecret() {
	return readEnvString("GITHUB_WEBHOOK_SECRET") ?? null;
}

export async function getGitHubAccessTokenByUserId(userId: string) {
	const githubAccount = await getGitHubOAuthAccountByUserId(userId);

	if (!githubAccount?.accessToken) {
		throw new Error("No GitHub account linked");
	}

	return githubAccount.accessToken;
}

function getGitHubOAuthAccountByUserId(userId: string) {
	return getAccountByProvider(userId, GITHUB_OAUTH_PROVIDER_ID);
}

function getGitHubAppUserAccountByUserId(userId: string) {
	return getAccountByProvider(userId, GITHUB_APP_USER_PROVIDER_ID);
}

function getAccountByProvider(userId: string, providerId: string) {
	return getDb()
		.select()
		.from(account)
		.where(and(eq(account.userId, userId), eq(account.providerId, providerId)))
		.get();
}

export async function hasGitHubAppUserAccount(userId: string) {
	const row = await getGitHubAppUserAccountByUserId(userId);
	return Boolean(row?.accessToken);
}

function outlivesExpiryMargin(expiresAt: Date | null, now: number) {
	return (
		expiresAt === null || expiresAt.getTime() - now > TOKEN_EXPIRY_MARGIN_MS
	);
}

function classifyAppUserToken(
	stored: StoredAccount | undefined,
	now: number,
): AppUserTokenState {
	if (!stored?.accessToken) {
		return { status: "missing" };
	}
	if (outlivesExpiryMargin(stored.accessTokenExpiresAt, now)) {
		return { status: "fresh", accessToken: stored.accessToken };
	}
	if (
		stored.refreshToken &&
		outlivesExpiryMargin(stored.refreshTokenExpiresAt, now)
	) {
		return { status: "refreshable", refreshToken: stored.refreshToken };
	}
	return { status: "expired" };
}

function expiresInFromNow(seconds: number | undefined) {
	return seconds && seconds > 0 ? new Date(Date.now() + seconds * 1000) : null;
}

function stringField(value: unknown) {
	return typeof value === "string" ? value : undefined;
}

function numberField(value: unknown) {
	return typeof value === "number" && Number.isFinite(value)
		? value
		: undefined;
}

async function requestGitHubAppUserToken(
	params: Record<string, string>,
): Promise<AppUserToken> {
	const response = await fetch(
		`${getGitHubOAuthOrigin()}/login/oauth/access_token`,
		{
			method: "POST",
			headers: {
				Accept: "application/json",
				"Content-Type": "application/x-www-form-urlencoded",
			},
			signal: AbortSignal.timeout(GITHUB_REQUEST_TIMEOUT_MS),
			body: new URLSearchParams(params),
		},
	);
	// An upstream 5xx can answer with HTML.
	const body: unknown = await response.json().catch(() => null);
	const fields: Record<string, unknown> =
		typeof body === "object" && body !== null && !Array.isArray(body)
			? { ...body }
			: {};
	const accessToken = stringField(fields.access_token);

	if (!response.ok || !accessToken) {
		const message =
			stringField(fields.error_description) ??
			stringField(fields.error) ??
			(response.statusText || `HTTP ${response.status}`);
		throw new Error(`GitHub App user token request failed: ${message}`);
	}

	return {
		accessToken,
		refreshToken: stringField(fields.refresh_token) ?? null,
		accessTokenExpiresAt: expiresInFromNow(numberField(fields.expires_in)),
		refreshTokenExpiresAt: expiresInFromNow(
			numberField(fields.refresh_token_expires_in),
		),
		scope: stringField(fields.scope) ?? null,
	};
}

export async function exchangeGitHubAppUserCode({
	code,
	redirectUri,
	userId,
}: {
	code: string;
	redirectUri?: string;
	userId: string;
}) {
	const githubApp = getGitHubAppAuthConfig();
	const token = await requestGitHubAppUserToken({
		client_id: githubApp.clientId,
		client_secret: githubApp.clientSecret,
		code,
		...(redirectUri ? { redirect_uri: redirectUri } : {}),
	});

	await saveGitHubAppUserToken(userId, token);
}

// GitHub rotates the refresh token on every use, so concurrent refreshes with
// the same token would invalidate each other.
const refreshInflight = new Map<string, Promise<string>>();

function refreshGitHubAppUserToken(
	userId: string,
	refreshToken: string,
): Promise<string> {
	const existing = refreshInflight.get(userId);
	if (existing) {
		return existing;
	}

	const task = performGitHubAppUserTokenRefresh(userId, refreshToken).finally(
		() => {
			refreshInflight.delete(userId);
		},
	);
	refreshInflight.set(userId, task);
	return task;
}

async function performGitHubAppUserTokenRefresh(
	userId: string,
	refreshToken: string,
): Promise<string> {
	const githubApp = getGitHubAppAuthConfig();
	let token: AppUserToken;
	try {
		token = await requestGitHubAppUserToken({
			client_id: githubApp.clientId,
			client_secret: githubApp.clientSecret,
			grant_type: "refresh_token",
			refresh_token: refreshToken,
		});
	} catch (error) {
		console.error(
			"[github-auth] app user token refresh failed",
			userId,
			describeError(error),
		);
		throw error;
	}

	try {
		await saveGitHubAppUserToken(userId, token).catch(() =>
			saveGitHubAppUserToken(userId, token),
		);
	} catch (error) {
		// The new access token is good for this request even if D1 rejects the
		// write twice. The old refresh token is already rotated out, so the next
		// refresh fails and the user re-authorizes; that beats failing this page.
		console.error(
			"[github-auth] failed to store refreshed app user token",
			userId,
			describeError(error),
		);
	}

	return token.accessToken;
}

async function saveGitHubAppUserToken(userId: string, token: AppUserToken) {
	const db = getDb();
	const now = new Date();
	const existingAccount = await getGitHubAppUserAccountByUserId(userId);
	const oauthAccount = await getGitHubOAuthAccountByUserId(userId);
	const values = {
		...token,
		accountId: oauthAccount?.accountId ?? userId,
		providerId: GITHUB_APP_USER_PROVIDER_ID,
		userId,
		updatedAt: now,
	};

	if (existingAccount) {
		await db
			.update(account)
			.set(values)
			.where(eq(account.id, existingAccount.id));
		return;
	}

	await db.insert(account).values({
		id: crypto.randomUUID(),
		...values,
		idToken: null,
		password: null,
		createdAt: now,
	});
}

export async function getGitHubAppUserAccessTokenByUserId(userId: string) {
	const state = classifyAppUserToken(
		await getGitHubAppUserAccountByUserId(userId),
		Date.now(),
	);
	debug("github-auth", "app user token", { userId, status: state.status });

	switch (state.status) {
		case "fresh":
			return state.accessToken;
		case "refreshable":
			return refreshGitHubAppUserToken(userId, state.refreshToken);
		case "missing":
		case "expired":
			return null;
	}
}

const SHA256_HEX_SIGNATURE = /^[0-9a-f]{64}$/i;

function fromHex(hex: string) {
	if (!SHA256_HEX_SIGNATURE.test(hex)) {
		return null;
	}

	const bytes = new Uint8Array(hex.length / 2);
	for (let index = 0; index < bytes.length; index += 1) {
		bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
	}

	return bytes;
}

export async function verifyGitHubWebhookSignature({
	body,
	secret,
	signature,
}: {
	body: string;
	secret: string;
	signature: string | null;
}) {
	if (!signature?.startsWith("sha256=")) {
		return false;
	}

	const expectedSignature = fromHex(signature.slice("sha256=".length));
	if (!expectedSignature) {
		return false;
	}

	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["verify"],
	);

	// subtle.verify compares in constant time.
	return crypto.subtle.verify(
		"HMAC",
		key,
		expectedSignature,
		new TextEncoder().encode(body),
	);
}
