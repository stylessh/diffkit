import { SAMPLE_AVATAR_URL } from "#/components/shared/skeleton-sample";
import type {
	CommitReference,
	GitHubActor,
	GitHubUserProfile,
	ItemReference,
} from "#/lib/github.types";

const sampleActor: GitHubActor = {
	login: "octocat",
	avatarUrl: SAMPLE_AVATAR_URL,
	url: "",
	type: "User",
};

const daysAgo = (days: number) =>
	new Date(Date.now() - days * 86_400_000).toISOString();

export const SAMPLE_ITEM_REFERENCE: ItemReference = {
	kind: "pull",
	status: "open",
	owner: "sample",
	repo: "sample",
	number: 1024,
	title: "Add keyboard shortcuts for moving between review threads",
	author: sampleActor,
	createdAt: daysAgo(3),
	comments: 4,
	labels: [{ name: "enhancement", color: "a2eeef", description: null }],
	excerpt:
		"Adds j and k to step through unresolved review threads, and r to reply to the focused one.",
};

export const SAMPLE_COMMIT_REFERENCE: CommitReference = {
	owner: "sample",
	repo: "sample",
	sha: "0000000000000000000000000000000000000000",
	title: "Scroll the focused review thread into view",
	author: sampleActor,
	authorName: null,
	date: daysAgo(2),
	verified: false,
	stats: { additions: 42, deletions: 7 },
};

export const SAMPLE_USER_PROFILE: GitHubUserProfile = {
	id: 0,
	login: "octocat",
	name: "Mona Octocat",
	avatarUrl: SAMPLE_AVATAR_URL,
	bio: null,
	company: "GitHub",
	location: null,
	blog: null,
	twitterUsername: null,
	followers: 0,
	following: 0,
	publicRepos: 0,
	createdAt: daysAgo(900),
	url: "",
};
