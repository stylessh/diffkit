export type FileSearchEntry = {
	path: string;
	name: string;
	type: "file" | "dir" | "submodule";
};

export type FileSearchResult = FileSearchEntry & {
	score: number;
};

function scoreMatch(query: string, filePath: string): number {
	const lowerQuery = query.toLowerCase();
	const lowerPath = filePath.toLowerCase();
	const name = lowerPath.split("/").pop() ?? lowerPath;

	// No match at all — check if every character appears in order
	let qi = 0;
	for (let pi = 0; pi < lowerPath.length && qi < lowerQuery.length; pi++) {
		if (lowerPath[pi] === lowerQuery[qi]) qi++;
	}
	if (qi < lowerQuery.length) return -1;

	let score = 0;

	// Exact name match
	if (name === lowerQuery) return 1000;

	// Name starts with query
	if (name.startsWith(lowerQuery)) score += 100;

	// Name contains query as substring
	if (name.includes(lowerQuery)) score += 50;

	// Path contains query as substring
	if (lowerPath.includes(lowerQuery)) score += 25;

	// Consecutive character match bonus — reward longer runs
	let maxRun = 0;
	let currentRun = 0;
	let qj = 0;
	for (let pi = 0; pi < lowerPath.length && qj < lowerQuery.length; pi++) {
		if (lowerPath[pi] === lowerQuery[qj]) {
			currentRun++;
			qj++;
			if (currentRun > maxRun) maxRun = currentRun;
		} else {
			currentRun = 0;
		}
	}
	score += maxRun * 5;

	// Prefer shorter paths (less nesting)
	const depth = filePath.split("/").length;
	score -= depth * 2;

	// Prefer shorter file names
	score -= name.length;

	return score;
}

/** Returns indices of characters in `text` that match `query` in order. */
export function getMatchIndices(query: string, text: string): Set<number> {
	const indices = new Set<number>();
	const lowerQuery = query.toLowerCase();
	const lowerText = text.toLowerCase();
	let qi = 0;
	for (let ti = 0; ti < lowerText.length && qi < lowerQuery.length; ti++) {
		if (lowerText[ti] === lowerQuery[qi]) {
			indices.add(ti);
			qi++;
		}
	}
	return indices;
}

export function searchFiles(
	query: string,
	entries: FileSearchEntry[],
	limit = 50,
): FileSearchResult[] {
	if (!query.trim()) return [];

	const results: FileSearchResult[] = [];
	for (const entry of entries) {
		const score = scoreMatch(query, entry.path);
		if (score >= 0) {
			results.push({ ...entry, score });
		}
	}

	results.sort((a, b) => b.score - a.score);
	return results.slice(0, limit);
}
