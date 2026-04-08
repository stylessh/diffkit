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
	fetcher: (
		conditionals: GitHubConditionalHeaders,
	) => Promise<GitHubFetchResult<TData>>;
	store?: GitHubCacheStore;
	inFlightCache?: Map<string, Promise<unknown>>;
	now?: () => number;
};

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

export async function getOrRevalidateGitHubResource<TData>({
	userId,
	resource,
	params,
	freshForMs,
	fetcher,
	now = Date.now,
	store,
	inFlightCache,
}: GetOrRevalidateGitHubResourceOptions<TData>): Promise<TData> {
	const resolvedStore = store ?? (await getGitHubCacheStore());
	const paramsJson = stableSerialize(params);
	const cacheKey = buildGitHubCacheKey({ userId, resource, paramsJson });
	const resolvedInFlightCache =
		inFlightCache ?? (await getRequestScopedInFlightCache());

	const existingInFlight = resolvedInFlightCache?.get(cacheKey);
	if (existingInFlight) {
		return existingInFlight as Promise<TData>;
	}

	const task = (async () => {
		const existingEntry = await resolvedStore.get(cacheKey);
		const currentTime = now();

		if (existingEntry && existingEntry.freshUntil > currentTime) {
			return parseCachedPayload<TData>(existingEntry.payloadJson);
		}

		const result = await fetcher({
			etag: existingEntry?.etag ?? null,
			lastModified: existingEntry?.lastModified ?? null,
		});

		if (result.kind === "not-modified") {
			if (!existingEntry) {
				throw new Error(
					`GitHub returned 304 without a cached payload for ${resource}.`,
				);
			}

			await resolvedStore.upsert({
				...existingEntry,
				etag: result.metadata.etag ?? existingEntry.etag,
				lastModified:
					result.metadata.lastModified ?? existingEntry.lastModified,
				fetchedAt: currentTime,
				freshUntil: currentTime + freshForMs,
				rateLimitRemaining: result.metadata.rateLimitRemaining,
				rateLimitReset: result.metadata.rateLimitReset,
				statusCode: result.metadata.statusCode,
			});

			return parseCachedPayload<TData>(existingEntry.payloadJson);
		}

		await resolvedStore.upsert({
			cacheKey,
			userId,
			resource,
			paramsJson,
			etag: result.metadata.etag,
			lastModified: result.metadata.lastModified,
			payloadJson: JSON.stringify(result.data),
			fetchedAt: currentTime,
			freshUntil: currentTime + freshForMs,
			rateLimitRemaining: result.metadata.rateLimitRemaining,
			rateLimitReset: result.metadata.rateLimitReset,
			statusCode: result.metadata.statusCode,
		});

		return result.data;
	})();

	resolvedInFlightCache?.set(cacheKey, task);

	try {
		return await task;
	} finally {
		resolvedInFlightCache?.delete(cacheKey);
	}
}
