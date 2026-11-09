import type { CommitGroup } from "#/lib/commit-groups";
import type {
	PullFile,
	RepoCommitDetail,
	RepoCommitSummary,
} from "#/lib/github.types";

const sampleCommit = (
	sha: string,
	message: string,
	authorName: string,
	hoursAgo: number,
): RepoCommitSummary => ({
	sha,
	message,
	date: new Date(Date.now() - hoursAgo * 3_600_000).toISOString(),
	author: null,
	authorName,
	verified: false,
	commentCount: 0,
	url: "",
});

const SAMPLE_MESSAGES = [
	"Add keyboard shortcuts to the review sidebar",
	"Fix flaky timeline test",
	"Render suggested changes inline with the diff hunk",
	"Bump dependencies",
	"Keep scroll position when switching between files",
	"Tidy up the settings page copy",
	"Retry webhook deliveries with backoff",
	"Show ahead and behind counts on branches",
	"Move settings into a shared layout",
	"Cache directory listings per ref",
	"Fix overflow in long branch names",
	"Document the release process",
];
const SAMPLE_AUTHORS = ["octocat", "hubot", "monalisa"];

/** A screenful of groups, so the list doesn't grow under the reader on reveal. */
export const SAMPLE_COMMIT_GROUPS: CommitGroup<RepoCommitSummary>[] =
	Array.from({ length: SAMPLE_MESSAGES.length / 2 }, (_, day) => ({
		key: `sample-${day}`,
		title: "October 2026",
		label: "Commits in October 2026",
		commits: [0, 1].map((offset) => {
			const index = day * 2 + offset;
			return sampleCommit(
				String(index).padStart(7, "0"),
				SAMPLE_MESSAGES[index],
				SAMPLE_AUTHORS[index % SAMPLE_AUTHORS.length],
				day * 24 + offset + 1,
			);
		}),
	}));

const sampleFile = (
	filename: string,
	additions: number,
	deletions: number,
): PullFile => ({
	sha: null,
	filename,
	status: "modified",
	additions,
	deletions,
	changes: additions + deletions,
	patch: null,
	previousFilename: null,
});

export const SAMPLE_COMMIT_DETAIL: RepoCommitDetail = {
	sha: "0000000000000000000000000000000000000000",
	message: "Render suggested changes inline with the diff hunk",
	date: new Date().toISOString(),
	author: null,
	files: [
		sampleFile("src/components/review/diff-hunk.tsx", 48, 12),
		sampleFile("src/components/review/review-sidebar.tsx", 9, 9),
		sampleFile("src/components/review/suggestion-block.tsx", 64, 0),
		sampleFile("src/lib/patch.ts", 16, 4),
		sampleFile("src/lib/suggestions.ts", 31, 2),
		sampleFile("test/patch.test.ts", 22, 0),
	],
};
