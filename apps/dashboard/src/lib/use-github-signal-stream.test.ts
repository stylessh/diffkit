import { describe, expect, it } from "vitest";
import {
	getGitHubDataFetchedAt,
	getGitHubSignalComparisonTimestamp,
} from "./use-github-signal-stream";

describe("use-github-signal-stream helpers", () => {
	it("prefers the cached GitHub fetchedAt over React Query dataUpdatedAt", () => {
		expect(
			getGitHubSignalComparisonTimestamp({
				data: {
					__meta: {
						cacheStatus: "stale",
						fetchedAt: 1_000,
						isRevalidating: true,
					},
				},
				dataUpdatedAt: 9_000,
			}),
		).toBe(1_000);
	});

	it("falls back to React Query dataUpdatedAt when local-first meta is absent", () => {
		expect(
			getGitHubSignalComparisonTimestamp({
				data: { value: true },
				dataUpdatedAt: 9_000,
			}),
		).toBe(9_000);
	});

	it("returns null when the query has never been populated", () => {
		expect(
			getGitHubSignalComparisonTimestamp({
				data: null,
				dataUpdatedAt: 0,
			}),
		).toBeNull();
	});

	it("ignores malformed local-first meta", () => {
		expect(
			getGitHubDataFetchedAt({ __meta: { fetchedAt: "oops" } }),
		).toBeNull();
	});
});
