import type { DiffLineAnnotation } from "@pierre/diffs/react";
import { useMemo } from "react";
import type { PullReviewComment, ReviewThreadInfo } from "#/lib/github.types";
import { annotationSide, type ReviewThreadState } from "./review-types";

export type ReviewThreads = {
	threadsByFile: ReadonlyMap<string, DiffLineAnnotation<PullReviewComment>[]>;
	repliesByCommentId: ReadonlyMap<number, PullReviewComment[]>;
	threadInfoByCommentId: ReadonlyMap<number, ReviewThreadState>;
};

function pushTo<K, V>(map: Map<K, V[]>, key: K, value: V) {
	const existing = map.get(key);
	if (existing) existing.push(value);
	else map.set(key, [value]);
}

/** Submitted review comments, arranged the way the diff anchors them. */
export function useReviewThreads(
	comments: readonly PullReviewComment[],
	statuses: readonly ReviewThreadInfo[] | undefined,
): ReviewThreads {
	const { threadsByFile, repliesByCommentId } = useMemo(() => {
		const threads = new Map<string, DiffLineAnnotation<PullReviewComment>[]>();
		const replies = new Map<number, PullReviewComment[]>();
		for (const comment of comments) {
			if (comment.inReplyToId != null) {
				pushTo(replies, comment.inReplyToId, comment);
			} else if (comment.line != null) {
				pushTo(threads, comment.path, {
					side: annotationSide(comment.side),
					lineNumber: comment.line,
					metadata: comment,
				});
			}
		}
		return { threadsByFile: threads, repliesByCommentId: replies };
	}, [comments]);

	const threadInfoByCommentId = useMemo(() => {
		const info = new Map<number, ReviewThreadState>();
		for (const status of statuses ?? []) {
			info.set(status.firstCommentId, {
				threadId: status.threadId,
				isResolved: status.isResolved,
			});
		}
		return info;
	}, [statuses]);

	return { threadsByFile, repliesByCommentId, threadInfoByCommentId };
}
