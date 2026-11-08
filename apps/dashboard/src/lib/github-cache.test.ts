import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	createGitHubResponseMetadata,
	type GitHubCacheStore,
	type GitHubCacheStoreEntry,
	type GitHubFetchResult,
	type GitHubPayloadCacheStore,
	getOrRevalidateGitHubResource,
	markGitHubRevalidationSignals,
} from "./github-cache";

vi.mock("@tanstack/react-start/server", () => ({
	getRequest: () => {
		throw new Error("Not in request context");
	},
}));

/**
 * Minimal D1 binding backed by node:sqlite so the real drizzle queries behind
 * `markGitHubRevalidationSignals` and the signal / namespace lookups run
 * against an actual SQLite database.
 */
function createSqliteD1() {
	const sqlite = new DatabaseSync(":memory:");
	sqlite.exec(`
		CREATE TABLE github_revalidation_signal (
			signal_key TEXT PRIMARY KEY,
			updated_at INTEGER NOT NULL
		);
		CREATE TABLE github_cache_namespace (
			namespace_key TEXT PRIMARY KEY,
			version INTEGER NOT NULL,
			updated_at INTEGER NOT NULL
		);
	`);

	type SqlValue = string | number | null;
	const createStatement = (query: string, params: SqlValue[] = []) => ({
		bind: (...values: SqlValue[]) => createStatement(query, values),
		async all() {
			const results = sqlite.prepare(query).all(...params);
			return { results, success: true, meta: {} };
		},
		async raw() {
			return sqlite
				.prepare(query)
				.all(...params)
				.map((row) => Object.values(row));
		},
		async run() {
			const result = sqlite.prepare(query).run(...params);
			return {
				results: [],
				success: true,
				meta: { changes: Number(result.changes) },
			};
		},
		async first() {
			return sqlite.prepare(query).get(...params) ?? null;
		},
	});

	return {
		prepare: (query: string) => createStatement(query),
		async batch(statements: Array<{ all(): Promise<unknown> }>) {
			return Promise.all(statements.map((statement) => statement.all()));
		},
	};
}

const workerEnv = vi.hoisted(() => ({ DB: null as unknown }));

vi.mock("cloudflare:workers", () => ({ env: workerEnv }));

function createMemoryStore(
	initialEntries: GitHubCacheStoreEntry[] = [],
): GitHubCacheStore {
	const entries = new Map(
		initialEntries.map((entry) => [entry.cacheKey, structuredClone(entry)]),
	);

	return {
		async get(cacheKey) {
			return entries.get(cacheKey) ?? null;
		},
		async upsert(entry) {
			entries.set(entry.cacheKey, structuredClone(entry));
		},
		async delete(cacheKey) {
			entries.delete(cacheKey);
		},
	};
}

function buildEntry(overrides: Partial<GitHubCacheStoreEntry> = {}) {
	return {
		cacheKey: "user-1::viewer::null",
		userId: "user-1",
		resource: "viewer",
		paramsJson: "null",
		etag: '"viewer-etag"',
		lastModified: "Tue, 01 Apr 2025 10:00:00 GMT",
		payloadJson: JSON.stringify({ login: "adn" }),
		fetchedAt: 100,
		freshUntil: 200,
		rateLimitRemaining: 4999,
		rateLimitReset: 1712487600,
		statusCode: 200,
		...overrides,
	};
}

describe("getOrRevalidateGitHubResource", () => {
	it("returns a fresh cached payload without calling GitHub", async () => {
		const store = createMemoryStore([buildEntry()]);
		const fetcher =
			vi.fn<
				(parameters: {
					etag?: string | null;
					lastModified?: string | null;
				}) => Promise<GitHubFetchResult<{ login: string }>>
			>();

		const result = await getOrRevalidateGitHubResource({
			userId: "user-1",
			resource: "viewer",
			freshForMs: 60_000,
			store,
			now: () => 150,
			fetcher,
		});

		expect(result).toEqual({ login: "adn" });
		expect(fetcher).not.toHaveBeenCalled();
	});

	it("revalidates stale data with conditional headers and preserves payload on 304", async () => {
		const store = createMemoryStore([
			buildEntry({
				freshUntil: 50,
			}),
		]);
		const fetcher = vi.fn<
			(parameters: {
				etag?: string | null;
				lastModified?: string | null;
			}) => Promise<GitHubFetchResult<{ login: string }>>
		>(async (conditionals) => {
			expect(conditionals).toEqual({
				etag: '"viewer-etag"',
				lastModified: "Tue, 01 Apr 2025 10:00:00 GMT",
			});

			return {
				kind: "not-modified",
				metadata: createGitHubResponseMetadata(304, {
					etag: '"viewer-etag"',
					"x-ratelimit-remaining": "4988",
					"x-ratelimit-reset": "1712487601",
				}),
			};
		});

		const result = await getOrRevalidateGitHubResource({
			userId: "user-1",
			resource: "viewer",
			freshForMs: 1_000,
			store,
			now: () => 500,
			fetcher,
		});

		expect(result).toEqual({ login: "adn" });
		expect(fetcher).toHaveBeenCalledTimes(1);

		const updatedEntry = await store.get("user-1::viewer::null");
		expect(updatedEntry?.freshUntil).toBe(1_500);
		expect(updatedEntry?.rateLimitRemaining).toBe(4988);
		expect(updatedEntry?.statusCode).toBe(304);
	});

	it("deduplicates concurrent stale refreshes for the same cache key", async () => {
		const inFlightCache = new Map<string, Promise<unknown>>();
		const store = createMemoryStore([
			buildEntry({
				resource: "pulls.mine.reviewRequested",
				cacheKey:
					'user-1::pulls.mine.reviewRequested::{"role":"review-requested"}',
				paramsJson: '{"role":"review-requested"}',
				freshUntil: 0,
				payloadJson: JSON.stringify([{ id: 1 }]),
			}),
		]);
		let resolveFetch:
			| ((value: GitHubFetchResult<Array<{ id: number }>>) => void)
			| undefined;
		const fetcher = vi.fn(
			() =>
				new Promise<GitHubFetchResult<Array<{ id: number }>>>((resolve) => {
					resolveFetch = resolve;
				}),
		);

		const promiseA = getOrRevalidateGitHubResource({
			inFlightCache,
			userId: "user-1",
			resource: "pulls.mine.reviewRequested",
			params: { role: "review-requested" },
			freshForMs: 1_000,
			store,
			now: () => 10,
			fetcher,
		});
		const promiseB = getOrRevalidateGitHubResource({
			inFlightCache,
			userId: "user-1",
			resource: "pulls.mine.reviewRequested",
			params: { role: "review-requested" },
			freshForMs: 1_000,
			store,
			now: () => 10,
			fetcher,
		});

		await vi.waitFor(() => {
			expect(fetcher).toHaveBeenCalledTimes(1);
		});

		resolveFetch?.({
			kind: "success",
			data: [{ id: 2 }],
			metadata: createGitHubResponseMetadata(200, {
				etag: '"next"',
			}),
		});

		await expect(Promise.all([promiseA, promiseB])).resolves.toEqual([
			[{ id: 2 }],
			[{ id: 2 }],
		]);
	});

	it("isolates cache entries by user even when the resource name matches", async () => {
		const store = createMemoryStore([
			buildEntry({
				userId: "user-1",
				cacheKey: "user-1::repos.list::null",
				resource: "repos.list",
				payloadJson: JSON.stringify([{ fullName: "owner/repo-a" }]),
			}),
			buildEntry({
				userId: "user-2",
				cacheKey: "user-2::repos.list::null",
				resource: "repos.list",
				payloadJson: JSON.stringify([{ fullName: "owner/repo-b" }]),
			}),
		]);

		await expect(
			getOrRevalidateGitHubResource({
				userId: "user-1",
				resource: "repos.list",
				freshForMs: 60_000,
				store,
				now: () => 150,
				fetcher: vi.fn(),
			}),
		).resolves.toEqual([{ fullName: "owner/repo-a" }]);

		await expect(
			getOrRevalidateGitHubResource({
				userId: "user-2",
				resource: "repos.list",
				freshForMs: 60_000,
				store,
				now: () => 150,
				fetcher: vi.fn(),
			}),
		).resolves.toEqual([{ fullName: "owner/repo-b" }]);
	});

	it("treats a newer revalidation signal as stale even before freshUntil expires", async () => {
		const store = createMemoryStore([
			buildEntry({
				resource: "pulls.detail.raw",
				cacheKey:
					'user-1::pulls.detail.raw::{"owner":"stylessh","repo":"havana","pullNumber":42}',
				paramsJson: '{"owner":"stylessh","repo":"havana","pullNumber":42}',
				payloadJson: JSON.stringify({ title: "Old title" }),
				fetchedAt: 1_000,
				freshUntil: 100_000,
			}),
		]);
		const fetcher = vi.fn<
			(parameters: {
				etag?: string | null;
				lastModified?: string | null;
			}) => Promise<GitHubFetchResult<{ title: string }>>
		>(async () => ({
			kind: "success",
			data: { title: "New title" },
			metadata: createGitHubResponseMetadata(200, {
				etag: '"next"',
			}),
		}));

		const result = await getOrRevalidateGitHubResource({
			userId: "user-1",
			resource: "pulls.detail.raw",
			params: { owner: "stylessh", repo: "havana", pullNumber: 42 },
			signalKeys: ["pull:stylessh/havana#42"],
			freshForMs: 60_000,
			store,
			now: () => 5_000,
			getLatestSignalUpdatedAt: async () => 4_000,
			fetcher,
		});

		expect(result).toEqual({ title: "New title" });
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it("returns a fresh split-cache payload from the payload store", async () => {
		const get = vi.fn(async () => buildEntry());
		const put = vi.fn(async () => undefined);
		const payloadStore = { get, put } satisfies GitHubPayloadCacheStore;
		const fetcher =
			vi.fn<
				(parameters: {
					etag?: string | null;
					lastModified?: string | null;
				}) => Promise<GitHubFetchResult<{ login: string }>>
			>();

		const result = await getOrRevalidateGitHubResource({
			userId: "user-1",
			resource: "viewer",
			freshForMs: 60_000,
			cacheMode: "split",
			namespaceKeys: ["viewer"],
			payloadStore,
			getNamespaceVersions: async () => ({ viewer: 3 }),
			now: () => 150,
			fetcher,
		});

		expect(result).toEqual({ login: "adn" });
		expect(fetcher).not.toHaveBeenCalled();
		expect(get).toHaveBeenCalledTimes(1);
	});

	it("hydrates the split payload store from a fresh legacy entry on KV miss", async () => {
		const store = createMemoryStore([buildEntry()]);
		const storedPayloadEntries = new Map<string, GitHubCacheStoreEntry>();
		const get = vi.fn(async () => null);
		const put = vi.fn(
			async (storageKey: string, entry: GitHubCacheStoreEntry) => {
				storedPayloadEntries.set(storageKey, structuredClone(entry));
			},
		);
		const payloadStore = { get, put } satisfies GitHubPayloadCacheStore;
		const fetcher =
			vi.fn<
				(parameters: {
					etag?: string | null;
					lastModified?: string | null;
				}) => Promise<GitHubFetchResult<{ login: string }>>
			>();

		const result = await getOrRevalidateGitHubResource({
			userId: "user-1",
			resource: "viewer",
			freshForMs: 60_000,
			cacheMode: "split",
			namespaceKeys: ["viewer"],
			store,
			payloadStore,
			getNamespaceVersions: async () => ({ viewer: 0 }),
			now: () => 150,
			fetcher,
		});

		expect(result).toEqual({ login: "adn" });
		expect(fetcher).not.toHaveBeenCalled();
		expect(get).toHaveBeenCalledTimes(1);
		expect(put).toHaveBeenCalledTimes(1);
		expect(storedPayloadEntries.size).toBe(1);
		expect(Array.from(storedPayloadEntries.values())).toEqual([buildEntry()]);
	});

	it("extends freshness when GitHub budget is low", async () => {
		const store = createMemoryStore([
			buildEntry({
				freshUntil: 50,
			}),
		]);
		const fetcher = vi.fn<
			(parameters: {
				etag?: string | null;
				lastModified?: string | null;
			}) => Promise<GitHubFetchResult<{ login: string }>>
		>(async () => ({
			kind: "success",
			data: { login: "adn" },
			metadata: createGitHubResponseMetadata(200, {
				etag: '"next"',
				"x-ratelimit-remaining": "10",
				"x-ratelimit-reset": "0",
			}),
		}));

		const result = await getOrRevalidateGitHubResource({
			userId: "user-1",
			resource: "viewer",
			freshForMs: 15_000,
			store,
			now: () => 500,
			fetcher,
		});

		expect(result).toEqual({ login: "adn" });

		const updatedEntry = await store.get("user-1::viewer::null");
		expect(updatedEntry?.freshUntil).toBe(90_500);
		expect(updatedEntry?.rateLimitRemaining).toBe(10);
	});

	it("serves stale cache when GitHub is rate limited", async () => {
		const store = createMemoryStore([
			buildEntry({
				freshUntil: 50,
			}),
		]);

		const result = await getOrRevalidateGitHubResource({
			userId: "user-1",
			resource: "viewer",
			freshForMs: 1_000,
			store,
			now: () => 500,
			fetcher: vi.fn(async () => {
				throw {
					status: 403,
					response: {
						headers: {
							"x-ratelimit-remaining": "0",
							"x-ratelimit-reset": "2",
						},
					},
				};
			}),
		});

		expect(result).toEqual({ login: "adn" });

		const updatedEntry = await store.get("user-1::viewer::null");
		expect(updatedEntry?.freshUntil).toBe(60_500);
		expect(updatedEntry?.statusCode).toBe(403);
	});
});

describe("webhook revalidation signals", () => {
	const pullSignalKey = "pull:stylessh/havana#42";
	const params = { owner: "stylessh", repo: "havana", pullNumber: 42 };
	// Cache keys use a key-sorted serialization of params.
	const paramsJson = '{"owner":"stylessh","pullNumber":42,"repo":"havana"}';

	beforeEach(() => {
		workerEnv.DB = createSqliteD1();
	});

	function createTitleFetcher(title: string) {
		return vi.fn<
			(parameters: {
				etag?: string | null;
				lastModified?: string | null;
			}) => Promise<GitHubFetchResult<{ title: string }>>
		>(async () => ({
			kind: "success",
			data: { title },
			metadata: createGitHubResponseMetadata(200, {}),
		}));
	}

	it("bypasses a still-fresh legacy entry once its signal is marked", async () => {
		const store = createMemoryStore([
			buildEntry({
				resource: "pulls.page",
				cacheKey: `user-1::pulls.page::${paramsJson}`,
				paramsJson,
				payloadJson: JSON.stringify({ title: "Old title" }),
				fetchedAt: 1_000,
				freshUntil: 1_000_000,
			}),
		]);
		const read = (fetcher: ReturnType<typeof createTitleFetcher>, at: number) =>
			getOrRevalidateGitHubResource({
				userId: "user-1",
				resource: "pulls.page",
				params,
				freshForMs: 60_000,
				signalKeys: [pullSignalKey],
				store,
				inFlightCache: new Map(),
				now: () => at,
				fetcher,
			});

		const beforeWebhook = createTitleFetcher("unused");
		await expect(read(beforeWebhook, 2_000)).resolves.toEqual({
			title: "Old title",
		});
		expect(beforeWebhook).not.toHaveBeenCalled();

		await markGitHubRevalidationSignals([pullSignalKey], 3_000);

		const afterWebhook = createTitleFetcher("New title");
		await expect(read(afterWebhook, 4_000)).resolves.toEqual({
			title: "New title",
		});
		expect(afterWebhook).toHaveBeenCalledTimes(1);

		// The refreshed entry is newer than the signal, so it is fresh again.
		const nextPoll = createTitleFetcher("unused");
		await expect(read(nextPoll, 5_000)).resolves.toEqual({
			title: "New title",
		});
		expect(nextPoll).not.toHaveBeenCalled();
	});

	it("bypasses a still-fresh split-cache entry once its signal is marked", async () => {
		const store = createMemoryStore();
		const payloadEntries = new Map<string, GitHubCacheStoreEntry>();
		const payloadStore = {
			async get(storageKey) {
				return payloadEntries.get(storageKey) ?? null;
			},
			async put(storageKey, entry) {
				payloadEntries.set(storageKey, structuredClone(entry));
			},
		} satisfies GitHubPayloadCacheStore;
		const read = (fetcher: ReturnType<typeof createTitleFetcher>, at: number) =>
			getOrRevalidateGitHubResource({
				userId: "user-1",
				resource: "pulls.page",
				params,
				freshForMs: 60_000,
				signalKeys: [pullSignalKey],
				namespaceKeys: [pullSignalKey],
				cacheMode: "split",
				store,
				payloadStore,
				inFlightCache: new Map(),
				now: () => at,
				fetcher,
			});

		const initial = createTitleFetcher("Old title");
		await expect(read(initial, 1_000)).resolves.toEqual({ title: "Old title" });
		expect(initial).toHaveBeenCalledTimes(1);

		const cached = createTitleFetcher("unused");
		await expect(read(cached, 2_000)).resolves.toEqual({ title: "Old title" });
		expect(cached).not.toHaveBeenCalled();

		await markGitHubRevalidationSignals([pullSignalKey], 3_000);

		const afterWebhook = createTitleFetcher("New title");
		await expect(read(afterWebhook, 4_000)).resolves.toEqual({
			title: "New title",
		});
		expect(afterWebhook).toHaveBeenCalledTimes(1);
	});
});
