// @vitest-environment jsdom

import { dehydrate, QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { githubCachePolicy } from "./github-cache-policy";
import {
	createAppQueryClient,
	GITHUB_QUERY_CACHE_STORAGE_KEY,
} from "./query-client";

const queryKey = ["github", "user-1", "pulls", "mine"] as const;

function persistQuery(data: unknown, dataUpdatedAt: number) {
	const source = new QueryClient();
	source.setQueryData(queryKey, data, { updatedAt: dataUpdatedAt });
	localStorage.setItem(
		GITHUB_QUERY_CACHE_STORAGE_KEY,
		JSON.stringify({
			version: 1,
			persistedAt: Date.now(),
			clientState: dehydrate(source),
		}),
	);
	source.clear();
}

describe("createAppQueryClient persisted cache", () => {
	afterEach(() => {
		localStorage.clear();
	});

	it("renders restored data and refetches it in the background once stale", async () => {
		persistQuery(
			{ title: "Persisted" },
			Date.now() - githubCachePolicy.mine.staleTimeMs - 1_000,
		);
		const queryClient = createAppQueryClient();
		const queryFn = vi.fn(async () => ({ title: "Fresh" }));

		const observer = new QueryObserver(queryClient, {
			queryKey,
			queryFn,
			staleTime: githubCachePolicy.mine.staleTimeMs,
		});
		expect(observer.getCurrentResult().data).toEqual({ title: "Persisted" });
		expect(observer.getCurrentResult().isStale).toBe(true);

		const unsubscribe = observer.subscribe(() => undefined);
		await vi.waitFor(() => {
			expect(queryClient.getQueryData(queryKey)).toEqual({ title: "Fresh" });
		});
		expect(queryFn).toHaveBeenCalledTimes(1);

		unsubscribe();
		queryClient.clear();
	});

	it("does not refetch restored data that is still within its staleTime", () => {
		persistQuery({ title: "Persisted" }, Date.now());
		const queryClient = createAppQueryClient();
		const queryFn = vi.fn(async () => ({ title: "Fresh" }));

		const observer = new QueryObserver(queryClient, {
			queryKey,
			queryFn,
			staleTime: githubCachePolicy.mine.staleTimeMs,
		});
		const unsubscribe = observer.subscribe(() => undefined);

		expect(observer.getCurrentResult().isStale).toBe(false);
		expect(queryFn).not.toHaveBeenCalled();

		unsubscribe();
		queryClient.clear();
	});
});
