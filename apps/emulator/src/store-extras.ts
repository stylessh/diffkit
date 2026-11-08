/**
 * State emulate does not model but DiffKit reads: commit statuses, reactions,
 * review-thread resolution, stars, notifications, discussions, job logs,
 * pinned repos and multi-line review comment ranges.
 *
 * They live in the same `Store` as emulate's collections, so snapshots and
 * persistence cover them too.
 */
import type { Entity, Store } from "@emulators/core";

export interface CommitStatusRow extends Entity {
	repo_id: number;
	sha: string;
	context: string;
	state: "success" | "failure" | "pending" | "error";
	description: string | null;
	target_url: string | null;
	creator_id: number;
}

export type ReactionSubjectType =
	| "issue"
	| "issue_comment"
	| "review_comment"
	| "pull_request";

export interface ReactionRow extends Entity {
	subject_type: ReactionSubjectType;
	/** emulate row id of the subject (issue, comment). */
	subject_id: number;
	user_id: number;
	content: string;
}

export interface ReviewThreadStateRow extends Entity {
	/** Root review comment id of the thread. */
	root_comment_id: number;
	resolved: boolean;
	resolved_by_id: number | null;
}

export interface StarRow extends Entity {
	user_id: number;
	repo_id: number;
}

export interface NotificationRow extends Entity {
	thread_id: string;
	user_id: number;
	repo_id: number;
	subject_type: "PullRequest" | "Issue";
	subject_number: number;
	reason: string;
	unread: boolean;
	done: boolean;
	last_read_at: string | null;
	latest_comment_id: number | null;
}

export interface DiscussionRow extends Entity {
	repo_id: number;
	number: number;
	title: string;
	user_id: number;
	category_name: string;
	category_emoji: string;
	comments_count: number;
	answer_chosen_at: string | null;
}

export interface JobLogRow extends Entity {
	job_id: number;
	/** Step number -> log lines. */
	steps: Record<string, string[]>;
}

export interface PinnedRow extends Entity {
	user_id: number;
	repo_ids: number[];
}

export interface ReviewCommentRangeRow extends Entity {
	comment_id: number;
	start_line: number | null;
	start_side: "LEFT" | "RIGHT" | null;
	outdated: boolean;
}

export interface MinimizedRow extends Entity {
	comment_id: number;
	classifier: string;
}

export function getExtrasStore(store: Store) {
	return {
		statuses: store.collection<CommitStatusRow>("diffkit.statuses", [
			"repo_id",
			"sha",
		]),
		reactions: store.collection<ReactionRow>("diffkit.reactions", [
			"subject_id",
		]),
		threadStates: store.collection<ReviewThreadStateRow>(
			"diffkit.review_thread_states",
			["root_comment_id"],
		),
		stars: store.collection<StarRow>("diffkit.stars", ["user_id", "repo_id"]),
		notifications: store.collection<NotificationRow>("diffkit.notifications", [
			"user_id",
			"thread_id",
		]),
		discussions: store.collection<DiscussionRow>("diffkit.discussions", [
			"repo_id",
		]),
		jobLogs: store.collection<JobLogRow>("diffkit.job_logs", ["job_id"]),
		pinned: store.collection<PinnedRow>("diffkit.pinned", ["user_id"]),
		commentRanges: store.collection<ReviewCommentRangeRow>(
			"diffkit.review_comment_ranges",
			["comment_id"],
		),
		minimized: store.collection<MinimizedRow>("diffkit.minimized", [
			"comment_id",
		]),
	};
}

export type ExtrasStore = ReturnType<typeof getExtrasStore>;

/** Pins a row's timestamps; `Collection.update` always stamps "now". */
export function setTimestamps(
	row: { created_at: string; updated_at: string } | undefined,
	createdAt: string,
	updatedAt = createdAt,
) {
	if (!row) {
		return;
	}
	row.created_at = createdAt;
	row.updated_at = updatedAt;
}
