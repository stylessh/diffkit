import "@tanstack/react-start/server-only";
import { App, Octokit, type Octokit as OctokitType } from "octokit";
import {
	getGitHubAccessTokenByUserId,
	getGitHubAppId,
	getGitHubAppPrivateKey,
} from "./github-app.server";
import { configureGitHubRequestPolicies } from "./github-request-policy";

const GITHUB_CLIENT_USER_AGENT = "diffkit-dashboard";
const GITHUB_INSTALLATION_TOKEN_CACHE_VERSION = "v1";
const GITHUB_INSTALLATION_TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
const GITHUB_INSTALLATION_TOKEN_MIN_KV_TTL_SECONDS = 60;

type GitHubInstallationTokenCacheEntry = {
	installationId: number;
	token: string;
	expiresAt: string;
	permissions?: Record<string, string>;
	repositoryIds?: number[];
	repositorySelection?: string;
	cachedAt: number;
};

type GitHubInstallationAuthResult = {
	token?: string;
	expiresAt?: string;
	permissions?: Record<string, string>;
	repositoryIds?: number[];
	repositorySelection?: string;
};

type GitHubInstallationTokenCacheStore = {
	get(storageKey: string): Promise<unknown | null>;
	put(
		storageKey: string,
		entry: GitHubInstallationTokenCacheEntry,
		expirationTtlSeconds: number,
	): Promise<void>;
	delete(storageKey: string): Promise<void>;
};

const githubInstallationTokenMemoryCache = new Map<
	number,
	GitHubInstallationTokenCacheEntry
>();
const githubInstallationTokenInflight = new Map<
	number,
	Promise<GitHubInstallationTokenCacheEntry>
>();
const githubInstallationTokenInvalidationVersions = new Map<number, number>();

export async function getGitHubClient(userId: string): Promise<OctokitType> {
	const octokit = new Octokit({
		auth: await getGitHubAccessTokenByUserId(userId),
		userAgent: GITHUB_CLIENT_USER_AGENT,
		retry: { enabled: false },
		throttle: { enabled: false },
	});

	configureGitHubRequestPolicies(octokit, {
		tokenLabel: `oauth:user:${userId}`,
	});

	return octokit;
}

export async function getGitHubInstallationClient(
	installationId: number,
): Promise<OctokitType> {
	const tokenEntry = await getCachedGitHubInstallationToken(installationId);
	const octokit = new Octokit({
		auth: tokenEntry.token,
		userAgent: GITHUB_CLIENT_USER_AGENT,
		retry: { enabled: false },
		throttle: { enabled: false },
	});

	configureGitHubRequestPolicies(octokit, {
		tokenLabel: `installation:${installationId}`,
	});

	return octokit;
}

export async function invalidateGitHubInstallationToken(
	installationId: number,
) {
	githubInstallationTokenMemoryCache.delete(installationId);
	githubInstallationTokenInflight.delete(installationId);
	githubInstallationTokenInvalidationVersions.set(
		installationId,
		getGitHubInstallationTokenInvalidationVersion(installationId) + 1,
	);

	try {
		const store = await getGitHubInstallationTokenCacheStore();
		await store?.delete(getGitHubInstallationTokenStorageKey(installationId));
	} catch {
		// Best effort: webhook processing should not fail if KV is unavailable.
	}
}

async function getCachedGitHubInstallationToken(
	installationId: number,
): Promise<GitHubInstallationTokenCacheEntry> {
	const cachedEntry = githubInstallationTokenMemoryCache.get(installationId);
	if (cachedEntry && isFreshGitHubInstallationToken(cachedEntry)) {
		return cachedEntry;
	}
	if (cachedEntry) {
		githubInstallationTokenMemoryCache.delete(installationId);
	}

	const inflightEntry = githubInstallationTokenInflight.get(installationId);
	if (inflightEntry) {
		return inflightEntry;
	}

	const invalidationVersion =
		getGitHubInstallationTokenInvalidationVersion(installationId);
	const tokenPromise = loadGitHubInstallationToken(
		installationId,
		invalidationVersion,
	);
	githubInstallationTokenInflight.set(installationId, tokenPromise);

	try {
		return await tokenPromise;
	} finally {
		if (githubInstallationTokenInflight.get(installationId) === tokenPromise) {
			githubInstallationTokenInflight.delete(installationId);
		}
	}
}

async function loadGitHubInstallationToken(
	installationId: number,
	invalidationVersion: number,
) {
	const storageKey = getGitHubInstallationTokenStorageKey(installationId);
	const storedEntry = await readGitHubInstallationTokenFromStore(storageKey);
	if (
		isGitHubInstallationTokenCacheEntry(storedEntry, installationId) &&
		isFreshGitHubInstallationToken(storedEntry)
	) {
		cacheGitHubInstallationTokenInMemory(
			storedEntry,
			installationId,
			invalidationVersion,
		);
		return storedEntry;
	}

	const tokenEntry = await mintGitHubInstallationToken(installationId);
	cacheGitHubInstallationTokenInMemory(
		tokenEntry,
		installationId,
		invalidationVersion,
	);
	await writeGitHubInstallationTokenToStore(
		storageKey,
		tokenEntry,
		installationId,
		invalidationVersion,
	);
	return tokenEntry;
}

async function mintGitHubInstallationToken(
	installationId: number,
): Promise<GitHubInstallationTokenCacheEntry> {
	const appId = getGitHubAppId();
	const privateKey = getGitHubAppPrivateKey();
	if (!appId || !privateKey) {
		throw new Error(
			"Missing GitHub App installation credentials. Set GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY.",
		);
	}

	const AppOctokit = Octokit.defaults({
		retry: { enabled: false },
		throttle: { enabled: false },
	});

	const app = new App({
		appId,
		privateKey,
		Octokit: AppOctokit,
	});

	configureGitHubRequestPolicies(app.octokit, {
		tokenLabel: `app-auth:installation:${installationId}`,
	});

	const auth = (await app.octokit.auth({
		type: "installation",
		installationId,
	})) as GitHubInstallationAuthResult;

	if (!auth.token || !auth.expiresAt) {
		throw new Error(
			`GitHub App did not return an installation token for installation ${installationId}.`,
		);
	}

	return {
		installationId,
		token: auth.token,
		expiresAt: auth.expiresAt,
		permissions: auth.permissions,
		repositoryIds: auth.repositoryIds,
		repositorySelection: auth.repositorySelection,
		cachedAt: Date.now(),
	};
}

function isFreshGitHubInstallationToken(
	entry: GitHubInstallationTokenCacheEntry,
) {
	const expiresAtMs = Date.parse(entry.expiresAt);
	return (
		Number.isFinite(expiresAtMs) &&
		expiresAtMs - Date.now() > GITHUB_INSTALLATION_TOKEN_REFRESH_BUFFER_MS
	);
}

function isGitHubInstallationTokenCacheEntry(
	value: unknown,
	installationId: number,
): value is GitHubInstallationTokenCacheEntry {
	return (
		isRecord(value) &&
		value.installationId === installationId &&
		typeof value.token === "string" &&
		typeof value.expiresAt === "string" &&
		typeof value.cachedAt === "number"
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object";
}

function getGitHubInstallationTokenStorageTtlSeconds(
	entry: GitHubInstallationTokenCacheEntry,
) {
	const expiresAtMs = Date.parse(entry.expiresAt);
	if (!Number.isFinite(expiresAtMs)) {
		return 0;
	}

	return Math.floor(
		(expiresAtMs - Date.now() - GITHUB_INSTALLATION_TOKEN_REFRESH_BUFFER_MS) /
			1000,
	);
}

function getGitHubInstallationTokenStorageKey(installationId: number) {
	return `github-installation-token:${GITHUB_INSTALLATION_TOKEN_CACHE_VERSION}:${installationId}`;
}

function getGitHubInstallationTokenInvalidationVersion(installationId: number) {
	return githubInstallationTokenInvalidationVersions.get(installationId) ?? 0;
}

function cacheGitHubInstallationTokenInMemory(
	entry: GitHubInstallationTokenCacheEntry,
	installationId: number,
	invalidationVersion: number,
) {
	if (
		getGitHubInstallationTokenInvalidationVersion(installationId) !==
		invalidationVersion
	) {
		return;
	}

	githubInstallationTokenMemoryCache.set(installationId, entry);
}

async function readGitHubInstallationTokenFromStore(storageKey: string) {
	try {
		const store = await getGitHubInstallationTokenCacheStore();
		return (await store?.get(storageKey)) ?? null;
	} catch {
		return null;
	}
}

async function writeGitHubInstallationTokenToStore(
	storageKey: string,
	entry: GitHubInstallationTokenCacheEntry,
	installationId: number,
	invalidationVersion: number,
) {
	if (
		getGitHubInstallationTokenInvalidationVersion(installationId) !==
		invalidationVersion
	) {
		return;
	}

	const ttlSeconds = getGitHubInstallationTokenStorageTtlSeconds(entry);
	if (ttlSeconds < GITHUB_INSTALLATION_TOKEN_MIN_KV_TTL_SECONDS) {
		return;
	}

	try {
		const store = await getGitHubInstallationTokenCacheStore();
		await store?.put(storageKey, entry, ttlSeconds);
	} catch {
		// Best effort: the in-memory cache still dedupes within this worker.
	}
}

async function getGitHubInstallationTokenCacheStore(): Promise<GitHubInstallationTokenCacheStore | null> {
	try {
		const { env } = await import("cloudflare:workers");
		const workerEnv = env as {
			GITHUB_CACHE_KV?: KVNamespace;
		};
		const kv = workerEnv.GITHUB_CACHE_KV;

		if (!kv) {
			return null;
		}

		return {
			async get(storageKey) {
				const entry = await kv.get<GitHubInstallationTokenCacheEntry>(
					storageKey,
					{
						type: "json",
					},
				);
				return entry ?? null;
			},
			async put(storageKey, entry, expirationTtlSeconds) {
				await kv.put(storageKey, JSON.stringify(entry), {
					expirationTtl: expirationTtlSeconds,
				});
			},
			async delete(storageKey) {
				await kv.delete(storageKey);
			},
		};
	} catch {
		return null;
	}
}
