import type {
	PersistedClient,
	Persister,
} from "@tanstack/react-query-persist-client";
import {
	clear,
	createStore,
	delMany,
	entries,
	set,
	setMany,
	type UseStore,
} from "idb-keyval";

/**
 * IndexedDB-backed React Query persister.
 *
 * Unlike `@tanstack/query-async-storage-persister`, which serializes the whole
 * cache into one string on every write, this stores one IndexedDB record per
 * query. A write only touches queries whose `dataUpdatedAt` changed since the
 * last write, so the cost of a save is proportional to what changed, not to the
 * size of the cache.
 *
 * Retention is independent of React Query's in-memory `gcTime`: a query that
 * was garbage-collected from memory stays on disk until it is evicted by the
 * byte budget (least recently updated first) or exceeds `maxAgeMs`. That is
 * what lets "anything you have seen before" paint from cache after a reload.
 *
 * Every storage operation is best-effort. A failed read restores nothing and a
 * failed write is dropped; neither surfaces as an error to the app.
 */

type DehydratedQuery = PersistedClient["clientState"]["queries"][number];

type StoredQuery = DehydratedQuery & {
	/** Estimated serialized size in bytes, used for the budget. */
	size: number;
};

type StoredMeta = {
	buster: string;
};

type IndexEntry = {
	dataUpdatedAt: number;
	size: number;
};

export type IdbQueryPersisterOptions = {
	/** IndexedDB database name. Use one per user so accounts never mix. */
	dbName: string;
	/** Cache buster; a mismatch on restore wipes the database. */
	buster: string;
	/** Total byte budget across all stored queries. */
	maxBytes: number;
	/** Single entries larger than this are never stored. */
	maxEntryBytes?: number;
	/** Entries whose data is older than this are dropped on restore. */
	maxAgeMs: number;
	/** Extra predicate on top of "successful query with data". */
	shouldPersistQuery?: (query: DehydratedQuery) => boolean;
	now?: () => number;
	onError?: (error: unknown, operation: string) => void;
};

export type IdbQueryPersister = Persister & {
	/** Drops every stored query (keeps the database). */
	clear: () => Promise<void>;
	/** Current estimated total bytes on disk. */
	getStoredBytes: () => number;
};

const META_KEY = "__diffkit_query_cache_meta__";
const STORE_NAME = "queries";

const sizeCache = new WeakMap<object, number>();

/**
 * Rough serialized size of a payload. Cached per data object: React Query keeps
 * data referentially stable (structural sharing), so unchanged payloads are
 * measured once.
 */
export function estimateQueryDataSize(data: unknown): number {
	if (data == null) {
		return 0;
	}
	if (typeof data !== "object") {
		return String(data).length;
	}
	const cached = sizeCache.get(data);
	if (cached !== undefined) {
		return cached;
	}
	let size: number;
	try {
		size = JSON.stringify(data)?.length ?? 0;
	} catch {
		size = Number.POSITIVE_INFINITY;
	}
	sizeCache.set(data, size);
	return size;
}

function isQueryRecordKey(key: IDBValidKey): key is string {
	return typeof key === "string" && key !== META_KEY;
}

export function createIdbQueryPersister(
	options: IdbQueryPersisterOptions,
): IdbQueryPersister {
	const {
		dbName,
		buster,
		maxBytes,
		maxEntryBytes = Math.floor(maxBytes / 5),
		maxAgeMs,
		shouldPersistQuery,
		now = Date.now,
		onError,
	} = options;

	let store: UseStore | null = null;
	const getStore = () => {
		if (!store) {
			store = createStore(dbName, STORE_NAME);
		}
		return store;
	};

	/** queryHash → what is on disk. Loaded once, then kept in sync. */
	let index: Map<string, IndexEntry> | null = null;
	let indexPromise: Promise<Map<string, IndexEntry>> | null = null;
	/**
	 * Entries evicted (or too large) at a given `dataUpdatedAt`. They are not
	 * re-written until their data changes, otherwise a query that is still in
	 * memory would be re-added and evicted on every save.
	 */
	const skipped = new Map<string, number>();
	let metaWritten = false;
	/** Serializes writes so a slow save never interleaves with the next one. */
	let queue: Promise<unknown> = Promise.resolve();

	const report = (error: unknown, operation: string) => {
		onError?.(error, operation);
	};

	const enqueue = <T>(task: () => Promise<T>): Promise<T | undefined> => {
		const run = queue.then(task, task).catch((error) => {
			report(error, "queue");
			return undefined;
		});
		queue = run;
		return run;
	};

	const loadIndex = async (): Promise<Map<string, IndexEntry>> => {
		if (index) {
			return index;
		}
		if (!indexPromise) {
			indexPromise = (async () => {
				const next = new Map<string, IndexEntry>();
				try {
					const all = await entries<IDBValidKey, StoredQuery | StoredMeta>(
						getStore(),
					);
					for (const [key, value] of all) {
						if (key === META_KEY) {
							metaWritten = (value as StoredMeta).buster === buster;
							continue;
						}
						if (!isQueryRecordKey(key)) continue;
						const record = value as StoredQuery;
						next.set(key, {
							dataUpdatedAt: record.state.dataUpdatedAt,
							size: record.size,
						});
					}
				} catch (error) {
					report(error, "loadIndex");
				}
				index = next;
				return next;
			})();
		}
		return indexPromise;
	};

	const isPersistable = (query: DehydratedQuery) =>
		query.state.status === "success" &&
		query.state.data != null &&
		(shouldPersistQuery ? shouldPersistQuery(query) : true);

	const writeEntries = async (records: [string, StoredQuery][]) => {
		if (records.length === 0) return;
		try {
			await setMany(records, getStore());
			return;
		} catch (error) {
			report(error, "setMany");
		}
		// One un-cloneable payload fails the whole transaction; isolate it.
		for (const [key, record] of records) {
			try {
				await set(key, record, getStore());
			} catch (error) {
				report(error, "set");
				index?.delete(key);
				skipped.set(key, record.state.dataUpdatedAt);
			}
		}
	};

	const persist = async (client: PersistedClient) => {
		const current = await loadIndex();
		const writes: [string, StoredQuery][] = [];
		const deletes: string[] = [];

		for (const query of client.clientState.queries) {
			if (!isPersistable(query)) continue;
			const { queryHash } = query;
			const { dataUpdatedAt } = query.state;
			const onDisk = current.get(queryHash);
			if (onDisk && onDisk.dataUpdatedAt === dataUpdatedAt) continue;
			if (skipped.get(queryHash) === dataUpdatedAt) continue;

			const size = estimateQueryDataSize(query.state.data);
			if (size > maxEntryBytes) {
				skipped.set(queryHash, dataUpdatedAt);
				if (onDisk) {
					current.delete(queryHash);
					deletes.push(queryHash);
				}
				continue;
			}

			skipped.delete(queryHash);
			const { promise: _promise, ...rest } = query;
			writes.push([queryHash, { ...rest, size }]);
			current.set(queryHash, { dataUpdatedAt, size });
		}

		// Least-recently-updated eviction down to the budget.
		let total = 0;
		for (const entry of current.values()) total += entry.size;
		if (total > maxBytes) {
			const byAge = [...current.entries()].sort(
				(a, b) => a[1].dataUpdatedAt - b[1].dataUpdatedAt,
			);
			for (const [queryHash, entry] of byAge) {
				if (total <= maxBytes) break;
				total -= entry.size;
				current.delete(queryHash);
				skipped.set(queryHash, entry.dataUpdatedAt);
				deletes.push(queryHash);
			}
		}

		const writeKeys = new Set(writes.map(([key]) => key));
		const evictedWrites = deletes.filter((key) => writeKeys.has(key));
		const finalWrites =
			evictedWrites.length > 0
				? writes.filter(([key]) => !evictedWrites.includes(key))
				: writes;

		if (!metaWritten) {
			try {
				await set(META_KEY, { buster } satisfies StoredMeta, getStore());
				metaWritten = true;
			} catch (error) {
				report(error, "writeMeta");
				// Nothing was written: reload the index from disk next time.
				index = null;
				indexPromise = null;
				return;
			}
		}
		await writeEntries(finalWrites);
		if (deletes.length > 0) {
			try {
				await delMany(deletes, getStore());
			} catch (error) {
				report(error, "delMany");
			}
		}
	};

	const restore = async (): Promise<PersistedClient | undefined> => {
		let all: [IDBValidKey, StoredQuery | StoredMeta][];
		try {
			all = await entries(getStore());
		} catch (error) {
			report(error, "restore");
			index = new Map();
			return undefined;
		}

		let meta: StoredMeta | undefined;
		const records: StoredQuery[] = [];
		for (const [key, value] of all) {
			if (key === META_KEY) {
				meta = value as StoredMeta;
			} else if (isQueryRecordKey(key)) {
				records.push(value as StoredQuery);
			}
		}

		if (!meta) {
			index = new Map();
			if (records.length > 0) {
				// Records without metadata are from an unknown writer: drop them.
				await wipe();
			}
			return undefined;
		}

		const cutoff = now() - maxAgeMs;
		const next = new Map<string, IndexEntry>();
		const expired: string[] = [];
		const queries: DehydratedQuery[] = [];
		for (const record of records) {
			if (record.state.dataUpdatedAt < cutoff) {
				expired.push(record.queryHash);
				continue;
			}
			next.set(record.queryHash, {
				dataUpdatedAt: record.state.dataUpdatedAt,
				size: record.size,
			});
			const { size: _size, ...query } = record;
			queries.push(query);
		}
		index = next;
		metaWritten = meta.buster === buster;
		if (expired.length > 0) {
			void enqueue(() => delMany(expired, getStore()));
		}

		return {
			// Per-entry ages are enforced above; the client as a whole is fresh.
			timestamp: now(),
			buster: meta.buster,
			clientState: { queries, mutations: [] },
		};
	};

	const wipe = async () => {
		index = new Map();
		indexPromise = null;
		skipped.clear();
		metaWritten = false;
		try {
			await clear(getStore());
		} catch (error) {
			report(error, "clear");
		}
	};

	return {
		persistClient: (client) => enqueue(() => persist(client)),
		restoreClient: () => enqueue(restore).then((client) => client ?? undefined),
		removeClient: () => enqueue(wipe).then(() => undefined),
		clear: () => enqueue(wipe).then(() => undefined),
		getStoredBytes: () => {
			let total = 0;
			for (const entry of index?.values() ?? []) total += entry.size;
			return total;
		},
	};
}
