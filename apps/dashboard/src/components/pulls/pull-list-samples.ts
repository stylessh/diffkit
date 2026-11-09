import { SAMPLE_AVATAR_URL } from "#/components/shared/skeleton-sample";
import type { GitHubLabel, PullSummary } from "#/lib/github.types";

const LABELS: Record<string, GitHubLabel> = {
	bug: { name: "bug", color: "d73a4a", description: null },
	enhancement: { name: "enhancement", color: "a2eeef", description: null },
	docs: { name: "documentation", color: "0075ca", description: null },
};

const SAMPLES: [title: string, labels: GitHubLabel[], comments: number][] = [
	[
		"Add keyboard shortcuts for moving between review threads",
		[LABELS.enhancement],
		4,
	],
	["Fix flaky timeline test on slow runners", [LABELS.bug], 1],
	["Render suggested changes inline with the diff hunk", [], 7],
	["Bump dependencies", [], 0],
	["Keep scroll position when switching between files", [LABELS.bug], 2],
	["Document the release process", [LABELS.docs], 0],
	["Retry webhook deliveries with backoff", [], 3],
	["Show ahead and behind counts on branches", [LABELS.enhancement], 0],
	["Move settings into a shared layout", [], 5],
	["Cache directory listings per ref", [], 1],
	["Fix overflow in long branch names", [LABELS.bug], 0],
	["Tidy up the settings page copy", [], 0],
];

/** A screenful of repo pull request rows. */
export const SAMPLE_PULLS: PullSummary[] = SAMPLES.map(
	([title, labels, comments], index) => ({
		id: index,
		number: 1200 - index,
		title,
		state: "open",
		isDraft: index % 5 === 3,
		createdAt: new Date(Date.now() - (index + 2) * 3_600_000).toISOString(),
		updatedAt: new Date(Date.now() - (index + 1) * 3_600_000).toISOString(),
		closedAt: null,
		mergedAt: null,
		comments,
		additions: 40 + ((index * 137) % 900),
		deletions: (index * 53) % 120,
		url: "",
		author: {
			login: "octocat",
			avatarUrl: SAMPLE_AVATAR_URL,
			url: "",
			type: "User",
		},
		labels,
		repository: {
			name: "sample",
			owner: "sample",
			fullName: "sample/sample",
			url: "",
			isPrivate: false,
		},
	}),
);
