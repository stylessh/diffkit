import { describe, expect, it, vi } from "vitest";
import { readRepositoryStars } from "./repository-stars.server";

const HOUR_MS = 60 * 60 * 1000;

function createStarsHarness() {
	const store = new Map<string, string>();
	const kv = {
		get: async (key: string) => JSON.parse(store.get(key) ?? "null"),
		put: async (key: string, value: string) => {
			store.set(key, value);
		},
	} as unknown as KVNamespace;
	const deferred: Promise<unknown>[] = [];
	const fetchCount = vi.fn<() => Promise<number | null>>();
	const read = (now: number) =>
		readRepositoryStars({
			kv,
			fetchCount,
			defer: (work) => deferred.push(work),
			now,
		});
	return { read, fetchCount, settle: () => Promise.all(deferred) };
}

describe("repository stars", () => {
	it("answers from the cache and asks GitHub at most once an hour, even while GitHub is failing", async () => {
		const { read, fetchCount, settle } = createStarsHarness();
		fetchCount.mockResolvedValueOnce(173);

		expect(await read(0)).toBeNull();
		await settle();
		expect(await read(1)).toBe(173);
		expect(fetchCount).toHaveBeenCalledTimes(1);

		fetchCount.mockRejectedValueOnce(new Error("rate limited"));
		expect(await read(HOUR_MS)).toBe(173);
		await settle();
		expect(await read(HOUR_MS + 1)).toBe(173);
		expect(fetchCount).toHaveBeenCalledTimes(2);

		fetchCount.mockResolvedValueOnce(180);
		expect(await read(2 * HOUR_MS)).toBe(173);
		await settle();
		expect(await read(2 * HOUR_MS + 1)).toBe(180);
	});
});
