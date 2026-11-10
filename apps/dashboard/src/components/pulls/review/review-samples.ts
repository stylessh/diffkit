import { SAMPLE_DIFF_FILES } from "#/components/diffs/diff-samples";
import type { PullFileSummary } from "#/lib/github.types";

/** The files the diff skeleton draws, so the tree and the diff agree while loading. */
export const SAMPLE_REVIEW_FILES: PullFileSummary[] = SAMPLE_DIFF_FILES.map(
	(file) => ({
		filename: file.path,
		status: file.status,
		additions: file.additions,
		deletions: file.deletions,
		changes: file.additions + file.deletions,
		previousFilename: null,
	}),
);
