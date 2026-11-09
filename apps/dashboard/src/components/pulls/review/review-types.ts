import type { PullReviewComment } from "#/lib/github.types";

export type PendingComment = {
	path: string;
	line: number;
	startLine?: number;
	side: "LEFT" | "RIGHT";
	startSide?: "LEFT" | "RIGHT";
	body: string;
};

export type ActiveCommentForm = Omit<PendingComment, "body">;

export type ReviewAnnotation =
	| { kind: "thread"; comment: PullReviewComment }
	| { kind: "pending"; comment: PendingComment }
	| { kind: "draft"; form: ActiveCommentForm };
export type ReviewEvent = "APPROVE" | "REQUEST_CHANGES" | "COMMENT";
