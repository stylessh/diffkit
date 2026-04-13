export type GitHubConditionalHeaders = {
	etag?: string | null;
	lastModified?: string | null;
};

export type GitHubResponseMetadata = {
	etag: string | null;
	lastModified: string | null;
	rateLimitRemaining: number | null;
	rateLimitReset: number | null;
	statusCode: number;
};

export type GitHubCacheStoreEntry = {
	cacheKey: string;
	userId: string;
	resource: string;
	paramsJson: string;
	etag: string | null;
	lastModified: string | null;
	payloadJson: string;
	fetchedAt: number;
	freshUntil: number;
	rateLimitRemaining: number | null;
	rateLimitReset: number | null;
	statusCode: number;
};

export type GitHubCacheStore = {
	get(cacheKey: string): Promise<GitHubCacheStoreEntry | null>;
	upsert(entry: GitHubCacheStoreEntry): Promise<void>;
	delete(cacheKey: string): Promise<void>;
};

export type GitHubPayloadCacheStore = {
	get(storageKey: string): Promise<GitHubCacheStoreEntry | null>;
	put(
		storageKey: string,
		entry: GitHubCacheStoreEntry,
		expirationTtlSeconds: number,
	): Promise<void>;
};

export type GitHubFetchResult<TData> =
	| {
			kind: "not-modified";
			metadata: GitHubResponseMetadata;
	  }
	| {
			kind: "success";
			data: TData;
			metadata: GitHubResponseMetadata;
	  };

type GetOrRevalidateGitHubResourceOptions<TData> = {
	userId: string;
	resource: string;
	params?: unknown;
	freshForMs: number;
	signalKeys?: string[];
	namespaceKeys?: string[];
	cacheMode?: "legacy" | "split";
	payloadRetentionSeconds?: number;
	fetcher: (
		conditionals: GitHubConditionalHeaders,
	) => Promise<GitHubFetchResult<TData>>;
	store?: GitHubCacheStore;
	payloadStore?: GitHubPayloadCacheStore | null;
	inFlightCache?: Map<string, Promise<unknown>>;
	getLatestSignalUpdatedAt?: (signalKeys: string[]) => Promise<number | null>;
	getNamespaceVersions?: (
		namespaceKeys: string[],
	) => Promise<Record<string, number>>;
	merge?: (existing: TData, fresh: TData) => TData;
	now?: () => number;
};

const DEFAULT_GITHUB_PAYLOAD_RETENTION_SECONDS = 7 * 24 * 60 * 60;
const GITHUB_RATE_LIMIT_LOW_REMAINING = 100;
const GITHUB_RATE_LIMIT_CRITICAL_REMAINING = 25;
const GITHUB_RATE_LIMIT_LOW_FRESH_FLOOR_MS = 2 * 60 * 1000;
const GITHUB_RATE_LIMIT_CRITICAL_FRESH_FLOOR_MS = 5 * 60 * 1000;
const GITHUB_RATE_LIMIT_RESET_BUFFER_MS = 5 * 1000;
const GITHUB_STALE_IF_RATE_LIMITED_FALLBACK_MS = 60 * 1000;

const requestScopedInFlightGitHubCacheReads = new WeakMap<
	Request,
	Map<string, Promise<unknown>>
>();

async function getRequestScopedInFlightCache() {
	try {
		const { getRequest } = await import("@tanstack/react-start/server");
		const request = getRequest();
		let inFlightCache = requestScopedInFlightGitHubCacheReads.get(request);

		if (!inFlightCache) {
			inFlightCache = new Map<string, Promise<unknown>>();
			requestScopedInFlightGitHubCacheReads.set(request, inFlightCache);
		}

		return inFlightCache;
	} catch {
		return null;
	}
}

function parseNullableInt(value: string | null | undefined) {
	if (!value) {
		return null;
	}

	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) ? parsed : null;
}

function normalizeJsonValue(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map((item) => normalizeJsonValue(item));
	}

	if (value instanceof Date) {
		return value.toISOString();
	}

	if (typeof value === "bigint") {
		return value.toString();
	}

	if (value && typeof value === "object") {
		return Object.keys(value as Record<string, unknown>)
			.sort()
			.reduce<Record<string, unknown>>((accumulator, key) => {
				const normalized = normalizeJsonValue(
					(value as Record<string, unknown>)[key],
				);
				if (typeof normalized !== "undefined") {
					accumulator[key] = normalized;
				}
				return accumulator;
			}, {});
	}

	return value;
}

function stableSerialize(value: unknown) {
	return JSON.stringify(normalizeJsonValue(value ?? null));
}

function buildGitHubCacheKey({
	userId,
	resource,
	paramsJson,
}: {
	userId: string;
	resource: string;
	paramsJson: string;
}) {
	return `${userId}::${resource}::${paramsJson}`;
}

function parseCachedPayload<TData>(payloadJson: string) {
	return JSON.parse(payloadJson) as TData;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object";
}

function getRateLimitResetMs(rateLimitReset: number | null | undefined) {
	if (typeof rateLimitReset !== "number" || !Number.isFinite(rateLimitReset)) {
		return null;
	}

	return rateLimitReset * 1_000;
}

function getAdaptiveFreshForMs(
	currentTime: number,
	baseFreshForMs: number,
	metadata: Pick<
		GitHubResponseMetadata,
		"rateLimitRemaining" | "rateLimitReset"
	>,
) {
	if (
		typeof metadata.rateLimitRemaining !== "number" ||
		!Number.isFinite(metadata.rateLimitRemaining)
	) {
		return baseFreshForMs;
	}

	if (metadata.rateLimitRemaining <= GITHUB_RATE_LIMIT_CRITICAL_REMAINING) {
		const untilReset = getRateLimitResetMs(metadata.rateLimitReset);
		const resetExtendedFreshForMs =
			typeof untilReset === "number"
				? Math.max(
						untilReset - currentTime + GITHUB_RATE_LIMIT_RESET_BUFFER_MS,
						0,
					)
				: 0;

		return Math.max(
			baseFreshForMs,
			GITHUB_RATE_LIMIT_CRITICAL_FRESH_FLOOR_MS,
			resetExtendedFreshForMs,
		);
	}

	if (metadata.rateLimitRemaining <= GITHUB_RATE_LIMIT_LOW_REMAINING) {
		return Math.max(baseFreshForMs, GITHUB_RATE_LIMIT_LOW_FRESH_FLOOR_MS);
	}

	return baseFreshForMs;
}

function getErrorStatusCode(error: unknown) {
	if (!isRecord(error)) {
		return null;
	}

	return typeof error.status === "number" ? error.status : null;
}

function getErrorResponseHeaders(error: unknown) {
	if (!isRecord(error) || !isRecord(error.response)) {
		return null;
	}

	return error.response.headers as Record<string, unknown> | null;
}

function normalizeUnknownHeaders(
	headers: Record<string, unknown> | null | undefined,
) {
	if (!headers) {
		return {};
	}

	return Object.entries(headers).reduce<Record<string, string | null>>(
		(accumulator, [key, value]) => {
			accumulator[key.toLowerCase()] =
				typeof value === "string"
					? value
					: value == null
						? null
						: String(value);
			return accumulator;
		},
		{},
	);
}

function isGitHubRateLimitError(error: unknown) {
	const statusCode = getErrorStatusCode(error);
	if (statusCode !== 403 && statusCode !== 429) {
		return false;
	}

	const headers = normalizeUnknownHeaders(getErrorResponseHeaders(error));
	const retryAfter = headers["retry-after"];
	const remaining = parseNullableInt(headers["x-ratelimit-remaining"]);

	return retryAfter !== null || remaining === 0 || statusCode === 429;
}

/** 30 s — short so the data refreshes once the user configures access. */
const GITHUB_STALE_IF_FORBIDDEN_MS = 30_000;

function isGitHubForbiddenError(error: unknown) {
	const msg = error instanceof Error ? error.message : String(error ?? "");
	return (
		msg.includes("OAuth App access restrictions") ||
		msg.includes("FORBIDDEN") ||
		msg.includes("Resource not accessible by integration")
	);
}

function getRateLimitedStaleFreshUntil(currentTime: number, error: unknown) {
	const headers = normalizeUnknownHeaders(getErrorResponseHeaders(error));
	const retryAfterSeconds = parseNullableInt(headers["retry-after"]);
	if (typeof retryAfterSeconds === "number" && retryAfterSeconds > 0) {
		return (
			currentTime +
			retryAfterSeconds * 1_000 +
			GITHUB_RATE_LIMIT_RESET_BUFFER_MS
		);
	}

	const resetAtMs = getRateLimitResetMs(
		parseNullableInt(headers["x-ratelimit-reset"]),
	);
	if (typeof resetAtMs === "number") {
		return Math.max(
			currentTime + GITHUB_STALE_IF_RATE_LIMITED_FALLBACK_MS,
			resetAtMs + GITHUB_RATE_LIMIT_RESET_BUFFER_MS,
		);
	}

	return currentTime + GITHUB_STALE_IF_RATE_LIMITED_FALLBACK_MS;
}

async function hashText(value: string) {
	const encoded = new TextEncoder().encode(value);
	const digest = await crypto.subtle.digest("SHA-256", encoded);

	return Array.from(new Uint8Array(digest), (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");
}

async function buildGitHubPayloadStorageKey({
	userId,
	resource,
	paramsJson,
	namespaceKeys,
	namespaceVersions,
}: {
	userId: string;
	resource: string;
	paramsJson: string;
	namespaceKeys: string[];
	namespaceVersions: Record<string, number>;
}) {
	const paramsHash = (await hashText(paramsJson)).slice(0, 16);
	const namespaceVersionHash =
		namespaceKeys.length === 0
			? "static"
			: (
					await hashText(
						stableSerialize(
							namespaceKeys.map((namespaceKey) => [
								namespaceKey,
								namespaceVersions[namespaceKey] ?? 0,
							]),
						),
					)
				).slice(0, 16);

	return `gh:${userId}:${resource}:${paramsHash}:v${namespaceVersionHash}`;
}

async function getGitHubCacheStore(): Promise<GitHubCacheStore> {
	const [{ eq }, { getDb }, { githubResponseCache }] = await Promise.all([
		import("drizzle-orm"),
		import("../db"),
		import("../db/schema"),
	]);
	const db = getDb();

	return {
		async get(cacheKey) {
			const entry = await db
				.select()
				.from(githubResponseCache)
				.where(eq(githubResponseCache.cacheKey, cacheKey))
				.get();

			return entry ?? null;
		},
		async upsert(entry) {
			await db
				.insert(githubResponseCache)
				.values(entry)
				.onConflictDoUpdate({
					target: githubResponseCache.cacheKey,
					set: {
						userId: entry.userId,
						resource: entry.resource,
						paramsJson: entry.paramsJson,
						etag: entry.etag,
						lastModified: entry.lastModified,
						payloadJson: entry.payloadJson,
						fetchedAt: entry.fetchedAt,
						freshUntil: entry.freshUntil,
						rateLimitRemaining: entry.rateLimitRemaining,
						rateLimitReset: entry.rateLimitReset,
						statusCode: entry.statusCode,
					},
				});
		},
		async delete(cacheKey) {
			await db
				.delete(githubResponseCache)
				.where(eq(githubResponseCache.cacheKey, cacheKey));
		},
	};
}

async function getGitHubPayloadCacheStore(): Promise<GitHubPayloadCacheStore | null> {
	try {
		const { env } = await import("cloudflare:workers");
		const workerEnv = env as typeof env & {
			GITHUB_CACHE_KV?: KVNamespace;
		};
		const kv = workerEnv.GITHUB_CACHE_KV;

		if (!kv) {
			return null;
		}

		return {
			async get(storageKey) {
				const entry = await kv.get<GitHubCacheStoreEntry>(storageKey, {
					type: "json",
				});
				return entry ?? null;
			},
			async put(storageKey, entry, expirationTtlSeconds) {
				await kv.put(storageKey, JSON.stringify(entry), {
					expirationTtl: expirationTtlSeconds,
				});
			},
		};
	} catch {
		return null;
	}
}

async function getLatestGitHubRevalidationSignalUpdatedAt(
	signalKeys: string[],
) {
	if (signalKeys.length === 0) {
		return null;
	}

	const [{ inArray }, { getDb }, { githubRevalidationSignal }] =
		await Promise.all([
			import("drizzle-orm"),
			import("../db"),
			import("../db/schema"),
		]);
	const db = getDb();
	const signals = await db
		.select({
			updatedAt: githubRevalidationSignal.updatedAt,
		})
		.from(githubRevalidationSignal)
		.where(inArray(githubRevalidationSignal.signalKey, signalKeys));

	if (signals.length === 0) {
		return null;
	}

	return Math.max(...signals.map((signal) => signal.updatedAt));
}

export async function getGitHubCacheNamespaceVersions(namespaceKeys: string[]) {
	if (namespaceKeys.length === 0) {
		return {};
	}

	const uniqueNamespaceKeys = Array.from(new Set(namespaceKeys));
	const [{ inArray }, { getDb }, { githubCacheNamespace }] = await Promise.all([
		import("drizzle-orm"),
		import("../db"),
		import("../db/schema"),
	]);
	const db = getDb();
	const rows = await db
		.select({
			namespaceKey: githubCacheNamespace.namespaceKey,
			version: githubCacheNamespace.version,
		})
		.from(githubCacheNamespace)
		.where(inArray(githubCacheNamespace.namespaceKey, uniqueNamespaceKeys));

	return uniqueNamespaceKeys.reduce<Record<string, number>>(
		(accumulator, namespaceKey) => {
			accumulator[namespaceKey] =
				rows.find((row) => row.namespaceKey === namespaceKey)?.version ?? 0;
			return accumulator;
		},
		{},
	);
}

export async function bumpGitHubCacheNamespaces(
	namespaceKeys: string[],
	at = Date.now(),
) {
	if (namespaceKeys.length === 0) {
		return 0;
	}

	const uniqueNamespaceKeys = Array.from(new Set(namespaceKeys));
	const [{ sql }, { getDb }, { githubCacheNamespace }] = await Promise.all([
		import("drizzle-orm"),
		import("../db"),
		import("../db/schema"),
	]);
	const db = getDb();

	await db
		.insert(githubCacheNamespace)
		.values(
			uniqueNamespaceKeys.map((namespaceKey) => ({
				namespaceKey,
				version: 1,
				updatedAt: at,
			})),
		)
		.onConflictDoUpdate({
			target: githubCacheNamespace.namespaceKey,
			set: {
				version: sql`${githubCacheNamespace.version} + 1`,
				updatedAt: at,
			},
		});

	return uniqueNamespaceKeys.length;
}

export async function markGitHubRevalidationSignals(
	signalKeys: string[],
	at = Date.now(),
) {
	if (signalKeys.length === 0) {
		return 0;
	}

	const uniqueSignalKeys = Array.from(new Set(signalKeys));
	const [{ getDb }, { githubRevalidationSignal }] = await Promise.all([
		import("../db"),
		import("../db/schema"),
	]);
	const db = getDb();

	await db
		.insert(githubRevalidationSignal)
		.values(
			uniqueSignalKeys.map((signalKey) => ({
				signalKey,
				updatedAt: at,
			})),
		)
		.onConflictDoUpdate({
			target: githubRevalidationSignal.signalKey,
			set: {
				updatedAt: at,
			},
		});

	await bumpGitHubCacheNamespaces(uniqueSignalKeys, at);

	return uniqueSignalKeys.length;
}

export async function getGitHubRevalidationSignals(signalKeys: string[]) {
	if (signalKeys.length === 0) {
		return [];
	}

	const uniqueSignalKeys = Array.from(new Set(signalKeys));
	const [{ inArray }, { getDb }, { githubRevalidationSignal }] =
		await Promise.all([
			import("drizzle-orm"),
			import("../db"),
			import("../db/schema"),
		]);
	const db = getDb();

	return db
		.select({
			signalKey: githubRevalidationSignal.signalKey,
			updatedAt: githubRevalidationSignal.updatedAt,
		})
		.from(githubRevalidationSignal)
		.where(inArray(githubRevalidationSignal.signalKey, uniqueSignalKeys));
}

export async function bustGitHubCache(
	userId: string,
	resource: string,
	params?: unknown,
): Promise<void> {
	const store = await getGitHubCacheStore();
	const paramsJson = stableSerialize(params);
	const cacheKey = buildGitHubCacheKey({ userId, resource, paramsJson });
	await store.delete(cacheKey);
}

export function createGitHubResponseMetadata(
	statusCode: number,
	headers: Record<string, string | null | undefined>,
): GitHubResponseMetadata {
	return {
		etag: headers.etag ?? null,
		lastModified: headers["last-modified"] ?? null,
		rateLimitRemaining: parseNullableInt(headers["x-ratelimit-remaining"]),
		rateLimitReset: parseNullableInt(headers["x-ratelimit-reset"]),
		statusCode,
	};
}

async function persistGitHubCacheEntry({
	entry,
	legacyStore,
	payloadStore,
	payloadStorageKey,
	payloadRetentionSeconds,
}: {
	entry: GitHubCacheStoreEntry;
	legacyStore: GitHubCacheStore;
	payloadStore: GitHubPayloadCacheStore | null;
	payloadStorageKey: string | null;
	payloadRetentionSeconds: number;
}) {
	const writes: Array<Promise<unknown>> = [legacyStore.upsert(entry)];

	if (payloadStore && payloadStorageKey) {
		writes.push(
			payloadStore.put(payloadStorageKey, entry, payloadRetentionSeconds),
		);
	}

	await Promise.all(writes);
}

export async function getOrRevalidateGitHubResource<TData>({
	userId,
	resource,
	params,
	freshForMs,
	signalKeys = [],
	namespaceKeys = [],
	cacheMode = "legacy",
	payloadRetentionSeconds = DEFAULT_GITHUB_PAYLOAD_RETENTION_SECONDS,
	fetcher,
	merge,
	now = Date.now,
	store,
	payloadStore,
	inFlightCache,
	getLatestSignalUpdatedAt = getLatestGitHubRevalidationSignalUpdatedAt,
	getNamespaceVersions = getGitHubCacheNamespaceVersions,
}: GetOrRevalidateGitHubResourceOptions<TData>): Promise<TData> {
	let resolvedStore = store ?? null;
	const resolvedPayloadStore =
		typeof payloadStore !== "undefined"
			? payloadStore
			: cacheMode === "split"
				? await getGitHubPayloadCacheStore()
				: null;
	const paramsJson = stableSerialize(params);
	const cacheKey = buildGitHubCacheKey({ userId, resource, paramsJson });
	const resolvedInFlightCache =
		inFlightCache ?? (await getRequestScopedInFlightCache());

	const existingInFlight = resolvedInFlightCache?.get(cacheKey);
	if (existingInFlight) {
		return existingInFlight as Promise<TData>;
	}

	const task = (async () => {
		const getResolvedStore = async () => {
			if (!resolvedStore) {
				resolvedStore = await getGitHubCacheStore();
			}

			return resolvedStore;
		};
		const uniqueNamespaceKeys = Array.from(new Set(namespaceKeys));
		const namespaceVersions =
			cacheMode === "split"
				? await getNamespaceVersions(uniqueNamespaceKeys)
				: {};
		const payloadStorageKey =
			cacheMode === "split" && resolvedPayloadStore
				? await buildGitHubPayloadStorageKey({
						userId,
						resource,
						paramsJson,
						namespaceKeys: uniqueNamespaceKeys,
						namespaceVersions,
					})
				: null;
		const splitEntry =
			resolvedPayloadStore && payloadStorageKey
				? await resolvedPayloadStore.get(payloadStorageKey)
				: null;
		const legacyEntry = splitEntry
			? null
			: await (await getResolvedStore()).get(cacheKey);
		const existingEntry = splitEntry ?? legacyEntry;
		const currentTime = now();
		const latestSignalUpdatedAt =
			signalKeys.length > 0 ? await getLatestSignalUpdatedAt(signalKeys) : null;
		const isSignalNewerThanCache = Boolean(
			existingEntry &&
				typeof latestSignalUpdatedAt === "number" &&
				latestSignalUpdatedAt > existingEntry.fetchedAt,
		);

		if (
			existingEntry &&
			existingEntry.freshUntil > currentTime &&
			!isSignalNewerThanCache
		) {
			if (legacyEntry && resolvedPayloadStore && payloadStorageKey) {
				await resolvedPayloadStore.put(
					payloadStorageKey,
					legacyEntry,
					payloadRetentionSeconds,
				);
			}

			return parseCachedPayload<TData>(existingEntry.payloadJson);
		}

		let result: GitHubFetchResult<TData>;
		try {
			result = await fetcher({
				etag: existingEntry?.etag ?? null,
				lastModified: existingEntry?.lastModified ?? null,
			});
		} catch (error) {
			if (existingEntry && isGitHubRateLimitError(error)) {
				const staleEntry = {
					...existingEntry,
					freshUntil: getRateLimitedStaleFreshUntil(currentTime, error),
					statusCode: getErrorStatusCode(error) ?? existingEntry.statusCode,
				};

				await persistGitHubCacheEntry({
					entry: staleEntry,
					legacyStore: await getResolvedStore(),
					payloadStore: resolvedPayloadStore,
					payloadStorageKey,
					payloadRetentionSeconds,
				});

				return parseCachedPayload<TData>(existingEntry.payloadJson);
			}

			if (existingEntry && isGitHubForbiddenError(error)) {
				const staleEntry = {
					...existingEntry,
					freshUntil: currentTime + GITHUB_STALE_IF_FORBIDDEN_MS,
					statusCode: getErrorStatusCode(error) ?? existingEntry.statusCode,
				};

				await persistGitHubCacheEntry({
					entry: staleEntry,
					legacyStore: await getResolvedStore(),
					payloadStore: resolvedPayloadStore,
					payloadStorageKey,
					payloadRetentionSeconds,
				});

				return parseCachedPayload<TData>(existingEntry.payloadJson);
			}

			throw error;
		}

		if (result.kind === "not-modified") {
			if (!existingEntry) {
				throw new Error(
					`GitHub returned 304 without a cached payload for ${resource}.`,
				);
			}

			const refreshedEntry = {
				...existingEntry,
				etag: result.metadata.etag ?? existingEntry.etag,
				lastModified:
					result.metadata.lastModified ?? existingEntry.lastModified,
				fetchedAt: currentTime,
				freshUntil:
					currentTime +
					getAdaptiveFreshForMs(currentTime, freshForMs, result.metadata),
				rateLimitRemaining: result.metadata.rateLimitRemaining,
				rateLimitReset: result.metadata.rateLimitReset,
				statusCode: result.metadata.statusCode,
			};

			await persistGitHubCacheEntry({
				entry: refreshedEntry,
				legacyStore: await getResolvedStore(),
				payloadStore: resolvedPayloadStore,
				payloadStorageKey,
				payloadRetentionSeconds,
			});

			return parseCachedPayload<TData>(existingEntry.payloadJson);
		}

		const mergedData =
			merge && existingEntry
				? merge(
						parseCachedPayload<TData>(existingEntry.payloadJson),
						result.data,
					)
				: result.data;

		const nextEntry = {
			cacheKey,
			userId,
			resource,
			paramsJson,
			etag: result.metadata.etag,
			lastModified: result.metadata.lastModified,
			payloadJson: JSON.stringify(mergedData),
			fetchedAt: currentTime,
			freshUntil:
				currentTime +
				getAdaptiveFreshForMs(currentTime, freshForMs, result.metadata),
			rateLimitRemaining: result.metadata.rateLimitRemaining,
			rateLimitReset: result.metadata.rateLimitReset,
			statusCode: result.metadata.statusCode,
		};

		await persistGitHubCacheEntry({
			entry: nextEntry,
			legacyStore: await getResolvedStore(),
			payloadStore: resolvedPayloadStore,
			payloadStorageKey,
			payloadRetentionSeconds,
		});

		return mergedData;
	})();

	resolvedInFlightCache?.set(cacheKey, task);

	try {
		return await task;
	} finally {
		resolvedInFlightCache?.delete(cacheKey);
	}
}
