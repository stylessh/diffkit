export type LineRange = { start: number; end: number };

const LINE_HASH = /^#?L(\d+)(?:-L(\d+))?$/;

export function parseLineHash(
	hash: string,
	lineCount?: number,
): LineRange | null {
	const match = LINE_HASH.exec(hash);
	if (!match) return null;
	const first = Number(match[1]);
	const last = Number(match[2] ?? match[1]);
	if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last)) return null;
	if (first < 1 || last < 1) return null;
	const max = lineCount && lineCount > 0 ? lineCount : Number.MAX_SAFE_INTEGER;
	const start = Math.min(first, last, max);
	const end = Math.min(Math.max(first, last), max);
	return { start, end };
}

export function formatLineHash(range: LineRange | null) {
	if (!range) return "";
	return range.start === range.end
		? `#L${range.start}`
		: `#L${range.start}-L${range.end}`;
}

export function selectLine(
	current: LineRange | null,
	line: number,
	extend: boolean,
): LineRange | null {
	if (!extend || !current) {
		return current && current.start === line && current.end === line
			? null
			: { start: line, end: line };
	}
	return {
		start: Math.min(current.start, line),
		end: Math.max(current.start, line),
	};
}
