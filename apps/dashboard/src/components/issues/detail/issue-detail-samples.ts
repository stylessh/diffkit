import { SAMPLE_AVATAR_URL } from "#/components/shared/skeleton-sample";
import type {
	GitHubActor,
	IssueDetail,
	IssuePageData,
} from "#/lib/github.types";

const hoursAgo = (hours: number) =>
	new Date(Date.now() - hours * 3_600_000).toISOString();

const sampleActor = (login: string): GitHubActor => ({
	login,
	avatarUrl: SAMPLE_AVATAR_URL,
	url: "",
	type: "User",
});

export const SAMPLE_ISSUE: IssueDetail = {
	id: 0,
	number: 512,
	graphqlId: "sample",
	title: "Sidebar collapses when the window is resized below 1024px",
	state: "open",
	stateReason: null,
	createdAt: hoursAgo(52),
	updatedAt: hoursAgo(3),
	closedAt: null,
	comments: 2,
	url: "",
	author: sampleActor("monalisa"),
	labels: [
		{ name: "bug", color: "d73a4a", description: null },
		{ name: "layout", color: "c5def5", description: null },
	],
	repository: {
		name: "sample",
		owner: "sample",
		fullName: "sample/sample",
		url: "",
		isPrivate: false,
	},
	body: "Resizing the window below 1024px collapses the sidebar, and it stays collapsed after widening the window again.\n\nExpected the sidebar to come back at its previous width once there is room for it.",
	assignees: [sampleActor("hubot")],
	milestone: null,
};

export const SAMPLE_ISSUE_PAGE: IssuePageData = {
	detail: SAMPLE_ISSUE,
	comments: [
		{
			id: 1,
			body: "I can reproduce this on Safari and Chrome. The stored width is reset when the breakpoint is crossed.",
			createdAt: hoursAgo(40),
			author: sampleActor("hubot"),
		},
		{
			id: 2,
			body: "Thanks, I'll keep the last width around so it can be restored.",
			createdAt: hoursAgo(5),
			author: sampleActor("monalisa"),
		},
	],
	events: [
		{
			id: 1,
			event: "labeled",
			createdAt: hoursAgo(51),
			actor: sampleActor("monalisa"),
			label: { name: "bug", color: "d73a4a" },
		},
		{
			id: 2,
			event: "assigned",
			createdAt: hoursAgo(45),
			actor: sampleActor("monalisa"),
			assignee: sampleActor("hubot"),
		},
	],
	commentPagination: { totalCount: 2, perPage: 30, loadedPages: [1] },
	eventPagination: { loadedPages: [1], hasMore: false },
};
