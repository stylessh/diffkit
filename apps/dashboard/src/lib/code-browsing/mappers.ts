import type {
	BlameCommit,
	BlameRange,
	CodeSearchFragment,
	CodeSearchHit,
	RepoBlame,
} from "./types";

export type GraphQLBlameCommit = {
	oid: string;
	abbreviatedOid: string;
	messageHeadline: string;
	committedDate: string;
	author: {
		name: string | null;
		avatarUrl: string | null;
		user: { login: string; avatarUrl: string } | null;
	} | null;
	parents: { nodes: Array<{ oid: string } | null> | null } | null;
};

export type GraphQLBlameResponse = {
	repository: {
		object: {
			blame?: {
				ranges: Array<{
					startingLine: number;
					endingLine: number;
					age: number;
					commit: GraphQLBlameCommit;
				}>;
			};
		} | null;
	} | null;
};

function toBlameCommit(commit: GraphQLBlameCommit): BlameCommit {
	const user = commit.author?.user ?? null;
	return {
		oid: commit.oid,
		abbreviatedOid: commit.abbreviatedOid,
		headline: commit.messageHeadline,
		committedDate: commit.committedDate,
		authorName: user?.login ?? commit.author?.name ?? "Unknown",
		authorLogin: user?.login ?? null,
		avatarUrl: user?.avatarUrl ?? commit.author?.avatarUrl ?? null,
		parentOid: commit.parents?.nodes?.[0]?.oid ?? null,
	};
}

export function mapBlameResponse(response: GraphQLBlameResponse): RepoBlame {
	const blame = response.repository?.object?.blame;
	if (!blame) return { status: "missing" };
	const commits: Record<string, BlameCommit> = {};
	const ranges: BlameRange[] = [];
	for (const range of blame.ranges) {
		commits[range.commit.oid] ??= toBlameCommit(range.commit);
		ranges.push({
			start: range.startingLine,
			end: range.endingLine,
			age: range.age,
			commitOid: range.commit.oid,
		});
	}
	ranges.sort((a, b) => a.start - b.start);
	return { status: "ok", ranges, commits };
}

export type RestCodeSearchItem = {
	path: string;
	sha: string;
	text_matches?: Array<{
		property?: string;
		fragment?: string;
		matches?: Array<{ indices?: number[] }>;
	}>;
};

export function mapCodeSearchItem(item: RestCodeSearchItem): CodeSearchHit {
	const fragments: CodeSearchFragment[] = [];
	for (const match of item.text_matches ?? []) {
		if (match.property !== "content" || !match.fragment) continue;
		const highlights = (match.matches ?? []).flatMap((hit) => {
			const [start, end] = hit.indices ?? [];
			return typeof start === "number" && typeof end === "number" && end > start
				? [[start, end] as const]
				: [];
		});
		fragments.push({ text: match.fragment, highlights });
	}
	return { path: item.path, sha: item.sha, fragments };
}

export type HighlightSegment = { text: string; highlighted: boolean };

export function splitHighlights(
	text: string,
	highlights: CodeSearchFragment["highlights"],
): HighlightSegment[] {
	const segments: HighlightSegment[] = [];
	let cursor = 0;
	const ordered = [...highlights].sort((a, b) => a[0] - b[0]);
	for (const [rawStart, rawEnd] of ordered) {
		const start = Math.max(rawStart, cursor);
		const end = Math.min(rawEnd, text.length);
		if (end <= start) continue;
		if (start > cursor) {
			segments.push({ text: text.slice(cursor, start), highlighted: false });
		}
		segments.push({ text: text.slice(start, end), highlighted: true });
		cursor = end;
	}
	if (cursor < text.length) {
		segments.push({ text: text.slice(cursor), highlighted: false });
	}
	return segments;
}
