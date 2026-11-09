import type { CommitDayGroup } from "#/lib/commit-groups";
import type { RepoCommitSummary } from "#/lib/github.types";

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

/** A screenful of day groups, so the list doesn't grow under the reader on reveal. */
export const SAMPLE_COMMIT_GROUPS: CommitDayGroup<RepoCommitSummary>[] =
	Array.from({ length: SAMPLE_MESSAGES.length / 2 }, (_, day) => ({
		key: `sample-${day}`,
		label: "Commits on Tue, Nov 4, 2026",
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
