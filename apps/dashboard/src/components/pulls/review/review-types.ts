import type { SelectedLineRange } from "@pierre/diffs";
import type { PullReviewComment, ReviewThreadInfo } from "#/lib/github.types";

export type ReviewSide = "LEFT" | "RIGHT";

export type PendingComment = {
	path: string;
	line: number;
	startLine?: number;
	side: ReviewSide;
	startSide?: ReviewSide;
	body: string;
};

export type ActiveCommentForm = Omit<PendingComment, "body">;

/** The comment being written: its form and the lines it highlights, always together. */
export type ReviewComposing = {
	form: ActiveCommentForm;
	range: SelectedLineRange;
};

export type ReviewThreadState = Pick<
	ReviewThreadInfo,
	"threadId" | "isResolved"
>;

export type ReviewAnnotation =
	| { kind: "thread"; comment: PullReviewComment }
	| { kind: "pending"; comment: PendingComment }
	| { kind: "draft"; form: ActiveCommentForm };
export type ReviewEvent = "APPROVE" | "REQUEST_CHANGES" | "COMMENT";

export function annotationSide(side: ReviewSide): "deletions" | "additions" {
	return side === "LEFT" ? "deletions" : "additions";
}

export function isMultiLineComment(comment: ActiveCommentForm) {
	return comment.startLine != null && comment.startLine !== comment.line;
}
