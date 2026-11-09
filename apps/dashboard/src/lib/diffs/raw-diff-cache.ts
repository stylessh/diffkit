import { createStore, del, entries, get, set, type UseStore } from "idb-keyval";

const MAX_BYTES = 40 * 1024 * 1024;
const MAX_ENTRY_BYTES = 12 * 1024 * 1024;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const INDEX_KEY = "__index";

type CacheIndex = Record<string, { storedAt: number; size: number }>;

const stores = new Map<string, UseStore>();

export function rawDiffCacheDbName(userId: string) {
	return `diffkit-diff-cache:${userId}`;
}

function getStore(userId: string): UseStore | null {
	try {
		if (typeof indexedDB === "undefined") return null;
	} catch {
		return null;
	}
	let store = stores.get(userId);
	if (!store) {
		store = createStore(rawDiffCacheDbName(userId), "raw-diffs");
		stores.set(userId, store);
	}
	return store;
}

/**
 * Raw PR diffs keyed by immutable revisions, so a hit never needs revalidation.
 * Best-effort like the query cache: any storage failure is a miss.
 */
export async function readRawDiff(
	userId: string,
	key: string,
): Promise<string | null> {
	const store = getStore(userId);
	if (!store) return null;
	try {
		const index = (await get<CacheIndex>(INDEX_KEY, store)) ?? {};
		const entry = index[key];
		if (!entry || Date.now() - entry.storedAt > MAX_AGE_MS) return null;
		return (await get<string>(key, store)) ?? null;
	} catch {
		return null;
	}
}

export async function writeRawDiff(userId: string, key: string, text: string) {
	const size = text.length * 2;
	if (size > MAX_ENTRY_BYTES) return;
	const store = getStore(userId);
	if (!store) return;
	try {
		const index = (await get<CacheIndex>(INDEX_KEY, store)) ?? {};
		index[key] = { storedAt: Date.now(), size };
		const now = Date.now();
		const byAge = Object.entries(index).sort(
			([, a], [, b]) => b.storedAt - a.storedAt,
		);
		let total = 0;
		const evicted: string[] = [];
		for (const [entryKey, entry] of byAge) {
			total += entry.size;
			if (total > MAX_BYTES || now - entry.storedAt > MAX_AGE_MS) {
				evicted.push(entryKey);
				delete index[entryKey];
			}
		}
		await set(key, text, store);
		await set(INDEX_KEY, index, store);
		await Promise.all(evicted.map((entryKey) => del(entryKey, store)));
	} catch {
		// A failed write is a miss on the next visit.
	}
}

export async function wipeRawDiffCache(userId: string) {
	const store = getStore(userId);
	stores.delete(userId);
	if (!store) return;
	try {
		const keys = (await entries(store)).map(([key]) => key);
		await Promise.all(keys.map((key) => del(key, store)));
		indexedDB.deleteDatabase(rawDiffCacheDbName(userId));
	} catch {
		// Best effort.
	}
}
