import type {
	BlameCommit,
	CodeSearchHit,
	RepoBlame,
} from "#/lib/code-browsing/types";

export const SAMPLE_CODE = [
	'import { formatRelativeTime } from "./format-relative-time";',
	"",
	"export function describeCommit(commit: Commit) {",
	"\tconst author = commit.author?.login ?? 'Unknown';",
	"\tconst when = formatRelativeTime(commit.date);",
	"\treturn [author, 'committed', when].join(' ');",
	"}",
	"",
	"export function shortSha(sha: string) {",
	"\treturn sha.slice(0, 7);",
	"}",
].join("\n");

const SAMPLE_NOW = Date.UTC(2026, 9, 1);

const daysAgo = (days: number) =>
	new Date(SAMPLE_NOW - days * 86_400_000).toISOString();

const sampleBlameCommit = (
	oid: string,
	headline: string,
	days: number,
): BlameCommit => ({
	oid,
	abbreviatedOid: oid.slice(0, 7),
	headline,
	committedDate: daysAgo(days),
	authorName: "octocat",
	authorLogin: null,
	avatarUrl: null,
	parentOid: null,
});

export const SAMPLE_BLAME: Extract<RepoBlame, { status: "ok" }> = {
	status: "ok",
	commits: {
		a: sampleBlameCommit("a000000", "Describe commits by author and age", 40),
		b: sampleBlameCommit("b000000", "Use the shared relative time format", 6),
		c: sampleBlameCommit("c000000", "Add a short sha helper", 90),
	},
	ranges: [
		{ start: 1, end: 2, age: 3, commitOid: "b" },
		{ start: 3, end: 4, age: 6, commitOid: "a" },
		{ start: 5, end: 5, age: 3, commitOid: "b" },
		{ start: 6, end: 8, age: 6, commitOid: "a" },
		{ start: 9, end: 11, age: 9, commitOid: "c" },
	],
};

export const SAMPLE_CODE_SEARCH_HITS: CodeSearchHit[] = [
	{
		path: "apps/dashboard/src/lib/format-relative-time.ts",
		sha: "sample-1",
		fragments: [
			{
				text: "export function formatRelativeTime(date: string) {\n\tconst elapsed = Date.now() - new Date(date).getTime();",
				highlights: [],
			},
		],
	},
	{
		path: "packages/ui/src/components/markdown.tsx",
		sha: "sample-2",
		fragments: [
			{
				text: "const html = await highlightCode(code, lang);\nreturn <div dangerouslySetInnerHTML={{ __html: html }} />;",
				highlights: [],
			},
		],
	},
	{
		path: "apps/dashboard/src/components/repo/file-tree.tsx",
		sha: "sample-3",
		fragments: [
			{
				text: "{entries.map((entry) => (\n\t<FileTreeRow key={entry.sha} entry={entry} />",
				highlights: [],
			},
		],
	},
];
