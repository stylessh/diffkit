import { SAMPLE_AVATAR_URL } from "#/components/shared/skeleton-sample";
import type { IssueComment } from "#/lib/github.types";

const sampleComment = (id: number, login: string, body: string) =>
	({
		id,
		body,
		createdAt: new Date(0).toISOString(),
		author: { login, avatarUrl: SAMPLE_AVATAR_URL, url: "", type: "User" },
	}) satisfies IssueComment;

/** Stands in for a timeline page while "load more" fetches it. */
export const SAMPLE_TIMELINE_PAGE_COMMENTS: IssueComment[] = [
	sampleComment(
		-1,
		"octocat",
		"Tried this on a long review and it saves a lot of scrolling. Could the focused thread scroll into view when it changes?",
	),
	sampleComment(-2, "hubot", "Good call, done in the latest commit."),
];
