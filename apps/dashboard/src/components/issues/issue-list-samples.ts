import { SAMPLE_AVATAR_URL } from "#/components/shared/skeleton-sample";
import type { GitHubLabel, IssueSummary } from "#/lib/github.types";

const LABELS: Record<string, GitHubLabel> = {
	bug: { name: "bug", color: "d73a4a", description: null },
	enhancement: { name: "enhancement", color: "a2eeef", description: null },
	question: { name: "question", color: "d876e3", description: null },
};

const SAMPLES: [title: string, labels: GitHubLabel[], comments: number][] = [
	["Review sidebar loses its scroll position after a reply", [LABELS.bug], 6],
	["Support keyboard navigation in the file tree", [LABELS.enhancement], 2],
	["Webhook deliveries fail silently on timeouts", [LABELS.bug], 3],
	["How do I pin a branch to the top of the list?", [LABELS.question], 1],
	["Long branch names overflow the compare banner", [LABELS.bug], 0],
	["Show who requested a review on each pull request", [LABELS.enhancement], 4],
	["Release notes drop the last bullet point", [], 0],
	["Dark theme contrast is low on merged labels", [LABELS.bug], 2],
	["Add a setting to collapse resolved threads", [], 0],
	["Search should match commit SHAs", [LABELS.enhancement], 1],
	["Tag list is slow on repositories with many tags", [], 5],
	["Typo on the settings page", [], 0],
];

/** A screenful of repo issue rows. */
export const SAMPLE_ISSUES: IssueSummary[] = SAMPLES.map(
	([title, labels, comments], index) => ({
		id: index,
		number: 800 - index,
		title,
		state: "open",
		stateReason: null,
		createdAt: new Date(Date.now() - (index + 2) * 3_600_000).toISOString(),
		updatedAt: new Date(Date.now() - (index + 1) * 3_600_000).toISOString(),
		closedAt: null,
		comments,
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
