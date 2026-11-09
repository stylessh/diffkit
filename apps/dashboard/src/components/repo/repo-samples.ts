import { SAMPLE_AVATAR_URL } from "#/components/shared/skeleton-sample";
import type {
	BranchComparison,
	DiscussionSummary,
	FileLastCommit,
	GitHubActor,
	IssueSummary,
	PullSummary,
	RepoOverview,
	RepositoryRef,
	RepoTreeEntry,
	WorkflowRun,
} from "#/lib/github.types";

/** Fixed rather than `Date.now()`, so a server-rendered sample hydrates as is. */
const SAMPLE_NOW = Date.UTC(2026, 9, 1);

const hoursAgo = (hours: number) =>
	new Date(SAMPLE_NOW - hours * 3_600_000).toISOString();

const sampleActor: GitHubActor = {
	login: "octocat",
	avatarUrl: SAMPLE_AVATAR_URL,
	url: "",
	type: "User",
};

export const SAMPLE_COMMIT: FileLastCommit = {
	sha: "0000000000000000000000000000000000000000",
	message: "Tighten spacing in the file list header",
	date: hoursAgo(5),
	author: sampleActor,
};

const sampleEntry = (
	name: string,
	type: RepoTreeEntry["type"],
): RepoTreeEntry => ({
	name,
	type,
	path: name,
	sha: `sample-${name}`,
	size: null,
	lastCommit: null,
});

export const SAMPLE_TREE_ENTRIES: RepoTreeEntry[] = [
	sampleEntry(".github", "dir"),
	sampleEntry("apps", "dir"),
	sampleEntry("packages", "dir"),
	sampleEntry("scripts", "dir"),
	sampleEntry(".gitignore", "file"),
	sampleEntry("package.json", "file"),
	sampleEntry("README.md", "file"),
	sampleEntry("tsconfig.json", "file"),
];

export function sampleRepoOverview(owner: string, name: string): RepoOverview {
	return {
		id: 0,
		name,
		fullName: `${owner}/${name}`,
		description:
			"A fast, keyboard-first client for reviewing pull requests and browsing code.",
		isPrivate: false,
		isFork: false,
		viewerHasStarred: false,
		defaultBranch: "main",
		stars: 1280,
		forks: 96,
		watchers: 24,
		language: "TypeScript",
		license: "MIT",
		topics: ["code-review", "github", "typescript"],
		url: "",
		owner,
		ownerAvatarUrl: SAMPLE_AVATAR_URL,
		branchCount: 12,
		tagCount: 8,
		openPullCount: 4,
		openIssueCount: 9,
		hasDiscussions: false,
		forkParentFullName: null,
		forkParentOwnerAvatarUrl: null,
		latestCommit: SAMPLE_COMMIT,
	};
}

export const SAMPLE_BRANCH_COMPARISON: BranchComparison = {
	aheadBy: 3,
	behindBy: 12,
	status: "diverged",
	totalCommits: 3,
};

const sampleRepository: RepositoryRef = {
	name: "sample",
	owner: "sample",
	fullName: "sample/sample",
	url: "",
	isPrivate: null,
};

const samplePull = (id: number, title: string, hours: number): PullSummary => ({
	id,
	number: id,
	title,
	state: "open",
	isDraft: false,
	createdAt: hoursAgo(hours + 48),
	updatedAt: hoursAgo(hours),
	closedAt: null,
	mergedAt: null,
	comments: 0,
	url: "",
	author: null,
	labels: [],
	repository: sampleRepository,
});

/** Five of each, matching the `perPage` the activity cards request. */
export const SAMPLE_PULLS: PullSummary[] = [
	samplePull(1042, "Add keyboard navigation to the file tree", 2),
	samplePull(1039, "Fix overflow in long branch names", 9),
	samplePull(1031, "Cache directory listings per ref", 30),
	samplePull(1028, "Show ahead and behind counts on branches", 54),
	samplePull(1024, "Move settings into a shared layout", 80),
];

const sampleIssue = (
	id: number,
	title: string,
	hours: number,
): IssueSummary => ({
	id,
	number: id,
	title,
	state: "open",
	stateReason: null,
	createdAt: hoursAgo(hours + 48),
	updatedAt: hoursAgo(hours),
	closedAt: null,
	comments: 0,
	url: "",
	author: null,
	labels: [],
	repository: sampleRepository,
});

export const SAMPLE_ISSUES: IssueSummary[] = [
	sampleIssue(1040, "Blame view loses scroll position on resize", 4),
	sampleIssue(1036, "Support viewing files at a tag", 20),
	sampleIssue(1027, "Search results should show the matching line", 52),
	sampleIssue(1021, "Release notes render without code highlighting", 75),
	sampleIssue(1018, "Allow pinning repositories to the sidebar", 96),
];

const sampleRun = (id: number, displayTitle: string, hours: number) =>
	({
		id,
		name: "CI",
		displayTitle,
		status: "completed",
		conclusion: "success",
		event: "push",
		headBranch: "main",
		headSha: "0000000",
		runNumber: id,
		runAttempt: 1,
		runStartedAt: hoursAgo(hours),
		createdAt: hoursAgo(hours),
		updatedAt: hoursAgo(hours),
		htmlUrl: "",
		path: ".github/workflows/ci.yml",
		workflowId: 0,
		actor: null,
		triggeringActor: null,
		pullRequests: [],
		viewerCanRerun: false,
	}) satisfies WorkflowRun;

export const SAMPLE_RUNS: WorkflowRun[] = [
	sampleRun(812, "Tighten spacing in the file list header", 5),
	sampleRun(811, "Cache directory listings per ref", 26),
	sampleRun(810, "Bump dependencies", 50),
	sampleRun(809, "Add keyboard navigation to the file tree", 70),
	sampleRun(808, "Fix overflow in long branch names", 94),
];

const sampleDiscussion = (
	number: number,
	title: string,
	hours: number,
): DiscussionSummary => ({
	number,
	title,
	createdAt: hoursAgo(hours + 48),
	updatedAt: hoursAgo(hours),
	author: null,
	category: "Ideas",
	comments: 0,
	isAnswered: false,
	url: "",
});

export const SAMPLE_DISCUSSIONS: DiscussionSummary[] = [
	sampleDiscussion(214, "Roadmap for the next release", 8),
	sampleDiscussion(209, "Self-hosting on a single server", 40),
	sampleDiscussion(201, "Share your keyboard shortcuts", 90),
];
