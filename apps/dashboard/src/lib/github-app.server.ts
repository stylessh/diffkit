import "@tanstack/react-start/server-only";
import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { account } from "../db/schema";

type WorkerEnvRecord = typeof env & Record<string, string | undefined>;

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

export function getGitHubAppSlug(): string | null {
	return pickFirstNonEmpty(getWorkerEnv().GITHUB_APP_SLUG) ?? null;
}

export function getGitHubWebhookSecret() {
	return pickFirstNonEmpty(getWorkerEnv().GITHUB_WEBHOOK_SECRET) ?? null;
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

	return githubAccount.accessToken;
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
