import { describe, expect, it, vi } from "vitest";
import { dedupeGitHubRead } from "./request-dedup";

describe("dedupeGitHubRead", () => {
	it("calls GitHub again once the previous read has settled", async () => {
		const fetcher = vi.fn(async () => ({ value: 1 }));
		const inFlightReads = new Map<string, Promise<unknown>>();
		const read = () =>
			dedupeGitHubRead({
				userId: "user-1",
				resource: "pulls.mine",
				params: { page: 1 },
				fetcher,
				inFlightReads,
			});

		await expect(read()).resolves.toEqual({ value: 1 });
		await expect(read()).resolves.toEqual({ value: 1 });
		expect(fetcher).toHaveBeenCalledTimes(2);
	});

	it("shares one in-flight call for identical reads, regardless of param key order", async () => {
		let resolveFetch: (value: string) => void = () => {};
		const fetcher = vi.fn(
			() =>
				new Promise<string>((resolve) => {
					resolveFetch = resolve;
				}),
		);
		const inFlightReads = new Map<string, Promise<unknown>>();
		const read = (params: unknown) =>
			dedupeGitHubRead({
				userId: "user-1",
				resource: "repo.meta",
				params,
				fetcher,
				inFlightReads,
			});

		const first = read({ owner: "a", repo: "b" });
		const second = read({ repo: "b", owner: "a" });
		await Promise.resolve();
		resolveFetch("data");

		await expect(Promise.all([first, second])).resolves.toEqual([
			"data",
			"data",
		]);
		expect(fetcher).toHaveBeenCalledTimes(1);
		expect(inFlightReads.size).toBe(0);
	});

	it("does not share calls across users", async () => {
		const fetcher = vi.fn(async () => "data");
		const inFlightReads = new Map<string, Promise<unknown>>();

		await Promise.all(
			["user-1", "user-2"].map((userId) =>
				dedupeGitHubRead({
					userId,
					resource: "viewer",
					fetcher,
					inFlightReads,
				}),
			),
		);

		expect(fetcher).toHaveBeenCalledTimes(2);
	});

	it("propagates fetch errors and clears the in-flight entry", async () => {
		const inFlightReads = new Map<string, Promise<unknown>>();

		await expect(
			dedupeGitHubRead({
				userId: "user-1",
				resource: "viewer",
				fetcher: async () => {
					throw new Error("boom");
				},
				inFlightReads,
			}),
		).rejects.toThrow("boom");
		expect(inFlightReads.size).toBe(0);
	});
});
