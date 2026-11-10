import { dehydrate, hydrate, type QueryClient } from "@tanstack/react-query";
import { readDocumentCookie } from "./cookies";
import {
	isGitHubQueryKeyPersistable,
	QUERY_SCHEMA_VERSION,
} from "./github.query";
import {
	createIdbQueryPersister,
	type DehydratedQuery,
	type IdbQueryPersister,
} from "./query-persister";
import { parseViewerHint } from "./viewer-hint";

/**
 * Client persistence for every `["github", userId, ...]` query.
 *
 * - One IndexedDB database per user id, so accounts on a shared browser never
 *   read each other's data.
 * - ~50 MB budget with least-recently-updated eviction (see query-persister).
 * - The most recently updated ~4 MB restore before first paint, the rest after.
 * - Busted by `QUERY_SCHEMA_VERSION`.
 * - Large payloads opt out via `githubQueryPersistOptOut`.
 * - Wiped on sign-out and when the background session check fails.
 */

export const GITHUB_QUERY_CACHE_MAX_BYTES = 50 * 1024 * 1024;
/**
 * Restored before first paint. Reading costs main-thread time in proportion
 * to size, so this bounds how long a large cache can hold the first render.
 */
export const GITHUB_QUERY_CACHE_RECENT_BYTES = 4 * 1024 * 1024;
export const GITHUB_QUERY_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** Longest the first paint waits for IndexedDB before rendering without it. */
export const GITHUB_QUERY_RESTORE_TIMEOUT_MS = 400;
const PERSIST_THROTTLE_MS = 1000;
const LEGACY_LOCAL_STORAGE_KEY = "diffkit:github-query-cache:v1";

export function githubQueryCacheDbName(userId: string) {
	return `diffkit-query-cache:${userId}`;
}

export function getGitHubQueryCacheBuster() {
	return `github-v${QUERY_SCHEMA_VERSION}`;
}

const persisters = new Map<string, IdbQueryPersister>();

function isIndexedDbAvailable() {
	try {
		return typeof indexedDB !== "undefined" && indexedDB !== null;
	} catch {
		return false;
	}
}

export function getGitHubQueryPersister(
	userId: string,
): IdbQueryPersister | null {
	if (!isIndexedDbAvailable()) {
		return null;
	}
	let persister = persisters.get(userId);
	if (!persister) {
		persister = createIdbQueryPersister({
			dbName: githubQueryCacheDbName(userId),
			buster: getGitHubQueryCacheBuster(),
			maxBytes: GITHUB_QUERY_CACHE_MAX_BYTES,
			recentBytes: GITHUB_QUERY_CACHE_RECENT_BYTES,
			maxAgeMs: GITHUB_QUERY_CACHE_MAX_AGE_MS,
			// Only this user's queries go into this user's database.
			shouldPersistQuery: (query) =>
				query.queryKey[1] === userId &&
				isGitHubQueryKeyPersistable(query.queryKey),
			onError: import.meta.env?.DEV
				? (error, operation) =>
						console.warn(`[query-cache] ${operation} failed`, error)
				: undefined,
		});
		persisters.set(userId, persister);
	}
	return persister;
}

/** The user whose cache is active: the last known viewer from the hint cookie. */
export function getActiveGitHubQueryCacheUserId(): string | null {
	return parseViewerHint(readDocumentCookie())?.id ?? null;
}

function removeLegacyLocalStorageCache() {
	try {
		window.localStorage.removeItem(LEGACY_LOCAL_STORAGE_KEY);
	} catch {
		// Storage unavailable.
	}
}

function hydrateQueries(queryClient: QueryClient, queries: DehydratedQuery[]) {
	hydrate(queryClient, { queries, mutations: [] });
}

/**
 * Hydrates the query client with the most recently updated queries in
 * IndexedDB. Resolves after the restore or after `timeoutMs`, whichever comes
 * first; a slow or failing restore never delays first paint by more than that,
 * and a late restore still hydrates when it lands (hydrate never overwrites
 * newer data). `restoreRestOfGitHubQueryCache` brings in everything else.
 */
export async function restoreGitHubQueryCache(
	queryClient: QueryClient,
	options: { userId?: string | null; timeoutMs?: number } = {},
): Promise<"restored" | "empty" | "timeout" | "unavailable"> {
	if (typeof window === "undefined") return "unavailable";
	removeLegacyLocalStorageCache();
	const userId = options.userId ?? getActiveGitHubQueryCacheUserId();
	if (!userId) return "empty";
	const persister = getGitHubQueryPersister(userId);
	if (!persister) return "unavailable";

	const restore = persister.restoreRecent().then((queries) => {
		hydrateQueries(queryClient, queries);
		return "restored" as const;
	});

	const timeoutMs = options.timeoutMs ?? GITHUB_QUERY_RESTORE_TIMEOUT_MS;
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<"timeout">((resolve) => {
		timer = setTimeout(() => resolve("timeout"), timeoutMs);
	});
	const result = await Promise.race([restore, timeout]);
	clearTimeout(timer);
	return result;
}

/**
 * Hydrates every stored query the first restore left out, a page at a time so
 * a large cache never blocks the main thread for long.
 */
export async function restoreRestOfGitHubQueryCache(
	queryClient: QueryClient,
	userId: string | null = getActiveGitHubQueryCacheUserId(),
) {
	if (typeof window === "undefined" || !userId || wipedUserIds.has(userId)) {
		return;
	}
	await getGitHubQueryPersister(userId)?.restoreRest((queries) => {
		if (!wipedUserIds.has(userId)) hydrateQueries(queryClient, queries);
	});
}

/** Users whose cache was wiped in this page; never written again until reload. */
const wipedUserIds = new Set<string>();

/**
 * Writes the query cache to the active user's IndexedDB database, throttled to
 * once per second and flushed when the tab is hidden or unloaded.
 */
export function startGitHubQueryPersistence(queryClient: QueryClient) {
	if (typeof window === "undefined") return () => undefined;

	let timer: ReturnType<typeof setTimeout> | undefined;

	const save = () => {
		timer = undefined;
		const userId = getActiveGitHubQueryCacheUserId();
		if (!userId || wipedUserIds.has(userId)) return;
		const persister = getGitHubQueryPersister(userId);
		if (!persister) return;
		try {
			const clientState = dehydrate(queryClient, {
				shouldDehydrateQuery: (query) =>
					query.state.status === "success" &&
					query.state.data != null &&
					query.queryKey[1] === userId &&
					isGitHubQueryKeyPersistable(query.queryKey),
				shouldDehydrateMutation: () => false,
			});
			void persister.persist(clientState.queries);
		} catch {
			// A failed save is a cache miss on the next load, never an error.
		}
	};

	const schedule = () => {
		if (timer === undefined) {
			timer = setTimeout(save, PERSIST_THROTTLE_MS);
		}
	};

	const flush = () => {
		if (timer !== undefined) {
			clearTimeout(timer);
			save();
		}
	};
	const onVisibilityChange = () => {
		if (document.visibilityState === "hidden") flush();
	};

	const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
		if (
			event.type === "added" ||
			event.type === "removed" ||
			event.type === "updated"
		) {
			schedule();
		}
	});
	document.addEventListener("visibilitychange", onVisibilityChange);
	window.addEventListener("pagehide", flush);

	return () => {
		unsubscribe();
		document.removeEventListener("visibilitychange", onVisibilityChange);
		window.removeEventListener("pagehide", flush);
		if (timer !== undefined) clearTimeout(timer);
	};
}

function deleteDatabase(name: string) {
	try {
		// Resolves on its own; a "blocked" delete finishes once other tabs close
		// the connection. The store is already cleared, so nothing leaks meanwhile.
		indexedDB.deleteDatabase(name);
	} catch {
		// ignore
	}
}

/**
 * Sign-out / session-loss wipe: drops in-memory queries and the user's whole
 * IndexedDB cache. Persistence for that user stays off until the page unloads,
 * so a pending flush cannot write the data back.
 */
export async function wipeGitHubQueryCache(
	queryClient: QueryClient | null,
	userId: string | null = getActiveGitHubQueryCacheUserId(),
) {
	if (userId) wipedUserIds.add(userId);
	queryClient?.clear();
	if (!userId || !isIndexedDbAvailable()) return;
	const persister = getGitHubQueryPersister(userId);
	await persister?.clear();
	persisters.delete(userId);
	deleteDatabase(githubQueryCacheDbName(userId));
}

/**
 * Command palette "Refresh data": clear the user's stored cache and refetch
 * every GitHub query in place. Active queries refetch immediately; inactive
 * ones refetch the next time they are used.
 */
export async function refreshGitHubQueryCache(queryClient: QueryClient) {
	// Reset first so no save can write the old payloads back after the clear.
	// Fresh results that land before the clear finishes are re-written by the
	// next save, because the cleared index no longer lists them.
	const refetch = queryClient.resetQueries({ queryKey: ["github"] });
	const userId = getActiveGitHubQueryCacheUserId();
	if (userId) {
		await getGitHubQueryPersister(userId)?.clear();
	}
	await refetch;
}
