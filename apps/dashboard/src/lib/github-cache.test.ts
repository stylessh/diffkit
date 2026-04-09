import { describe, expect, it, vi } from "vitest";
import {
	createGitHubResponseMetadata,
	type GitHubCacheStore,
	type GitHubCacheStoreEntry,
	type GitHubFetchResult,
	getOrRevalidateGitHubResource,
} from "./github-cache";

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

		await Promise.resolve();

		expect(fetcher).toHaveBeenCalledTimes(1);

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
});
