/**
 * Pure helpers for the Review Drafts page: pick which PRs to probe, build the
 * batched GraphQL query, and normalize the response. Kept free of server
 * imports so it can be unit tested.
 */
import type {
	GitHubActor,
	MyPullsResult,
	PullSummary,
	ReviewDraftComment,
	ReviewDraftPull,
} from "./github.types";

/** Open PRs probed per page load (2 GraphQL batches). */
export const REVIEW_DRAFT_CANDIDATE_LIMIT = 50;
/** PRs per GraphQL request; keeps node cost and response size modest. */
export const REVIEW_DRAFT_BATCH_SIZE = 25;
/** Draft comments requested per pending review. */
export const REVIEW_DRAFT_COMMENT_LIMIT = 100;

export type ReviewDraftCandidate = {
	owner: string;
	repo: string;
	number: number;
};

export function selectReviewDraftCandidates(
	result: Pick<
		MyPullsResult,
		"reviewRequested" | "involved" | "mentioned" | "assigned" | "authored"
	>,
	limit = REVIEW_DRAFT_CANDIDATE_LIMIT,
): { candidates: ReviewDraftCandidate[]; total: number } {
	// Ordered by how likely the viewer is to be mid-review on the PR.
	const buckets: PullSummary[][] = [
		result.reviewRequested,
		result.involved,
		result.mentioned,
		result.assigned,
		result.authored,
	];
	const seen = new Set<string>();
	const all: ReviewDraftCandidate[] = [];
	for (const bucket of buckets) {
		for (const pull of bucket) {
			if (pull.state.trim().toLowerCase() !== "open") continue;
			const key = `${pull.repository.fullName.toLowerCase()}#${pull.number}`;
			if (seen.has(key)) continue;
			seen.add(key);
			all.push({
				owner: pull.repository.owner,
				repo: pull.repository.name,
				number: pull.number,
			});
		}
	}
	return { candidates: all.slice(0, limit), total: all.length };
}

export function chunkReviewDraftCandidates<T>(
	items: readonly T[],
	size = REVIEW_DRAFT_BATCH_SIZE,
): T[][] {
	const chunks: T[][] = [];
	for (let i = 0; i < items.length; i += size) {
		chunks.push(items.slice(i, i + size));
	}
	return chunks;
}

export function reviewDraftAlias(index: number) {
	return `p${index}`;
}

export function buildPendingReviewsQuery(
	candidates: readonly ReviewDraftCandidate[],
	login: string,
): { query: string; variables: Record<string, string | number> } {
	const variableDefinitions = ["$login: String!"];
	const selections: string[] = [];
	const variables: Record<string, string | number> = { login };

	candidates.forEach((candidate, index) => {
		variableDefinitions.push(
			`$o${index}: String!`,
			`$r${index}: String!`,
			`$n${index}: Int!`,
		);
		variables[`o${index}`] = candidate.owner;
		variables[`r${index}`] = candidate.repo;
		variables[`n${index}`] = candidate.number;
		selections.push(
			`${reviewDraftAlias(index)}: repository(owner: $o${index}, name: $r${index}) {
				pullRequest(number: $n${index}) { ...PendingReviewPull }
			}`,
		);
	});

	const query = `query PendingReviewDrafts(${variableDefinitions.join(", ")}) {
		${selections.join("\n")}
		rateLimit { cost remaining resetAt }
	}
	fragment PendingReviewPull on PullRequest {
		number
		title
		url
		isDraft
		updatedAt
		author { __typename login avatarUrl url }
		reviews(first: 1, states: PENDING, author: $login) {
			nodes {
				id
				databaseId
				body
				url
				createdAt
				updatedAt
				comments(first: ${REVIEW_DRAFT_COMMENT_LIMIT}) {
					totalCount
					nodes {
						id
						path
						line
						startLine
						subjectType
						outdated
						body
						createdAt
						updatedAt
					}
				}
			}
		}
	}`;

	return { query, variables };
}

type GraphQLPendingComment = {
	id: string;
	path: string;
	line: number | null;
	startLine: number | null;
	subjectType?: string | null;
	outdated?: boolean | null;
	body: string;
	createdAt: string;
	updatedAt: string;
};

type GraphQLPendingReview = {
	id: string;
	databaseId: number | null;
	body: string;
	url: string;
	createdAt: string;
	updatedAt: string;
	comments: {
		totalCount: number;
		nodes: Array<GraphQLPendingComment | null> | null;
	} | null;
};

export type GraphQLPendingReviewPull = {
	number: number;
	title: string;
	url: string;
	isDraft: boolean;
	updatedAt: string;
	author: {
		__typename?: string;
		login: string;
		avatarUrl: string;
		url: string;
	} | null;
	reviews: { nodes: Array<GraphQLPendingReview | null> | null } | null;
};

/** Response keyed by alias (`p0`, `p1`, …); entries are null when inaccessible. */
export type GraphQLPendingReviewsResponse = Record<
	string,
	{ pullRequest: GraphQLPendingReviewPull | null } | null | undefined
>;

function mapActor(
	author: GraphQLPendingReviewPull["author"],
): GitHubActor | null {
	if (!author) return null;
	return {
		login: author.login,
		avatarUrl: author.avatarUrl,
		url: author.url,
		type: author.__typename ?? "User",
	};
}

function mapComment(node: GraphQLPendingComment): ReviewDraftComment {
	return {
		id: node.id,
		path: node.path,
		line: node.line ?? null,
		startLine: node.startLine ?? null,
		isFileComment: node.subjectType === "FILE",
		outdated: Boolean(node.outdated),
		body: node.body,
		createdAt: node.createdAt,
		updatedAt: node.updatedAt,
	};
}

/**
 * Turn one batch response into drafts. A pending review with neither comments
 * nor a body has nothing to submit and is dropped.
 */
export function normalizeReviewDrafts(
	response: GraphQLPendingReviewsResponse | null | undefined,
	candidates: readonly ReviewDraftCandidate[],
): ReviewDraftPull[] {
	if (!response) return [];
	const drafts: ReviewDraftPull[] = [];

	candidates.forEach((candidate, index) => {
		const pull = response[reviewDraftAlias(index)]?.pullRequest;
		const review = pull?.reviews?.nodes?.find(
			(node): node is GraphQLPendingReview =>
				Boolean(node) && typeof node?.databaseId === "number",
		);
		if (!pull || !review || review.databaseId == null) return;

		const comments = (review.comments?.nodes ?? [])
			.filter((node): node is GraphQLPendingComment => Boolean(node))
			.map(mapComment);
		const commentCount = Math.max(
			review.comments?.totalCount ?? 0,
			comments.length,
		);
		if (commentCount === 0 && review.body.trim() === "") return;

		drafts.push({
			owner: candidate.owner,
			repo: candidate.repo,
			repositoryFullName: `${candidate.owner}/${candidate.repo}`,
			number: pull.number,
			title: pull.title,
			url: pull.url,
			isDraft: pull.isDraft,
			author: mapActor(pull.author),
			updatedAt: pull.updatedAt,
			review: {
				reviewId: review.databaseId,
				nodeId: review.id,
				body: review.body,
				url: review.url,
				createdAt: review.createdAt,
				updatedAt: review.updatedAt,
				commentCount,
				comments,
			},
		});
	});

	return drafts;
}

export function sortReviewDrafts(drafts: readonly ReviewDraftPull[]) {
	return [...drafts].sort(
		(a, b) =>
			Date.parse(b.review.updatedAt) - Date.parse(a.review.updatedAt) ||
			a.repositoryFullName.localeCompare(b.repositoryFullName) ||
			a.number - b.number,
	);
}

/** One-line plain-text preview of a markdown comment body. */
export function reviewDraftBodyPreview(body: string, maxLength = 160) {
	const text = body
		.replace(/```[\s\S]*?```/g, " [code] ")
		.replace(/\s+/g, " ")
		.trim();
	if (text.length <= maxLength) return text;
	return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

/** "L12", "L8–12", "File", or "Outdated" for display next to a comment's path. */
export function formatReviewDraftLocation(
	comment: Pick<
		ReviewDraftComment,
		"line" | "startLine" | "isFileComment" | "outdated"
	>,
) {
	if (comment.isFileComment) return "File";
	if (comment.line == null) return comment.outdated ? "Outdated" : "File";
	if (comment.startLine != null && comment.startLine !== comment.line) {
		return `L${comment.startLine}–${comment.line}`;
	}
	return `L${comment.line}`;
}
