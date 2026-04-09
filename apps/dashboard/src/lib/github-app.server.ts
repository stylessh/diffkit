import "@tanstack/react-start/server-only";
import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { account } from "../db/schema";

const GITHUB_TOKEN_REFRESH_BUFFER_MS = 60_000;
const GITHUB_ACCESS_TOKEN_ENDPOINT =
	"https://github.com/login/oauth/access_token";
const githubTokenRefreshes = new Map<string, Promise<string>>();

type WorkerEnvRecord = typeof env & Record<string, string | undefined>;
type GitHubAccountRecord = typeof account.$inferSelect;

type GitHubTokenRefreshSuccess = {
	access_token: string;
	expires_in?: number;
	refresh_token?: string;
	refresh_token_expires_in?: number;
	scope?: string;
};

type GitHubTokenRefreshFailure = {
	error: string;
	error_description?: string;
};

function getWorkerEnv() {
	return env as WorkerEnvRecord;
}

function pickFirstNonEmpty(...values: Array<string | null | undefined>) {
	return values.find((value) => typeof value === "string" && value.length > 0);
}

function toFutureDate(seconds?: number) {
	if (
		typeof seconds !== "number" ||
		!Number.isFinite(seconds) ||
		seconds <= 0
	) {
		return null;
	}

	return new Date(Date.now() + seconds * 1_000);
}

function needsGitHubAccessTokenRefresh(githubAccount: GitHubAccountRecord) {
	if (!githubAccount.accessTokenExpiresAt) {
		return false;
	}

	return (
		githubAccount.accessTokenExpiresAt.getTime() <=
		Date.now() + GITHUB_TOKEN_REFRESH_BUFFER_MS
	);
}

export function getGitHubAppAuthConfig() {
	const workerEnv = getWorkerEnv();
	const clientId = pickFirstNonEmpty(
		workerEnv.GITHUB_APP_CLIENT_ID,
		workerEnv.GITHUB_CLIENT_ID,
	);
	const clientSecret = pickFirstNonEmpty(
		workerEnv.GITHUB_APP_CLIENT_SECRET,
		workerEnv.GITHUB_CLIENT_SECRET,
	);

	if (!clientId || !clientSecret) {
		throw new Error(
			"Missing GitHub app credentials. Set GITHUB_APP_CLIENT_ID and GITHUB_APP_CLIENT_SECRET.",
		);
	}

	return {
		clientId,
		clientSecret,
	};
}

export function getGitHubWebhookSecret() {
	return pickFirstNonEmpty(getWorkerEnv().GITHUB_WEBHOOK_SECRET) ?? null;
}

async function refreshGitHubAccessToken(githubAccount: GitHubAccountRecord) {
	const { clientId, clientSecret } = getGitHubAppAuthConfig();

	if (!githubAccount.refreshToken) {
		throw new Error(
			"GitHub access token expired and no refresh token is available.",
		);
	}

	const body = new URLSearchParams({
		client_id: clientId,
		client_secret: clientSecret,
		grant_type: "refresh_token",
		refresh_token: githubAccount.refreshToken,
	});

	const response = await fetch(GITHUB_ACCESS_TOKEN_ENDPOINT, {
		method: "POST",
		headers: {
			accept: "application/json",
			"content-type": "application/x-www-form-urlencoded",
		},
		body: body.toString(),
	});

	const payload = (await response.json()) as
		| GitHubTokenRefreshSuccess
		| GitHubTokenRefreshFailure;

	if (!response.ok || "error" in payload || !payload.access_token) {
		throw new Error(
			"error" in payload
				? `GitHub token refresh failed: ${payload.error}`
				: "GitHub token refresh failed.",
		);
	}

	const db = getDb();
	await db
		.update(account)
		.set({
			accessToken: payload.access_token,
			refreshToken: payload.refresh_token ?? githubAccount.refreshToken,
			accessTokenExpiresAt:
				toFutureDate(payload.expires_in) ?? githubAccount.accessTokenExpiresAt,
			refreshTokenExpiresAt:
				toFutureDate(payload.refresh_token_expires_in) ??
				githubAccount.refreshTokenExpiresAt,
			scope: payload.scope ?? githubAccount.scope,
			updatedAt: new Date(),
		})
		.where(eq(account.id, githubAccount.id));

	return payload.access_token;
}

export async function getGitHubAccessTokenByUserId(userId: string) {
	const db = getDb();
	const githubAccount = await db
		.select()
		.from(account)
		.where(and(eq(account.userId, userId), eq(account.providerId, "github")))
		.get();

	if (!githubAccount?.accessToken) {
		throw new Error("No GitHub account linked");
	}

	if (!needsGitHubAccessTokenRefresh(githubAccount)) {
		return githubAccount.accessToken;
	}

	const existingRefresh = githubTokenRefreshes.get(githubAccount.id);
	if (existingRefresh) {
		return existingRefresh;
	}

	const refreshTask = refreshGitHubAccessToken(githubAccount).finally(() => {
		githubTokenRefreshes.delete(githubAccount.id);
	});

	githubTokenRefreshes.set(githubAccount.id, refreshTask);

	return refreshTask;
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
