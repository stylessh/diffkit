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

export type GitHubLocalFirstMeta = {
	cacheStatus: "fresh" | "stale" | "miss";
	fetchedAt: number | null;
	isRevalidating: boolean;
};

export type BackgroundExecutionContext = {
	waitUntil(promise: Promise<unknown>): void;
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

export type GitHubWebhookEventRecord = {
	deliveryId: string;
	event: string;
	signalKeys: string[];
	receivedAt?: number;
};

/**
 * Records a webhook delivery for audit and replay. Idempotent on deliveryId —
 * GitHub retries reuse the same X-GitHub-Delivery header, so only the first
 * attempt persists. Returns true when a new row was inserted.
 */
export async function recordGitHubWebhookEvent({
	deliveryId,
	event,
	signalKeys,
	receivedAt = Date.now(),
}: GitHubWebhookEventRecord) {
	const [{ getDb }, { githubWebhookEvent }] = await Promise.all([
		import("../db"),
		import("../db/schema"),
	]);
	const db = getDb();

	const inserted = await db
		.insert(githubWebhookEvent)
		.values({
			deliveryId,
			event,
			signalKeysJson: JSON.stringify(signalKeys),
			receivedAt,
		})
		.onConflictDoNothing({ target: githubWebhookEvent.deliveryId })
		.returning({ id: githubWebhookEvent.id });

	return inserted.length > 0;
}

export async function markGitHubWebhookEventProcessed(
	deliveryId: string,
	at = Date.now(),
) {
	const [{ eq }, { getDb }, { githubWebhookEvent }] = await Promise.all([
		import("drizzle-orm"),
		import("../db"),
		import("../db/schema"),
	]);
	const db = getDb();

	await db
		.update(githubWebhookEvent)
		.set({ processedAt: at, errorMessage: null })
		.where(eq(githubWebhookEvent.deliveryId, deliveryId));
}

export async function markGitHubWebhookEventFailed(
	deliveryId: string,
	errorMessage: string,
) {
	const [{ eq }, { getDb }, { githubWebhookEvent }] = await Promise.all([
		import("drizzle-orm"),
		import("../db"),
		import("../db/schema"),
	]);
	const db = getDb();

	await db
		.update(githubWebhookEvent)
		.set({ errorMessage: errorMessage.slice(0, 2000) })
		.where(eq(githubWebhookEvent.deliveryId, deliveryId));
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

async function getGitHubCacheKvNamespace(): Promise<KVNamespace | null> {
	try {
		const { env } = await import("cloudflare:workers");
		const workerEnv = env as typeof env & {
			GITHUB_CACHE_KV?: KVNamespace;
		};
		return workerEnv.GITHUB_CACHE_KV ?? null;
	} catch {
		return null;
	}
}

/**
 * Drops every cached GitHub response that belongs to the user. Clears legacy
 * D1 rows (response cache) and best-effort sweeps the KV split-mode payload
 * store keyed by `gh:${userId}:`. Global signal/namespace tables are left
 * alone so other users keep their state.
 */
export async function clearAllGitHubCacheForUser(userId: string) {
	const [{ eq }, { getDb }, { githubResponseCache }] = await Promise.all([
		import("drizzle-orm"),
		import("../db"),
		import("../db/schema"),
	]);
	const db = getDb();

	const deletedDbRows = await db
		.delete(githubResponseCache)
		.where(eq(githubResponseCache.userId, userId))
		.returning({ cacheKey: githubResponseCache.cacheKey });

	let deletedKvKeys = 0;
	const kv = await getGitHubCacheKvNamespace();
	if (kv) {
		const prefix = `gh:${userId}:`;
		let cursor: string | undefined;

		do {
			const result: KVNamespaceListResult<unknown, string> = await kv.list({
				prefix,
				cursor,
			});

			if (result.keys.length > 0) {
				await Promise.all(result.keys.map((key) => kv.delete(key.name)));
				deletedKvKeys += result.keys.length;
			}

			cursor = result.list_complete ? undefined : result.cursor;
		} while (cursor);
	}

	return {
		deletedDbRows: deletedDbRows.length,
		deletedKvKeys,
	};
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

async function resolveGitHubCacheEntry({
	userId,
	resource,
	params,
	signalKeys,
	namespaceKeys,
	cacheMode,
	payloadRetentionSeconds,
	store,
	payloadStore,
	getLatestSignalUpdatedAt,
	getNamespaceVersions,
	now,
}: {
	userId: string;
	resource: string;
	params: unknown;
	signalKeys: string[];
	namespaceKeys: string[];
	cacheMode: "legacy" | "split";
	payloadRetentionSeconds: number;
	store?: GitHubCacheStore;
	payloadStore?: GitHubPayloadCacheStore | null;
	getLatestSignalUpdatedAt: (signalKeys: string[]) => Promise<number | null>;
	getNamespaceVersions: (
		namespaceKeys: string[],
	) => Promise<Record<string, number>>;
	now: () => number;
}) {
	let resolvedStore = store ?? null;
	const resolvedPayloadStore =
		typeof payloadStore !== "undefined"
			? payloadStore
			: cacheMode === "split"
				? await getGitHubPayloadCacheStore()
				: null;
	const paramsJson = stableSerialize(params);
	const cacheKey = buildGitHubCacheKey({ userId, resource, paramsJson });
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

	if (legacyEntry && resolvedPayloadStore && payloadStorageKey) {
		await resolvedPayloadStore.put(
			payloadStorageKey,
			legacyEntry,
			payloadRetentionSeconds,
		);
	}

	return {
		cacheKey,
		currentTime,
		existingEntry,
		getResolvedStore,
		paramsJson,
		payloadStorageKey,
		resolvedPayloadStore,
		isSignalNewerThanCache,
	};
}

export async function getGitHubResourceLocalFirst<TData>({
	executionContext,
	onBackgroundRefreshSettled,
	...options
}: GetOrRevalidateGitHubResourceOptions<TData> & {
	executionContext?: BackgroundExecutionContext | null;
	onBackgroundRefreshSettled?: () => Promise<void> | void;
}): Promise<{ data: TData; meta: GitHubLocalFirstMeta }> {
	const {
		userId,
		resource,
		params,
		signalKeys = [],
		namespaceKeys = [],
		cacheMode = "legacy",
		payloadRetentionSeconds = DEFAULT_GITHUB_PAYLOAD_RETENTION_SECONDS,
		now = Date.now,
		store,
		payloadStore,
		getLatestSignalUpdatedAt = getLatestGitHubRevalidationSignalUpdatedAt,
		getNamespaceVersions = getGitHubCacheNamespaceVersions,
	} = options;
	const resolved = await resolveGitHubCacheEntry({
		userId,
		resource,
		params,
		signalKeys,
		namespaceKeys,
		cacheMode,
		payloadRetentionSeconds,
		store,
		payloadStore,
		getLatestSignalUpdatedAt,
		getNamespaceVersions,
		now,
	});

	if (
		resolved.existingEntry &&
		resolved.existingEntry.freshUntil > resolved.currentTime &&
		!resolved.isSignalNewerThanCache
	) {
		return {
			data: parseCachedPayload<TData>(resolved.existingEntry.payloadJson),
			meta: {
				cacheStatus: "fresh",
				fetchedAt: resolved.existingEntry.fetchedAt,
				isRevalidating: false,
			},
		};
	}

	if (resolved.existingEntry) {
		const previousFetchedAt = resolved.existingEntry.fetchedAt;
		const refreshPromise = getOrRevalidateGitHubResource({
			...options,
			store: store ?? (await resolved.getResolvedStore()),
			payloadStore: resolved.resolvedPayloadStore,
			now,
			getLatestSignalUpdatedAt,
			getNamespaceVersions,
		})
			.then(async () => {
				const nextEntry = await (await resolved.getResolvedStore()).get(
					resolved.cacheKey,
				);
				if (
					nextEntry &&
					nextEntry.fetchedAt > previousFetchedAt &&
					onBackgroundRefreshSettled
				) {
					await onBackgroundRefreshSettled();
				}
			})
			.catch(() => {
				// Best effort: stale cached payload already served to the caller.
			});

		if (executionContext?.waitUntil) {
			executionContext.waitUntil(refreshPromise);
		} else {
			void refreshPromise;
		}

		return {
			data: parseCachedPayload<TData>(resolved.existingEntry.payloadJson),
			meta: {
				cacheStatus: "stale",
				fetchedAt: resolved.existingEntry.fetchedAt,
				isRevalidating: true,
			},
		};
	}

	const data = await getOrRevalidateGitHubResource(options);
	return {
		data,
		meta: {
			cacheStatus: "miss",
			fetchedAt: null,
			isRevalidating: false,
		},
	};
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
		const resolved = await resolveGitHubCacheEntry({
			userId,
			resource,
			params,
			signalKeys,
			namespaceKeys,
			cacheMode,
			payloadRetentionSeconds,
			store: resolvedStore ?? undefined,
			payloadStore: resolvedPayloadStore,
			getLatestSignalUpdatedAt,
			getNamespaceVersions,
			now,
		});
		const existingEntry = resolved.existingEntry;
		const currentTime = resolved.currentTime;
		const payloadStorageKey = resolved.payloadStorageKey;
		const isSignalNewerThanCache = resolved.isSignalNewerThanCache;
		const getLegacyStore = async () => {
			if (!resolvedStore) {
				resolvedStore = await resolved.getResolvedStore();
			}

			return resolvedStore;
		};

		if (
			existingEntry &&
			existingEntry.freshUntil > currentTime &&
			!isSignalNewerThanCache
		) {
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
					legacyStore: await getLegacyStore(),
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
					legacyStore: await getLegacyStore(),
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
				legacyStore: await getLegacyStore(),
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
			legacyStore: await getLegacyStore(),
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
