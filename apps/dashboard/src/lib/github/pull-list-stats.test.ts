import { describe, expect, it } from "vitest";
import type { PullSummary } from "../github.types";
import { applyPullListStats } from "./pull-list-stats";

function pull(number: number): PullSummary {
	return {
		id: number,
		number,
		title: `PR ${number}`,
		state: "open",
		isDraft: false,
		createdAt: "2026-11-01T00:00:00Z",
		updatedAt: "2026-11-01T00:00:00Z",
		closedAt: null,
		mergedAt: null,
		comments: 0,
		url: `https://github.com/acme/app/pull/${number}`,
		author: null,
		labels: [],
		repository: {
			owner: "acme",
			name: "app",
			fullName: "acme/app",
			url: "https://github.com/acme/app",
			isPrivate: false,
		},
	};
}

describe("applyPullListStats", () => {
	it("fills line counts and comment totals from the GraphQL page", () => {
		const [enriched] = applyPullListStats([pull(62815)], {
			repository: {
				p62815: {
					number: 62815,
					additions: 120,
					deletions: 8,
					comments: { totalCount: 4 },
				},
			},
		});

		expect(enriched).toMatchObject({
			additions: 120,
			deletions: 8,
			comments: 4,
		});
	});

	it("leaves a pull untouched when GraphQL could not resolve it", () => {
		const original = pull(7);
		const [result] = applyPullListStats([original], {
			repository: { p7: null },
		});

		expect(result).toBe(original);
	});
});
