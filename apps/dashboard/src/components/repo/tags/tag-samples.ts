import type { RepoTagListItem } from "#/lib/github.types";

const sampleTag = (
	name: string,
	message: string | null,
	daysAgo: number,
): RepoTagListItem => ({
	name,
	commitSha: "0000000",
	date: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
	message,
	tagger: null,
});

export const SAMPLE_TAGS: RepoTagListItem[] = [
	sampleTag("v2.4.0", "Inline review suggestions and faster diffs", 2),
	sampleTag("v2.3.1", "Fix notification badge count", 9),
	sampleTag("v2.3.0", null, 16),
	sampleTag("v2.2.0", "Keyboard navigation across the inbox", 30),
];
