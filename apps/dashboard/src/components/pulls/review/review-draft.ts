import type { SelectedLineRange } from "@pierre/diffs";
import { useMemo, useReducer } from "react";
import type {
	ActiveCommentForm,
	PendingComment,
	ReviewComposing,
	ReviewSide,
} from "./review-types";

/** The review being written: comments waiting to be submitted, and the one open in a composer. */
export type ReviewDraft = {
	pending: readonly PendingComment[];
	composing: ReviewComposing | null;
};

type ReviewDraftAction =
	| { type: "compose"; path: string; range: SelectedLineRange }
	| { type: "cancel" }
	| { type: "add"; comment: PendingComment }
	| { type: "edit"; original: PendingComment; body: string }
	| { type: "submitted" };

export const EMPTY_REVIEW_DRAFT: ReviewDraft = { pending: [], composing: null };

const toReviewSide = (side: string | undefined): ReviewSide =>
	side === "deletions" ? "LEFT" : "RIGHT";

/** A selection can be dragged upwards; GitHub wants the comment anchored on its last line. */
function commentFormForRange(
	path: string,
	range: SelectedLineRange,
): ActiveCommentForm {
	const startsFirst = range.start <= range.end;
	const endSide = range.endSide ?? range.side;
	const form: ActiveCommentForm = {
		path,
		line: Math.max(range.start, range.end),
		side: toReviewSide(startsFirst ? endSide : range.side),
	};
	if (range.start === range.end) return form;
	return {
		...form,
		startLine: Math.min(range.start, range.end),
		startSide: toReviewSide(startsFirst ? range.side : endSide),
	};
}

const isSameComment = (a: PendingComment, b: PendingComment) =>
	a.path === b.path &&
	a.line === b.line &&
	a.side === b.side &&
	a.startLine === b.startLine;

export function reviewDraftReducer(
	draft: ReviewDraft,
	action: ReviewDraftAction,
): ReviewDraft {
	switch (action.type) {
		case "compose":
			return {
				...draft,
				composing: {
					form: commentFormForRange(action.path, action.range),
					range: action.range,
				},
			};
		case "cancel":
			return { ...draft, composing: null };
		case "add":
			return { pending: [...draft.pending, action.comment], composing: null };
		case "edit":
			return {
				...draft,
				pending: draft.pending.map((comment) =>
					isSameComment(comment, action.original)
						? { ...comment, body: action.body }
						: comment,
				),
			};
		case "submitted":
			return { ...draft, pending: [] };
	}
}

export function useReviewDraft() {
	const [draft, dispatch] = useReducer(reviewDraftReducer, EMPTY_REVIEW_DRAFT);
	const actions = useMemo(
		() => ({
			compose: (path: string, range: SelectedLineRange) =>
				dispatch({ type: "compose", path, range }),
			cancel: () => dispatch({ type: "cancel" }),
			add: (comment: PendingComment) => dispatch({ type: "add", comment }),
			edit: (original: PendingComment, body: string) =>
				dispatch({ type: "edit", original, body }),
			submitted: () => dispatch({ type: "submitted" }),
		}),
		[],
	);
	return { draft, actions };
}
