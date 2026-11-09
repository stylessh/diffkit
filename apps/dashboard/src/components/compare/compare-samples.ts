import type { PullCommit, PullFile } from "#/lib/github.types";

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

const sampleCommit = (sha: string, message: string): PullCommit => ({
	sha,
	message,
	createdAt: "",
	author: null,
});

export const SAMPLE_COMPARE_FILES: PullFile[] = [
	sampleFile("src/components/review/diff-hunk.tsx", 48, 12),
	sampleFile("src/lib/patch.ts", 16, 4),
	sampleFile("src/components/review/review-sidebar.tsx", 9, 9),
];

export const SAMPLE_COMPARE_COMMITS: PullCommit[] = [
	sampleCommit("0000001", "Render suggested changes inline with the diff hunk"),
	sampleCommit("0000002", "Parse suggestion blocks from review comments"),
];
