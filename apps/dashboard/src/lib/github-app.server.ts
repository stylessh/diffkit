import "@tanstack/react-start/server-only";
import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { account } from "../db/schema";
import { normalizeGitHubAppPrivateKey } from "./github-private-key";
import { GITHUB_REQUEST_TIMEOUT_MS } from "./github-request-policy";

type WorkerEnvRecord = typeof env & Record<string, string | undefined>;

export const GITHUB_OAUTH_PROVIDER_ID = "github";
export const GITHUB_APP_USER_PROVIDER_ID = "github-app";

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

export async function getGitHubOAuthAccountByUserId(userId: string) {
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
	const response = await fetch("https://github.com/login/oauth/access_token", {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/x-www-form-urlencoded",
		},
		signal: AbortSignal.timeout(GITHUB_REQUEST_TIMEOUT_MS),
		body: new URLSearchParams(params),
	});
	const payload = (await response.json()) as GitHubTokenResponse;

	if (!response.ok || !payload.access_token) {
		const message =
			payload.error_description ?? payload.error ?? response.statusText;
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

async function refreshGitHubAppUserToken({
	refreshToken,
	userId,
}: {
	refreshToken: string;
	userId: string;
}) {
	const githubApp = getGitHubAppAuthConfig();
	const payload = await requestGitHubAppUserToken({
		client_id: githubApp.clientId,
		client_secret: githubApp.clientSecret,
		grant_type: "refresh_token",
		refresh_token: refreshToken,
	});

	await saveGitHubAppUserToken({
		userId,
		payload,
	});

	return payload.access_token;
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
		return null;
	}

	if (isUsableAccessTokenExpiresAt(githubAccount.accessTokenExpiresAt)) {
		return githubAccount.accessToken;
	}

	if (
		!githubAccount.refreshToken ||
		!isUsableAccessTokenExpiresAt(githubAccount.refreshTokenExpiresAt)
	) {
		return null;
	}

	return refreshGitHubAppUserToken({
		refreshToken: githubAccount.refreshToken,
		userId,
	});
}

function fromHex(hex: string) {
	if (hex.length % 2 !== 0) {
		return null;
	}

	const bytes = new Uint8Array(hex.length / 2);
	for (let index = 0; index < hex.length; index += 2) {
		const byte = Number.parseInt(hex.slice(index, index + 2), 16);
		if (!Number.isFinite(byte)) {
			return null;
		}

		bytes[index / 2] = byte;
	}

	return bytes;
}

function secureCompare(left: Uint8Array, right: Uint8Array) {
	if (left.length !== right.length) {
		return false;
	}

	let mismatch = 0;
	for (let index = 0; index < left.length; index += 1) {
		mismatch |= left[index] ^ right[index];
	}

	return mismatch === 0;
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
		["sign"],
	);
	const actualSignature = new Uint8Array(
		await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)),
	);

	return secureCompare(actualSignature, expectedSignature);
}
