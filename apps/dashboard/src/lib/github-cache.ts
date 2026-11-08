/**
 * GitHub request plumbing.
 *
 * The persistent server cache (D1 `github_response_cache` + KV split payloads)
 * and the webhook revalidation pipeline (signals, namespaces, webhook event
 * log) were removed after they filled the production D1 database to its 10 GB
 * limit and broke sign-in (see docs/platform-plan.md, "Incidents").
 *
 * Every read now goes straight to GitHub. The only reuse left is a
 * request-scoped in-flight map so that identical reads made while rendering a
 * single request share one GitHub call. Nothing is stored across requests.
 *
 * Call sites still pass cache-era options (`resource`, `params`,
 * `freshForMs`, `signalKeys`, `namespaceKeys`, `cacheMode`, `merge`). They are
 * accepted and ignored until the replacement data-fetching strategy lands and
 * those call sites are rewritten.
 */

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

type GitHubResourceOptions<TData> = {
	userId: string;
	resource: string;
	params?: unknown;
	fetcher: (
		conditionals: GitHubConditionalHeaders,
	) => Promise<GitHubFetchResult<TData>>;
	inFlightCache?: Map<string, Promise<unknown>>;
	/** Ignored: legacy cache option kept for call-site compatibility. */
	freshForMs?: number;
	/** Ignored: legacy cache option kept for call-site compatibility. */
	signalKeys?: string[];
	/** Ignored: legacy cache option kept for call-site compatibility. */
	namespaceKeys?: string[];
	/** Ignored: legacy cache option kept for call-site compatibility. */
	cacheMode?: "legacy" | "split";
	/** Ignored: legacy cache option kept for call-site compatibility. */
	payloadRetentionSeconds?: number;
	/** Ignored: there is never a previous payload to merge with. */
	merge?: (existing: TData, fresh: TData) => TData;
};

const NO_CONDITIONALS: GitHubConditionalHeaders = Object.freeze({
	etag: null,
	lastModified: null,
});

const requestScopedInFlightGitHubReads = new WeakMap<
	Request,
	Map<string, Promise<unknown>>
>();

async function getRequestScopedInFlightCache() {
	try {
		const { getRequest } = await import("@tanstack/react-start/server");
		const request = getRequest();
		let inFlightCache = requestScopedInFlightGitHubReads.get(request);

		if (!inFlightCache) {
			inFlightCache = new Map<string, Promise<unknown>>();
			requestScopedInFlightGitHubReads.set(request, inFlightCache);
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

function buildInFlightKey(userId: string, resource: string, params: unknown) {
	return `${userId}::${resource}::${JSON.stringify(normalizeJsonValue(params ?? null))}`;
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

/**
 * Fetches a GitHub resource directly. Identical reads within the same server
 * request share one in-flight call; nothing is persisted.
 */
export async function getOrRevalidateGitHubResource<TData>({
	userId,
	resource,
	params,
	fetcher,
	inFlightCache,
}: GitHubResourceOptions<TData>): Promise<TData> {
	const key = buildInFlightKey(userId, resource, params);
	const resolvedInFlightCache =
		inFlightCache ?? (await getRequestScopedInFlightCache());

	const existingInFlight = resolvedInFlightCache?.get(key);
	if (existingInFlight) {
		return existingInFlight as Promise<TData>;
	}

	const task = (async () => {
		const result = await fetcher(NO_CONDITIONALS);
		if (result.kind === "not-modified") {
			// No conditional headers are ever sent, so GitHub should never answer
			// 304 here; treat it as a programming error rather than serve nothing.
			throw new Error(
				`GitHub returned 304 for ${resource} without a conditional request.`,
			);
		}
		return result.data;
	})();

	resolvedInFlightCache?.set(key, task);

	try {
		return await task;
	} finally {
		resolvedInFlightCache?.delete(key);
	}
}

/** No-op: the server response cache was removed. Kept for call sites. */
export async function bustGitHubCache(
	_userId: string,
	_resource: string,
	_params?: unknown,
): Promise<void> {}

/** No-op: cache namespaces were removed. Kept for call sites. */
export async function bumpGitHubCacheNamespaces(
	_namespaceKeys: string[],
): Promise<void> {}

/** No-op: revalidation signals were removed. Kept for call sites. */
export async function markGitHubRevalidationSignals(
	_signalKeys: string[],
): Promise<number> {
	return 0;
}
