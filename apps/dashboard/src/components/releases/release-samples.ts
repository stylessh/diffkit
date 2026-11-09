import type { RepoRelease } from "#/lib/github.types";

const sampleRelease = (
	id: number,
	tagName: string,
	body: string,
	daysAgo: number,
	isLatest = false,
): RepoRelease => {
	const date = new Date(Date.now() - daysAgo * 86_400_000).toISOString();
	return {
		id,
		tagName,
		name: tagName,
		body,
		isDraft: false,
		isPrerelease: false,
		isLatest,
		createdAt: date,
		publishedAt: date,
		author: null,
		targetCommitish: "main",
		url: "",
		tarballUrl: null,
		zipballUrl: null,
		assets: [],
	};
};

export const SAMPLE_RELEASES: RepoRelease[] = [
	sampleRelease(
		-1,
		"v2.4.0",
		[
			"## What's changed",
			"",
			"- Inline review suggestions you can apply straight from the diff",
			"- Faster file tree for pull requests with hundreds of files",
			"- Keyboard shortcuts to jump between unresolved threads",
			"- Fixed notification counts drifting after a refresh",
		].join("\n"),
		2,
		true,
	),
	sampleRelease(-2, "v2.3.1", "Fixes the notification badge count.", 9),
	sampleRelease(-3, "v2.3.0", "Keyboard navigation across the inbox.", 16),
];
