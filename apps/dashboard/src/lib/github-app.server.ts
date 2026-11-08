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

type WorkerEnvRecord = typeof env & Record<string, string | undefined>;

export const GITHUB_OAUTH_PROVIDER_ID = "github";
const GITHUB_APP_USER_PROVIDER_ID = "github-app";

type GitHubTokenResponse = {
	access_token?: string;
	token_type?: string;
	expires_in?: number;
	refresh_token?: string;
	refresh_token_expires_in?: number;
	scope?: string;
	error?: string;
	error_description?: string;
};

function getWorkerEnv() {
	return env as WorkerEnvRecord;
}

function pickFirstNonEmpty(...values: Array<string | null | undefined>) {
	return values.find((value) => typeof value === "string" && value.length > 0);
}

/**
 * Returns the classic OAuth App credentials used for user authentication.
 * OAuth App tokens support scopes (e.g. `repo`) and don't expire.
 */
export function getGitHubOAuthConfig() {
	const workerEnv = getWorkerEnv();
	const clientId = pickFirstNonEmpty(
		workerEnv.GITHUB_OAUTH_CLIENT_ID,
		workerEnv.GITHUB_CLIENT_ID,
	);
	const clientSecret = pickFirstNonEmpty(
		workerEnv.GITHUB_OAUTH_CLIENT_SECRET,
		workerEnv.GITHUB_CLIENT_SECRET,
	);

	if (!clientId || !clientSecret) {
		throw new Error(
			"Missing GitHub OAuth credentials. Set GITHUB_OAUTH_CLIENT_ID and GITHUB_OAUTH_CLIENT_SECRET.",
		);
	}

	return { clientId, clientSecret };
}

/**
 * Returns the GitHub App credentials used for webhooks and installation management.
 */
export function getGitHubAppAuthConfig() {
	const workerEnv = getWorkerEnv();
	const clientId = pickFirstNonEmpty(workerEnv.GITHUB_APP_CLIENT_ID);
	const clientSecret = pickFirstNonEmpty(workerEnv.GITHUB_APP_CLIENT_SECRET);

	if (!clientId || !clientSecret) {
		throw new Error(
			"Missing GitHub App credentials. Set GITHUB_APP_CLIENT_ID and GITHUB_APP_CLIENT_SECRET.",
		);
	}

	return { clientId, clientSecret };
}

export function getGitHubAppId(): string | null {
	return pickFirstNonEmpty(getWorkerEnv().GITHUB_APP_ID) ?? null;
}

export function getGitHubAppPrivateKey(): string | null {
	const privateKey = pickFirstNonEmpty(getWorkerEnv().GITHUB_APP_PRIVATE_KEY);
	return privateKey ? normalizeGitHubAppPrivateKey(privateKey) : null;
}

export function getGitHubAppSlug(): string | null {
	return pickFirstNonEmpty(getWorkerEnv().GITHUB_APP_SLUG) ?? null;
}

export function getGitHubWebhookSecret() {
	return pickFirstNonEmpty(getWorkerEnv().GITHUB_WEBHOOK_SECRET) ?? null;
}

export async function getGitHubAccessTokenByUserId(userId: string) {
	const githubAccount = await getGitHubOAuthAccountByUserId(userId);

	if (!githubAccount?.accessToken) {
		throw new Error("No GitHub account linked");
	}

	return githubAccount.accessToken;
}

async function getGitHubOAuthAccountByUserId(userId: string) {
	const db = getDb();

	return db
		.select()
		.from(account)
		.where(
			and(
				eq(account.userId, userId),
				eq(account.providerId, GITHUB_OAUTH_PROVIDER_ID),
			),
		)
		.get();
}

export async function hasGitHubAppUserAccount(userId: string) {
	const row = await getGitHubAppUserAccountByUserId(userId);
	return Boolean(row?.accessToken);
}

async function getGitHubAppUserAccountByUserId(userId: string) {
	const db = getDb();

	return db
		.select()
		.from(account)
		.where(
			and(
				eq(account.userId, userId),
				eq(account.providerId, GITHUB_APP_USER_PROVIDER_ID),
			),
		)
		.get();
}

function isRecord(value: unknown): value is GitHubTokenResponse {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getTokenExpiresAt(expiresInSeconds: number | undefined) {
	if (!expiresInSeconds || expiresInSeconds <= 0) {
		return null;
	}

	return new Date(Date.now() + expiresInSeconds * 1000);
}

function isUsableAccessTokenExpiresAt(expiresAt: Date | null) {
	if (!expiresAt) {
		return true;
	}

	return expiresAt.getTime() - Date.now() > 5 * 60 * 1000;
}

async function requestGitHubAppUserToken(params: Record<string, string>) {
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
	// An upstream 5xx can answer with HTML; that is a failed request, not a
	// JSON parse error.
	const payload = await response
		.json()
		.then((body): GitHubTokenResponse => (isRecord(body) ? body : {}))
		.catch((): GitHubTokenResponse => ({}));

	if (!response.ok || !payload.access_token) {
		const message =
			payload.error_description ??
			payload.error ??
			(response.statusText || `HTTP ${response.status}`);
		throw new Error(`GitHub App user token request failed: ${message}`);
	}

	return payload;
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
	const payload = await requestGitHubAppUserToken({
		client_id: githubApp.clientId,
		client_secret: githubApp.clientSecret,
		code,
		...(redirectUri ? { redirect_uri: redirectUri } : {}),
	});

	await saveGitHubAppUserToken({
		userId,
		payload,
	});
}

/**
 * GitHub rotates the refresh token on every use, so two concurrent refreshes
 * with the same token would invalidate each other. Calls for the same user in
 * one isolate share a single exchange.
 */
const refreshInflight = new Map<string, Promise<string | null>>();

function refreshGitHubAppUserToken(params: {
	refreshToken: string;
	userId: string;
}): Promise<string | null> {
	const existing = refreshInflight.get(params.userId);
	if (existing) {
		return existing;
	}

	const task = performGitHubAppUserTokenRefresh(params).finally(() => {
		refreshInflight.delete(params.userId);
	});
	refreshInflight.set(params.userId, task);
	return task;
}

async function performGitHubAppUserTokenRefresh({
	refreshToken,
	userId,
}: {
	refreshToken: string;
	userId: string;
}): Promise<string | null> {
	const githubApp = getGitHubAppAuthConfig();
	let payload: GitHubTokenResponse;
	try {
		payload = await requestGitHubAppUserToken({
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
		await saveGitHubAppUserToken({ userId, payload });
	} catch (error) {
		// The refreshed access token is valid for this request even if D1 would
		// not take it. The rotated refresh token is lost, so the next expiry will
		// ask the user to re-authorize; that beats failing the page now.
		console.error(
			"[github-auth] failed to store refreshed app user token",
			userId,
			describeError(error),
		);
	}

	debug("github-auth", "app user token refreshed", { userId });
	return payload.access_token ?? null;
}

async function saveGitHubAppUserToken({
	payload,
	userId,
}: {
	payload: GitHubTokenResponse;
	userId: string;
}) {
	if (!payload.access_token) {
		throw new Error("GitHub App user token response did not include a token.");
	}

	const db = getDb();
	const now = new Date();
	const existingAccount = await getGitHubAppUserAccountByUserId(userId);
	const oauthAccount = await getGitHubOAuthAccountByUserId(userId);
	const values = {
		accountId: oauthAccount?.accountId ?? userId,
		providerId: GITHUB_APP_USER_PROVIDER_ID,
		userId,
		accessToken: payload.access_token,
		refreshToken: payload.refresh_token ?? null,
		accessTokenExpiresAt: getTokenExpiresAt(payload.expires_in),
		refreshTokenExpiresAt: getTokenExpiresAt(payload.refresh_token_expires_in),
		scope: payload.scope ?? null,
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
	const githubAccount = await getGitHubAppUserAccountByUserId(userId);
	if (!githubAccount?.accessToken) {
		debug("github-auth", "no app user account", { userId });
		return null;
	}

	if (isUsableAccessTokenExpiresAt(githubAccount.accessTokenExpiresAt)) {
		debug("github-auth", "app user token is fresh", { userId });
		return githubAccount.accessToken;
	}

	if (
		!githubAccount.refreshToken ||
		!isUsableAccessTokenExpiresAt(githubAccount.refreshTokenExpiresAt)
	) {
		debug("github-auth", "app user token expired, refresh unavailable", {
			userId,
			hasRefreshToken: Boolean(githubAccount.refreshToken),
			refreshTokenExpiresAt:
				githubAccount.refreshTokenExpiresAt?.toISOString() ?? null,
		});
		return null;
	}

	debug("github-auth", "app user token expired, refreshing", { userId });
	return refreshGitHubAppUserToken({
		refreshToken: githubAccount.refreshToken,
		userId,
	});
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

/**
 * Verifies GitHub's `X-Hub-Signature-256` header. The comparison is done by
 * `crypto.subtle.verify`, which is constant-time; malformed signatures
 * (missing prefix, wrong length, non-hex) are rejected before any HMAC work.
 */
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

	return crypto.subtle.verify(
		"HMAC",
		key,
		expectedSignature,
		new TextEncoder().encode(body),
	);
}
