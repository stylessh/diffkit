import type { DehydratedState } from "@tanstack/react-query";
import {
	clear,
	createStore,
	delMany,
	getMany,
	promisifyRequest,
	set,
	setMany,
	type UseStore,
} from "idb-keyval";

/**
 * IndexedDB-backed React Query persister.
 *
 * One IndexedDB record per query. A write only touches queries whose
 * `dataUpdatedAt` changed since the last write, so the cost of a save is
 * proportional to what changed, not to the size of the cache.
 *
 * Reading a record deserializes it on the main thread (about 3 ms per MB), so
 * a restore comes in two parts. `restoreRecent` reads only the most recently
 * updated queries, up to `recentBytes`, and is cheap enough to await before
 * first paint. `restoreRest` pages through everything else afterwards.
 *
 * Retention is independent of React Query's in-memory `gcTime`: a query that
 * was garbage-collected from memory stays on disk until it is evicted by the
 * byte budget (least recently updated first) or exceeds `maxAgeMs`. That is
 * what lets "anything you have seen before" paint from cache after a reload.
 *
 * Every storage operation is best-effort. A failed read restores nothing and a
 * failed write is dropped; neither surfaces as an error to the app.
 */

export type DehydratedQuery = DehydratedState["queries"][number];

type StoredQuery = DehydratedQuery & {
	/** Estimated serialized size in bytes, used for the budgets. */
	size: number;
};

type StoredMeta = {
	buster: string;
};

type IndexEntry = {
	dataUpdatedAt: number;
	size: number;
};

/**
 * What this tab knows about the database. `recent` covers the queries
 * `restoreRecent` read, plus anything written since; only `complete` knows
 * every record, which the byte budget needs.
 */
type DiskIndex =
	| { coverage: "unread" }
	| {
			coverage: "recent" | "complete";
			entries: Map<string, IndexEntry>;
			hasMeta: boolean;
	  };

type ReadDiskIndex = Exclude<DiskIndex, { coverage: "unread" }>;

export type IdbQueryPersisterOptions = {
	/** IndexedDB database name. Use one per user so accounts never mix. */
	dbName: string;
	/** Cache buster; a mismatch on restore wipes the database. */
	buster: string;
	/** Total byte budget across all stored queries. */
	maxBytes: number;
	/** Single entries larger than this are never stored. */
	maxEntryBytes?: number;
	/** Byte budget of the queries `restoreRecent` reads. */
	recentBytes?: number;
	/** Entries whose data is older than this are dropped on restore. */
	maxAgeMs: number;
	/** Extra predicate on top of "successful query with data". */
	shouldPersistQuery?: (query: DehydratedQuery) => boolean;
	now?: () => number;
	onError?: (error: unknown, operation: string) => void;
};

export type IdbQueryPersister = {
	/** Writes the queries whose data changed since the last save. */
	persist: (queries: DehydratedQuery[]) => Promise<void>;
	/** The most recently updated queries, newest first. */
	restoreRecent: () => Promise<DehydratedQuery[]>;
	/** Every query `restoreRecent` left out, delivered a page at a time. */
	restoreRest: (deliver: (queries: DehydratedQuery[]) => void) => Promise<void>;
	/** Drops every stored query (keeps the database). */
	clear: () => Promise<void>;
	/** Estimated total bytes of the stored queries this tab has indexed. */
	getStoredBytes: () => number;
};

const META_KEY = "__diffkit_query_cache_meta__";
/** Hashes of the most recently updated queries: what `restoreRecent` reads. */
const RECENT_KEY = "__diffkit_query_cache_recent__";
const STORE_NAME = "queries";
const PAGE_SIZE = 50;

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
	return typeof key === "string" && key !== META_KEY && key !== RECENT_KEY;
}

function newestFirst(entries: Map<string, IndexEntry>) {
	return [...entries.entries()].sort(
		(a, b) => b[1].dataUpdatedAt - a[1].dataUpdatedAt,
	);
}

function toQuery({ size: _size, ...query }: StoredQuery): DehydratedQuery {
	return query;
}

export function createIdbQueryPersister(
	options: IdbQueryPersisterOptions,
): IdbQueryPersister {
	const {
		dbName,
		buster,
		maxBytes,
		maxEntryBytes = Math.floor(maxBytes / 5),
		recentBytes = maxBytes,
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

	let disk: DiskIndex = { coverage: "unread" };
	/**
	 * Entries evicted (or too large) at a given `dataUpdatedAt`. They are not
	 * re-written until their data changes, otherwise a query that is still in
	 * memory would be re-added and evicted on every save.
	 */
	const skipped = new Map<string, number>();
	let writtenRecentKeys: string[] = [];
	/** Serializes storage work so a slow save never interleaves with the next one. */
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

	const wipe = async (): Promise<ReadDiskIndex> => {
		const empty: ReadDiskIndex = {
			coverage: "complete",
			entries: new Map(),
			hasMeta: false,
		};
		disk = empty;
		skipped.clear();
		writtenRecentKeys = [];
		try {
			await clear(getStore());
		} catch (error) {
			report(error, "clear");
		}
		return empty;
	};

	const isExpired = (record: StoredQuery) =>
		record.state.dataUpdatedAt < now() - maxAgeMs;

	const readPage = (after: IDBValidKey | null) =>
		getStore()("readonly", (objectStore) => {
			const range =
				after === null ? undefined : IDBKeyRange.lowerBound(after, true);
			return Promise.all([
				promisifyRequest(objectStore.getAllKeys(range, PAGE_SIZE)),
				promisifyRequest<Array<StoredQuery | StoredMeta | string[]>>(
					objectStore.getAll(range, PAGE_SIZE),
				),
			]);
		});

	const readRest = async (
		known: ReadDiskIndex,
		deliver: (queries: DehydratedQuery[]) => void,
	): Promise<ReadDiskIndex> => {
		if (known.coverage === "complete") return known;
		const { entries } = known;
		const expired: string[] = [];
		try {
			let after: IDBValidKey | null = null;
			for (;;) {
				const [keys, values] = await readPage(after);
				const queries: DehydratedQuery[] = [];
				keys.forEach((key, position) => {
					if (!isQueryRecordKey(key) || entries.has(key)) return;
					const record = values[position] as StoredQuery;
					if (isExpired(record)) {
						expired.push(key);
						return;
					}
					entries.set(key, {
						dataUpdatedAt: record.state.dataUpdatedAt,
						size: record.size,
					});
					queries.push(toQuery(record));
				});
				if (queries.length > 0) deliver(queries);
				if (keys.length < PAGE_SIZE) break;
				after = keys[keys.length - 1];
			}
		} catch (error) {
			report(error, "restoreRest");
		}
		if (expired.length > 0) {
			try {
				await delMany(expired, getStore());
			} catch (error) {
				report(error, "delMany");
			}
		}
		disk = { ...known, coverage: "complete" };
		return disk;
	};

	const openDisk = async (): Promise<{
		index: ReadDiskIndex;
		queries: DehydratedQuery[];
	}> => {
		let meta: StoredMeta | undefined;
		let recentKeys: string[] | undefined;
		try {
			[meta, recentKeys] = (await getMany(
				[META_KEY, RECENT_KEY],
				getStore(),
			)) as [StoredMeta | undefined, string[] | undefined];
		} catch (error) {
			report(error, "restore");
		}
		// Records under another buster, or without metadata, are not ours to read.
		if (meta?.buster !== buster) {
			return { index: await wipe(), queries: [] };
		}

		const entries = new Map<string, IndexEntry>();
		const recent: ReadDiskIndex = {
			coverage: "recent",
			entries,
			hasMeta: true,
		};
		disk = recent;
		if (!recentKeys) {
			const queries: DehydratedQuery[] = [];
			const index = await readRest(recent, (page) => queries.push(...page));
			return { index, queries };
		}

		writtenRecentKeys = recentKeys;
		let records: Array<StoredQuery | undefined> = [];
		try {
			records = await getMany(recentKeys, getStore());
		} catch (error) {
			report(error, "restore");
		}
		const queries: DehydratedQuery[] = [];
		for (const record of records) {
			if (!record || isExpired(record)) continue;
			entries.set(record.queryHash, {
				dataUpdatedAt: record.state.dataUpdatedAt,
				size: record.size,
			});
			queries.push(toQuery(record));
		}
		return { index: recent, queries };
	};

	const readRecent = async () => (await openDisk()).queries;

	const readEverything = async (
		deliver: (queries: DehydratedQuery[]) => void,
	): Promise<ReadDiskIndex> => {
		if (disk.coverage !== "unread") return readRest(disk, deliver);
		const { index, queries } = await openDisk();
		if (queries.length > 0) deliver(queries);
		return readRest(index, deliver);
	};

	const isPersistable = (query: DehydratedQuery) =>
		query.state.status === "success" &&
		query.state.data != null &&
		(shouldPersistQuery ? shouldPersistQuery(query) : true);

	const writeEntries = async (
		entries: Map<string, IndexEntry>,
		records: [string, StoredQuery][],
	) => {
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
				entries.delete(key);
				skipped.set(key, record.state.dataUpdatedAt);
			}
		}
	};

	const writeRecentKeys = async (entries: Map<string, IndexEntry>) => {
		const recentKeys: string[] = [];
		let bytes = 0;
		for (const [queryHash, entry] of newestFirst(entries)) {
			bytes += entry.size;
			if (bytes > recentBytes) break;
			recentKeys.push(queryHash);
		}
		if (
			recentKeys.length === writtenRecentKeys.length &&
			recentKeys.every((key, position) => key === writtenRecentKeys[position])
		) {
			return;
		}
		try {
			await set(RECENT_KEY, recentKeys, getStore());
			writtenRecentKeys = recentKeys;
		} catch (error) {
			report(error, "writeRecent");
		}
	};

	const persist = async (queries: DehydratedQuery[]) => {
		const current =
			disk.coverage === "unread" ? await readEverything(() => undefined) : disk;
		const { entries } = current;
		const writes: [string, StoredQuery][] = [];
		const deletes: string[] = [];

		for (const query of queries) {
			if (!isPersistable(query)) continue;
			const { queryHash } = query;
			const { dataUpdatedAt } = query.state;
			const onDisk = entries.get(queryHash);
			if (onDisk && onDisk.dataUpdatedAt === dataUpdatedAt) continue;
			if (skipped.get(queryHash) === dataUpdatedAt) continue;

			const size = estimateQueryDataSize(query.state.data);
			if (size > maxEntryBytes) {
				skipped.set(queryHash, dataUpdatedAt);
				if (onDisk) {
					entries.delete(queryHash);
					deletes.push(queryHash);
				}
				continue;
			}

			skipped.delete(queryHash);
			const { promise: _promise, ...rest } = query;
			writes.push([queryHash, { ...rest, size }]);
			entries.set(queryHash, { dataUpdatedAt, size });
		}

		// Least-recently-updated eviction down to the budget, once every record
		// on disk is counted.
		if (current.coverage === "complete") {
			let total = 0;
			for (const entry of entries.values()) total += entry.size;
			for (const [queryHash, entry] of newestFirst(entries).reverse()) {
				if (total <= maxBytes) break;
				total -= entry.size;
				entries.delete(queryHash);
				skipped.set(queryHash, entry.dataUpdatedAt);
				deletes.push(queryHash);
			}
		}

		const evicted = new Set(deletes);
		const finalWrites = writes.filter(([key]) => !evicted.has(key));

		if (!current.hasMeta) {
			try {
				await set(META_KEY, { buster } satisfies StoredMeta, getStore());
				current.hasMeta = true;
			} catch (error) {
				report(error, "writeMeta");
				// Nothing was written: read the database again next time.
				disk = { coverage: "unread" };
				return;
			}
		}
		await writeEntries(entries, finalWrites);
		if (deletes.length > 0) {
			try {
				await delMany(deletes, getStore());
			} catch (error) {
				report(error, "delMany");
			}
		}
		await writeRecentKeys(entries);
	};

	return {
		persist: (queries) => enqueue(() => persist(queries)).then(() => undefined),
		restoreRecent: () => enqueue(readRecent).then((queries) => queries ?? []),
		restoreRest: (deliver) =>
			enqueue(() => readEverything(deliver)).then(() => undefined),
		clear: () => enqueue(wipe).then(() => undefined),
		getStoredBytes: () => {
			if (disk.coverage === "unread") return 0;
			let total = 0;
			for (const entry of disk.entries.values()) total += entry.size;
			return total;
		},
	};
}
