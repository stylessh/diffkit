import type { GitHubQueryScope } from "./github.query";

export type CommentKind = "issue" | "review";

/** A posted comment: conversation comments are `issue`, diff comments `review`. */
export type CommentTarget = {
	kind: CommentKind;
	owner: string;
	repo: string;
	number: number;
	commentId: number;
};

export type CommentChange =
	| { type: "edit"; body: string; editedAt: string }
	| { type: "delete" };

type CommentLike = { id: number; body: string };

const CONVERSATION_PATHS = new Set([
	"pulls.page",
	"issues.page",
	"pulls.comments",
	"issues.comments",
	"commentPage",
]);
const REVIEW_PATHS = new Set(["pulls.reviewComments"]);

function isComment(value: unknown): value is CommentLike {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as CommentLike).id === "number" &&
		typeof (value as CommentLike).body === "string"
	);
}

function patchList<T>(list: T[], commentId: number, change: CommentChange) {
	const index = list.findIndex(
		(item) => isComment(item) && item.id === commentId,
	);
	if (index === -1) return null;
	if (change.type === "delete") return list.filter((_, i) => i !== index);
	return list.map((item, i) =>
		i === index
			? { ...item, body: change.body, editedAt: change.editedAt }
			: item,
	);
}

export function patchComment<T>(
	data: T,
	commentId: number,
	change: CommentChange,
): T {
	if (Array.isArray(data)) {
		return (patchList(data, commentId, change) ?? data) as T;
	}
	if (!data || typeof data !== "object") return data;
	const record = data as Record<string, unknown>;
	if (!Array.isArray(record.comments)) return data;
	const comments = patchList(record.comments, commentId, change);
	if (!comments) return data;
	const removed = record.comments.length - comments.length;
	return {
		...record,
		comments,
		...(typeof record.total === "number"
			? { total: record.total - removed }
			: {}),
	} as T;
}

function queryPath(queryKey: readonly unknown[]) {
	const [, , group, name] = queryKey;
	return typeof name === "string" && group !== "commentPage"
		? `${String(group)}.${name}`
		: String(group);
}

function queryInput(queryKey: readonly unknown[]) {
	const input = queryKey.find(
		(part, index) => index > 2 && part !== null && typeof part === "object",
	);
	return (input ?? {}) as {
		owner?: string;
		repo?: string;
		pullNumber?: number;
		issueNumber?: number;
	};
}

export function commentQueryFilters(
	scope: GitHubQueryScope,
	target: CommentTarget,
) {
	const paths = target.kind === "review" ? REVIEW_PATHS : CONVERSATION_PATHS;
	const owner = target.owner.toLowerCase();
	const repo = target.repo.toLowerCase();
	return {
		queryKey: ["github", scope.userId],
		predicate: (query: { queryKey: readonly unknown[] }) => {
			if (!paths.has(queryPath(query.queryKey))) return false;
			const input = queryInput(query.queryKey);
			return (
				input.owner?.toLowerCase() === owner &&
				input.repo?.toLowerCase() === repo &&
				(input.pullNumber ?? input.issueNumber) === target.number
			);
		},
	};
}
