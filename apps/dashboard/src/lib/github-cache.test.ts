import { describe, expect, it, vi } from "vitest";
import {
	bumpGitHubCacheNamespaces,
	bustGitHubCache,
	createGitHubResponseMetadata,
	type GitHubFetchResult,
	getOrRevalidateGitHubResource,
	markGitHubRevalidationSignals,
} from "./github-cache";

const metadata = createGitHubResponseMetadata(200, {
	etag: '"abc"',
	"last-modified": "Sat, 07 Nov 2026 00:00:00 GMT",
	"x-ratelimit-remaining": "4999",
	"x-ratelimit-reset": "1794110000",
});

function success<T>(data: T): GitHubFetchResult<T> {
	return { kind: "success", data, metadata };
}

describe("createGitHubResponseMetadata", () => {
	it("parses GitHub response headers", () => {
		expect(metadata).toEqual({
			etag: '"abc"',
			lastModified: "Sat, 07 Nov 2026 00:00:00 GMT",
			rateLimitRemaining: 4999,
			rateLimitReset: 1794110000,
			statusCode: 200,
		});
	});

	it("treats missing or invalid rate-limit headers as null", () => {
		expect(
			createGitHubResponseMetadata(200, { "x-ratelimit-remaining": "nope" }),
		).toMatchObject({
			etag: null,
			lastModified: null,
			rateLimitRemaining: null,
			rateLimitReset: null,
		});
	});
});

describe("getOrRevalidateGitHubResource", () => {
	it("fetches from GitHub on every call without conditional headers", async () => {
		const fetcher = vi.fn(async () => success({ value: 1 }));
		const options = {
			userId: "user-1",
			resource: "pulls.mine",
			params: { page: 1 },
			freshForMs: 60_000,
			signalKeys: ["pulls.mine"],
			fetcher,
		};

		await expect(
			getOrRevalidateGitHubResource({ ...options, inFlightCache: new Map() }),
		).resolves.toEqual({ value: 1 });
		await expect(
			getOrRevalidateGitHubResource({ ...options, inFlightCache: new Map() }),
		).resolves.toEqual({ value: 1 });

		expect(fetcher).toHaveBeenCalledTimes(2);
		expect(fetcher).toHaveBeenCalledWith({ etag: null, lastModified: null });
	});

	it("shares one in-flight call for identical reads in the same request", async () => {
		let resolveFetch: (value: GitHubFetchResult<string>) => void = () => {};
		const fetcher = vi.fn(
			() =>
				new Promise<GitHubFetchResult<string>>((resolve) => {
					resolveFetch = resolve;
				}),
		);
		const inFlightCache = new Map<string, Promise<unknown>>();
		const read = (params: unknown) =>
			getOrRevalidateGitHubResource({
				userId: "user-1",
				resource: "repo.meta",
				params,
				fetcher,
				inFlightCache,
			});

		const first = read({ owner: "a", repo: "b" });
		const second = read({ repo: "b", owner: "a" });
		await Promise.resolve();
		resolveFetch(success("data"));

		await expect(Promise.all([first, second])).resolves.toEqual([
			"data",
			"data",
		]);
		expect(fetcher).toHaveBeenCalledTimes(1);
		expect(inFlightCache.size).toBe(0);
	});

	it("does not share calls across users", async () => {
		const fetcher = vi.fn(async () => success("data"));
		const inFlightCache = new Map<string, Promise<unknown>>();

		await Promise.all([
			getOrRevalidateGitHubResource({
				userId: "user-1",
				resource: "viewer",
				fetcher,
				inFlightCache,
			}),
			getOrRevalidateGitHubResource({
				userId: "user-2",
				resource: "viewer",
				fetcher,
				inFlightCache,
			}),
		]);

		expect(fetcher).toHaveBeenCalledTimes(2);
	});

	it("propagates fetch errors and clears the in-flight entry", async () => {
		const inFlightCache = new Map<string, Promise<unknown>>();
		const fetcher = vi.fn(async () => {
			throw new Error("boom");
		});

		await expect(
			getOrRevalidateGitHubResource({
				userId: "user-1",
				resource: "viewer",
				fetcher,
				inFlightCache,
			}),
		).rejects.toThrow("boom");
		expect(inFlightCache.size).toBe(0);
	});

	it("rejects an unexpected 304", async () => {
		await expect(
			getOrRevalidateGitHubResource({
				userId: "user-1",
				resource: "viewer",
				inFlightCache: new Map(),
				fetcher: async () => ({ kind: "not-modified", metadata }),
			}),
		).rejects.toThrow(/304/);
	});
});

describe("legacy invalidation helpers", () => {
	it("are no-ops that never touch storage", async () => {
		await expect(
			bustGitHubCache("user-1", "pulls.mine", null),
		).resolves.toBeUndefined();
		await expect(
			bumpGitHubCacheNamespaces(["pulls.mine"]),
		).resolves.toBeUndefined();
		await expect(markGitHubRevalidationSignals(["pulls.mine"])).resolves.toBe(
			0,
		);
	});
});
