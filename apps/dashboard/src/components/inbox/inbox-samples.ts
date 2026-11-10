import { SAMPLE_AVATAR_URL } from "#/components/shared/skeleton-sample";
import type { NotificationItem } from "#/lib/github.types";
import type { InboxGroup } from "#/lib/inbox";

const SAMPLE_OWNER = {
	login: "acme",
	avatarUrl: SAMPLE_AVATAR_URL,
	url: "",
	type: "Organization",
};

const sampleNotification = (
	index: number,
	title: string,
	type: NotificationItem["subject"]["type"],
	reason: NotificationItem["reason"],
): NotificationItem => ({
	id: `sample-${index}`,
	unread: index < 3,
	reason,
	subject: { title, url: null, latestCommentUrl: null, type },
	repository: {
		id: 0,
		name: "dashboard",
		fullName: "acme/dashboard",
		owner: SAMPLE_OWNER,
		private: false,
	},
	participants: [],
	subjectState: "open",
	updatedAt: new Date(Date.now() - (index + 1) * 3_600_000).toISOString(),
	lastReadAt: null,
	url: "",
});

const SAMPLE_NOTIFICATIONS: NotificationItem[] = [
	sampleNotification(
		0,
		"Render suggested changes inline",
		"PullRequest",
		"review_requested",
	),
	sampleNotification(
		1,
		"Sidebar overflows on narrow screens",
		"Issue",
		"mention",
	),
	sampleNotification(
		2,
		"Cache directory listings per ref",
		"PullRequest",
		"comment",
	),
	sampleNotification(3, "Fix flaky timeline test", "PullRequest", "author"),
	sampleNotification(4, "Keyboard navigation in the inbox", "Issue", "assign"),
	sampleNotification(
		5,
		"Update dependency versions across the workspace",
		"PullRequest",
		"subscribed",
	),
	sampleNotification(6, "Document the release process", "Issue", "comment"),
	sampleNotification(
		7,
		"Show ahead and behind counts on branches",
		"PullRequest",
		"state_change",
	),
];

export const SAMPLE_INBOX_GROUP: InboxGroup = {
	key: "sample",
	title: "Notifications",
	items: SAMPLE_NOTIFICATIONS,
};
