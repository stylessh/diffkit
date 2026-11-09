import type {
	ReviewDraftComment,
	ReviewDraftPull,
	ReviewDraftsResult,
} from "#/lib/github.types";

const sampleComment = (
	id: string,
	path: string,
	line: number,
	body: string,
): ReviewDraftComment => ({
	id,
	path,
	line,
	startLine: null,
	isFileComment: false,
	outdated: false,
	body,
	createdAt: "",
	updatedAt: "",
});

const sampleDraft = (
	reviewId: number,
	number: number,
	title: string,
	comments: ReviewDraftComment[],
	hoursAgo: number,
): ReviewDraftPull => {
	const updatedAt = new Date(Date.now() - hoursAgo * 3_600_000).toISOString();
	return {
		owner: "acme",
		repo: "dashboard",
		repositoryFullName: "acme/dashboard",
		number,
		title,
		url: "",
		isDraft: false,
		author: null,
		updatedAt,
		review: {
			reviewId,
			nodeId: "",
			body: "",
			url: "",
			createdAt: updatedAt,
			updatedAt,
			commentCount: comments.length,
			comments,
		},
	};
};

export const SAMPLE_REVIEW_DRAFTS: ReviewDraftsResult = {
	drafts: [
		sampleDraft(
			-1,
			1024,
			"Render suggested changes inline with the diff hunk",
			[
				sampleComment(
					"sample-1",
					"src/components/review/diff-hunk.tsx",
					42,
					"This re-renders every hunk on each keystroke; can we memo the parsed patch?",
				),
				sampleComment(
					"sample-2",
					"src/lib/patch.ts",
					118,
					"Nit: the early return makes the else branch unnecessary.",
				),
			],
			2,
		),
		sampleDraft(
			-2,
			987,
			"Keep scroll position when switching between files",
			[
				sampleComment(
					"sample-3",
					"src/hooks/use-scroll-restore.ts",
					17,
					"Should this reset when the pull request changes?",
				),
			],
			26,
		),
	],
	checkedCount: 0,
	truncated: false,
	partial: false,
};
