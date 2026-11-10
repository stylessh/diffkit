const CONTEXT_LINES_ABOVE = 3;

type DiffSide = "LEFT" | "RIGHT";

function advance(line: string, position: { old: number; new: number }) {
	if (!line.startsWith("+")) position.old++;
	if (!line.startsWith("-")) position.new++;
}

/**
 * Cuts a review comment's diff hunk down to the commented range plus a few
 * lines of context above it. GitHub's hunk already ends at the comment's last
 * line, so only the start moves, and the header is rewritten to match.
 */
export function trimDiffHunk(
	diffHunk: string,
	commentLine: number | null,
	startLine: number | null,
	side: DiffSide,
): string {
	const lines = diffHunk.split("\n");
	const headerIndex = lines.findIndex((line) => line.startsWith("@@"));
	if (headerIndex === -1 || commentLine == null) return diffHunk;

	const header = lines[headerIndex].match(
		/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/,
	);
	if (!header) return diffHunk;

	const body = lines.slice(headerIndex + 1);
	const oldStart = Number(header[1]);
	const newStart = Number(header[3]);
	const rangeStart = startLine ?? commentLine;

	const position = { old: oldStart, new: newStart };
	let rangeStartIndex = body.length;
	for (const [index, line] of body.entries()) {
		const current = side === "LEFT" ? position.old : position.new;
		if (current >= rangeStart) {
			rangeStartIndex = index;
			break;
		}
		advance(line, position);
	}

	const keepFrom = Math.max(0, rangeStartIndex - CONTEXT_LINES_ABOVE);
	if (keepFrom === 0) return diffHunk;

	const dropped = { old: 0, new: 0 };
	for (const line of body.slice(0, keepFrom)) advance(line, dropped);

	const oldCount = Number(header[2] ?? 1);
	const newCount = Number(header[4] ?? 1);
	const trimmedHeader = `@@ -${oldStart + dropped.old},${oldCount - dropped.old} +${newStart + dropped.new},${newCount - dropped.new} @@${header[5]}`;
	return [trimmedHeader, ...body.slice(keepFrom)].join("\n");
}
