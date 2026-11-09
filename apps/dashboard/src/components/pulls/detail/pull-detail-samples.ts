import { SAMPLE_AVATAR_URL } from "#/components/shared/skeleton-sample";
import type {
	GitHubActor,
	PullDetail,
	PullPageData,
	PullStatus,
} from "#/lib/github.types";

const hoursAgo = (hours: number) =>
	new Date(Date.now() - hours * 3_600_000).toISOString();

const sampleActor = (login: string): GitHubActor => ({
	login,
	avatarUrl: SAMPLE_AVATAR_URL,
	url: "",
	type: "User",
});

export const SAMPLE_PULL: PullDetail = {
	id: 0,
	number: 1024,
	graphqlId: "sample",
	title: "Add keyboard shortcuts for moving between review threads",
	state: "open",
	isDraft: false,
	createdAt: hoursAgo(30),
	updatedAt: hoursAgo(2),
	closedAt: null,
	mergedAt: null,
	comments: 2,
	url: "",
	author: sampleActor("octocat"),
	labels: [
		{ name: "enhancement", color: "a2eeef", description: null },
		{ name: "review", color: "d4c5f9", description: null },
	],
	repository: {
		name: "sample",
		owner: "sample",
		fullName: "sample/sample",
		url: "",
		isPrivate: false,
	},
	body: "Adds `j` and `k` to step through unresolved review threads, and `r` to reply to the focused one.\n\nThe shortcuts are listed in the command palette and stay out of the way while a comment is being written.",
	additions: 248,
	deletions: 61,
	changedFiles: 9,
	commits: 3,
	reviewComments: 0,
	headRefName: "feature/review-thread-shortcuts",
	headSha: "0000000",
	headRepoOwner: null,
	baseRefName: "main",
	isMerged: false,
	mergeCommitSha: null,
	mergedBy: null,
	mergeable: null,
	requestedReviewers: [],
	requestedTeams: [],
};

export const SAMPLE_PULL_PAGE: PullPageData = {
	detail: SAMPLE_PULL,
	comments: [
		{
			id: 1,
			body: "Tried this on a long review and it saves a lot of scrolling. Could the focused thread scroll into view when it changes?",
			createdAt: hoursAgo(20),
			author: sampleActor("hubot"),
		},
		{
			id: 2,
			body: "Good call, done in the latest commit.",
			createdAt: hoursAgo(6),
			author: sampleActor("octocat"),
		},
	],
	commits: [
		{
			sha: "0000001",
			message: "Add thread navigation shortcuts",
			createdAt: hoursAgo(28),
			author: sampleActor("octocat"),
		},
		{
			sha: "0000002",
			message: "Scroll the focused thread into view",
			createdAt: hoursAgo(7),
			author: sampleActor("octocat"),
		},
	],
	events: [
		{
			id: 1,
			event: "labeled",
			createdAt: hoursAgo(29),
			actor: sampleActor("octocat"),
			label: { name: "enhancement", color: "a2eeef" },
		},
	],
	commentPagination: { totalCount: 2, perPage: 30, loadedPages: [1] },
	eventPagination: { loadedPages: [1], hasMore: false },
	headRefDeleted: false,
};

export const SAMPLE_PULL_STATUS: PullStatus = {
	reviews: [],
	checks: {
		total: 0,
		passed: 0,
		failed: 0,
		pending: 0,
		skipped: 0,
		expected: 0,
	},
	checkRuns: [],
	pendingWorkflowApprovals: [],
	mergeable: true,
	mergeableState: "clean",
	conflictingFiles: [],
	behindBy: 0,
	baseRefName: "main",
	canUpdateBranch: false,
	canBypassProtections: false,
	canMerge: true,
};
