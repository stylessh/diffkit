import { SAMPLE_AVATAR_URL } from "#/components/shared/skeleton-sample";
import type {
	BranchComparison,
	FileLastCommit,
	GitHubActor,
	RepoOverview,
	RepoTreeEntry,
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
