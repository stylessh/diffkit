import type { RepoBranchListItem } from "#/lib/github.types";

const sampleCommit = (authorName: string, daysAgo: number) => ({
	sha: "0000000",
	date: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
	author: null,
	authorName,
});

export const SAMPLE_BRANCHES: RepoBranchListItem[] = [
	{
		name: "feature/review-threads",
		commit: sampleCommit("octocat", 1),
		pullRequest: {
			number: 1024,
			state: "OPEN",
			isDraft: false,
			title: "Sample",
		},
	},
	{
		name: "fix/sidebar-overflow",
		commit: sampleCommit("hubot", 3),
		pullRequest: null,
	},
	{
		name: "chore/update-dependencies",
		commit: sampleCommit("monalisa", 6),
		pullRequest: null,
	},
];
