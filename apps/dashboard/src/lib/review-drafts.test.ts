import { describe, expect, it } from "vitest";
import type { PullSummary } from "./github.types";
import {
	buildPendingReviewsQuery,
	chunkReviewDraftCandidates,
	formatReviewDraftLocation,
	type GraphQLPendingReviewPull,
	type GraphQLPendingReviewsResponse,
	normalizeReviewDrafts,
	reviewDraftBodyPreview,
	selectReviewDraftCandidates,
	sortReviewDrafts,
} from "./review-drafts";

function summary(
	number: number,
	fullName = "acme/app",
	state = "open",
): PullSummary {
	const [owner = "", name = ""] = fullName.split("/");
	return {
		id: number,
		number,
		title: `PR ${number}`,
		state,
		isDraft: false,
		createdAt: "2026-01-01T00:00:00Z",
		updatedAt: "2026-01-01T00:00:00Z",
		closedAt: null,
		mergedAt: null,
		comments: 0,
		url: `https://github.com/${fullName}/pull/${number}`,
		author: null,
		labels: [],
		repository: {
			name,
			owner,
			fullName,
			url: `https://github.com/${fullName}`,
			isPrivate: null,
		},
	};
}

const emptyBuckets = {
	reviewRequested: [],
	involved: [],
	mentioned: [],
	assigned: [],
	authored: [],
};

describe("selectReviewDraftCandidates", () => {
	it("dedupes across buckets and prefers review-requested PRs", () => {
		const { candidates, total } = selectReviewDraftCandidates({
			...emptyBuckets,
			authored: [summary(1), summary(2)],
			reviewRequested: [summary(2), summary(3)],
			involved: [summary(3), summary(2, "Acme/App")],
		});
		expect(candidates.map((c) => c.number)).toEqual([2, 3, 1]);
		expect(total).toBe(3);
	});

	it("keeps same numbers from different repositories apart", () => {
		const { candidates } = selectReviewDraftCandidates({
			...emptyBuckets,
			reviewRequested: [summary(1, "acme/app"), summary(1, "acme/web")],
		});
		expect(candidates).toEqual([
			{ owner: "acme", repo: "app", number: 1 },
			{ owner: "acme", repo: "web", number: 1 },
		]);
	});

	it("skips non-open PRs and enforces the limit", () => {
		const { candidates, total } = selectReviewDraftCandidates(
			{
				...emptyBuckets,
				reviewRequested: [
					summary(1, "acme/app", "closed"),
					summary(2),
					summary(3),
					summary(4),
				],
			},
			2,
		);
		expect(candidates.map((c) => c.number)).toEqual([2, 3]);
		expect(total).toBe(3);
	});
});

describe("chunkReviewDraftCandidates", () => {
	it("splits into batches of the requested size", () => {
		expect(chunkReviewDraftCandidates([1, 2, 3, 4, 5], 2)).toEqual([
			[1, 2],
			[3, 4],
			[5],
		]);
		expect(chunkReviewDraftCandidates([], 2)).toEqual([]);
	});
});

describe("buildPendingReviewsQuery", () => {
	it("aliases each candidate and binds every value as a variable", () => {
		const { query, variables } = buildPendingReviewsQuery(
			[
				{ owner: "acme", repo: "app", number: 7 },
				{ owner: "acme", repo: "web", number: 9 },
			],
			"octocat",
		);
		expect(query).toContain("p0: repository(owner: $o0, name: $r0)");
		expect(query).toContain("p1: repository(owner: $o1, name: $r1)");
		expect(query).toContain(
			"reviews(first: 1, states: PENDING, author: $login)",
		);
		expect(query).not.toContain("acme");
		expect(variables).toEqual({
			login: "octocat",
			o0: "acme",
			r0: "app",
			n0: 7,
			o1: "acme",
			r1: "web",
			n1: 9,
		});
	});
});

function pendingPull(
	overrides: Partial<GraphQLPendingReviewPull> = {},
): GraphQLPendingReviewPull {
	return {
		number: 7,
		title: "Add widget",
		url: "https://github.com/acme/app/pull/7",
		isDraft: false,
		updatedAt: "2026-03-01T00:00:00Z",
		author: {
			__typename: "User",
			login: "hubot",
			avatarUrl: "https://example.com/a.png",
			url: "https://github.com/hubot",
		},
		reviews: {
			nodes: [
				{
					id: "PRR_1",
					databaseId: 111,
					body: "",
					url: "https://github.com/acme/app/pull/7#pullrequestreview-111",
					createdAt: "2026-03-02T00:00:00Z",
					updatedAt: "2026-03-03T00:00:00Z",
					comments: {
						totalCount: 2,
						nodes: [
							{
								id: "C1",
								path: "src/a.ts",
								line: 12,
								startLine: 8,
								subjectType: "LINE",
								outdated: false,
								body: "Nit",
								createdAt: "2026-03-02T00:00:00Z",
								updatedAt: "2026-03-02T00:00:00Z",
							},
							{
								id: "C2",
								path: "README.md",
								line: null,
								startLine: null,
								subjectType: "FILE",
								outdated: false,
								body: "Whole file",
								createdAt: "2026-03-02T00:00:00Z",
								updatedAt: "2026-03-02T00:00:00Z",
							},
						],
					},
				},
			],
		},
		...overrides,
	};
}

const candidate = { owner: "acme", repo: "app", number: 7 };

describe("normalizeReviewDrafts", () => {
	it("maps a pending review with its comments", () => {
		const [draft] = normalizeReviewDrafts(
			{ p0: { pullRequest: pendingPull() } },
			[candidate],
		);
		expect(draft).toMatchObject({
			owner: "acme",
			repo: "app",
			repositoryFullName: "acme/app",
			number: 7,
			title: "Add widget",
			author: { login: "hubot", type: "User" },
		});
		expect(draft?.review).toMatchObject({
			reviewId: 111,
			nodeId: "PRR_1",
			commentCount: 2,
		});
		expect(
			draft?.review.comments.map((c) => [c.path, c.isFileComment]),
		).toEqual([
			["src/a.ts", false],
			["README.md", true],
		]);
	});

	it("returns nothing for missing, inaccessible, or review-less PRs", () => {
		expect(normalizeReviewDrafts(null, [candidate])).toEqual([]);
		expect(normalizeReviewDrafts({}, [candidate])).toEqual([]);
		const response: GraphQLPendingReviewsResponse = {
			p0: null,
			p1: { pullRequest: null },
			p2: { pullRequest: pendingPull({ reviews: { nodes: [] } }) },
			p3: { pullRequest: pendingPull({ reviews: null }) },
		};
		expect(
			normalizeReviewDrafts(response, [
				candidate,
				candidate,
				candidate,
				candidate,
			]),
		).toEqual([]);
	});

	it("drops empty pending reviews but keeps body-only ones", () => {
		const base = pendingPull();
		const review = base.reviews?.nodes?.[0];
		if (!review) throw new Error("fixture");
		const empty = pendingPull({
			reviews: {
				nodes: [{ ...review, comments: { totalCount: 0, nodes: [] } }],
			},
		});
		const bodyOnly = pendingPull({
			reviews: {
				nodes: [
					{
						...review,
						body: "Overall looks good",
						comments: { totalCount: 0, nodes: [] },
					},
				],
			},
		});
		const result = normalizeReviewDrafts(
			{ p0: { pullRequest: empty }, p1: { pullRequest: bodyOnly } },
			[candidate, { ...candidate, number: 8 }],
		);
		expect(result).toHaveLength(1);
		expect(result[0]?.review.body).toBe("Overall looks good");
	});

	it("reports the GitHub total when comments are truncated", () => {
		const base = pendingPull();
		const review = base.reviews?.nodes?.[0];
		if (!review?.comments) throw new Error("fixture");
		const truncated = pendingPull({
			reviews: {
				nodes: [
					{ ...review, comments: { ...review.comments, totalCount: 140 } },
				],
			},
		});
		const [draft] = normalizeReviewDrafts({ p0: { pullRequest: truncated } }, [
			candidate,
		]);
		expect(draft?.review.commentCount).toBe(140);
		expect(draft?.review.comments).toHaveLength(2);
	});
});

describe("sortReviewDrafts", () => {
	it("orders by most recently edited review", () => {
		const make = (number: number, updatedAt: string) => {
			const pull = pendingPull({ number });
			const review = pull.reviews?.nodes?.[0];
			if (review) review.updatedAt = updatedAt;
			return normalizeReviewDrafts({ p0: { pullRequest: pull } }, [
				{ ...candidate, number },
			])[0];
		};
		const drafts = [
			make(1, "2026-01-01T00:00:00Z"),
			make(2, "2026-03-01T00:00:00Z"),
			make(3, "2026-02-01T00:00:00Z"),
		].filter((d): d is NonNullable<typeof d> => Boolean(d));
		expect(sortReviewDrafts(drafts).map((d) => d.number)).toEqual([2, 3, 1]);
	});
});

describe("display helpers", () => {
	it("previews markdown bodies on one line", () => {
		expect(
			reviewDraftBodyPreview("Line one\n\n```ts\nconst a = 1;\n```\nTwo"),
		).toBe("Line one [code] Two");
		expect(reviewDraftBodyPreview("x".repeat(300), 20)).toHaveLength(20);
	});

	it("formats comment locations", () => {
		const base = { isFileComment: false, outdated: false };
		expect(
			formatReviewDraftLocation({ ...base, line: 5, startLine: null }),
		).toBe("L5");
		expect(formatReviewDraftLocation({ ...base, line: 12, startLine: 8 })).toBe(
			"L8–12",
		);
		expect(
			formatReviewDraftLocation({
				...base,
				isFileComment: true,
				line: null,
				startLine: null,
			}),
		).toBe("File");
		expect(
			formatReviewDraftLocation({
				...base,
				outdated: true,
				line: null,
				startLine: null,
			}),
		).toBe("Outdated");
	});
});
