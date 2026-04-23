const TS_PREFIX_RE = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)\s(.*)$/;
const GROUP_RE = /^##\[group\](.*)$/;
const ENDGROUP_RE = /^##\[endgroup\]/;

export type LogLine = {
	ts: string | null;
	text: string;
};

export type LogEntry =
	| { kind: "line"; ts: string | null; text: string }
	| {
			kind: "group";
			id: string;
			name: string;
			ts: string | null;
			children: LogEntry[];
	  };

function stripTimestamp(line: string): LogLine {
	const m = line.match(TS_PREFIX_RE);
	if (!m) return { ts: null, text: line };
	return { ts: m[1] ?? null, text: m[2] ?? "" };
}

function normalizeName(name: string): string {
	return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function matchesStep(groupName: string, stepName: string): boolean {
	const g = normalizeName(groupName);
	const s = normalizeName(stepName);
	if (!s) return false;
	if (g === s) return true;
	if (g === `run ${s}`) return true;
	return false;
}

export type StepLogRange = {
	startedAt?: string | null;
	completedAt?: string | null;
};

function extractByGroup(
	lines: string[],
	stepName: string,
	range?: StepLogRange,
): LogEntry[] {
	const groups = findTopLevelGroups(lines);
	if (groups.length === 0) return [];

	const chosen = pickBestGroup(groups, stepName, range);
	if (!chosen) return [];
	return buildGroupEntries(lines, chosen.start);
}

type TopLevelGroup = { start: number; ts: string | null; name: string };

function findTopLevelGroups(lines: string[]): TopLevelGroup[] {
	const out: TopLevelGroup[] = [];
	let depth = 0;
	for (let i = 0; i < lines.length; i++) {
		const raw = lines[i];
		if (raw == null) continue;
		const { text, ts } = stripTimestamp(raw);
		const gm = text.match(GROUP_RE);
		if (gm) {
			if (depth === 0) {
				out.push({ start: i, ts, name: gm[1] ?? "" });
			}
			depth++;
			continue;
		}
		if (ENDGROUP_RE.test(text) && depth > 0) {
			depth--;
		}
	}
	return out;
}

const GROUP_TS_TOLERANCE_MS = 3000;

function pickBestGroup(
	groups: TopLevelGroup[],
	stepName: string,
	range?: StepLogRange,
): TopLevelGroup | null {
	const startMs = range?.startedAt ? Date.parse(range.startedAt) : null;
	const endMs = range?.completedAt ? Date.parse(range.completedAt) : null;

	const inRange =
		startMs != null || endMs != null
			? groups.filter((g) => {
					if (!g.ts) return false;
					const t = Date.parse(g.ts);
					if (!Number.isFinite(t)) return false;
					if (startMs != null && t < startMs - GROUP_TS_TOLERANCE_MS) {
						return false;
					}
					if (endMs != null && t > endMs + GROUP_TS_TOLERANCE_MS) return false;
					return true;
				})
			: null;

	if (inRange && inRange.length > 0) {
		const named = inRange.find((g) => matchesStep(g.name, stepName));
		if (named) return named;
		if (startMs != null) {
			let best = inRange[0] as TopLevelGroup;
			let bestDelta = Number.POSITIVE_INFINITY;
			for (const g of inRange) {
				const t = g.ts ? Date.parse(g.ts) : Number.NaN;
				if (!Number.isFinite(t)) continue;
				const delta = Math.abs(t - startMs);
				if (delta < bestDelta) {
					bestDelta = delta;
					best = g;
				}
			}
			return best;
		}
		return inRange[0] ?? null;
	}

	return groups.find((g) => matchesStep(g.name, stepName)) ?? null;
}

function buildGroupEntries(lines: string[], startIdx: number): LogEntry[] {
	const root: LogEntry[] = [];
	const stack: LogEntry[][] = [root];
	let depth = 0;
	let groupCounter = 0;

	for (let i = startIdx; i < lines.length; i++) {
		const raw = lines[i];
		if (raw == null) continue;
		const { text, ts } = stripTimestamp(raw);

		const gm = text.match(GROUP_RE);
		if (gm) {
			depth++;
			if (depth === 1) continue;
			groupCounter++;
			const group: LogEntry = {
				kind: "group",
				id: `g-${groupCounter}`,
				name: gm[1] ?? "",
				ts,
				children: [],
			};
			const parent = stack[stack.length - 1];
			if (parent) parent.push(group);
			stack.push(group.children);
			continue;
		}
		if (ENDGROUP_RE.test(text)) {
			depth--;
			if (depth <= 0) return root;
			if (stack.length > 1) stack.pop();
			continue;
		}
		const target = stack[stack.length - 1];
		if (target) target.push({ kind: "line", ts, text });
	}
	return root;
}

function extractByTimeRange(lines: string[], range: StepLogRange): LogEntry[] {
	const startMs = range.startedAt ? Date.parse(range.startedAt) : null;
	const endMs = range.completedAt ? Date.parse(range.completedAt) : null;
	if (startMs == null && endMs == null) return [];

	const root: LogEntry[] = [];
	const stack: LogEntry[][] = [root];
	let groupCounter = 0;

	for (const raw of lines) {
		const parsed = stripTimestamp(raw);
		if (!parsed.ts) continue;
		const t = Date.parse(parsed.ts);
		if (!Number.isFinite(t)) continue;
		if (startMs != null && t < startMs) continue;
		if (endMs != null && t > endMs) continue;

		const { text, ts } = parsed;
		const gm = text.match(GROUP_RE);
		if (gm) {
			groupCounter++;
			const group: LogEntry = {
				kind: "group",
				id: `g-${groupCounter}`,
				name: gm[1] ?? "",
				ts,
				children: [],
			};
			const parent = stack[stack.length - 1];
			if (parent) parent.push(group);
			stack.push(group.children);
			continue;
		}
		if (ENDGROUP_RE.test(text)) {
			if (stack.length > 1) stack.pop();
			continue;
		}
		const target = stack[stack.length - 1];
		if (target) target.push({ kind: "line", ts, text });
	}
	return root;
}

export type ExtractStrategy = "group" | "time-range" | "empty";

export type ExtractResult = {
	entries: LogEntry[];
	strategy: ExtractStrategy;
};

export function extractStepLog(
	fullLog: string,
	stepName: string,
	range?: StepLogRange,
): ExtractResult {
	if (!fullLog) return { entries: [], strategy: "empty" };
	const lines = fullLog.split(/\r?\n/);
	const byGroup = extractByGroup(lines, stepName, range);
	if (byGroup.length > 0) return { entries: byGroup, strategy: "group" };
	if (range) {
		const byTime = extractByTimeRange(lines, range);
		if (byTime.length > 0) return { entries: byTime, strategy: "time-range" };
	}
	return { entries: [], strategy: "empty" };
}

export function collectGroupHeaders(fullLog: string, limit = 40): string[] {
	const out: string[] = [];
	for (const raw of fullLog.split(/\r?\n/)) {
		const { text } = stripTimestamp(raw);
		if (text.startsWith("##[group]")) {
			out.push(text.slice("##[group]".length));
			if (out.length >= limit) break;
		}
	}
	return out;
}

export function countEntryLines(entries: LogEntry[]): number {
	let n = 0;
	for (const e of entries) {
		if (e.kind === "line") n++;
		else n += 1 + countEntryLines(e.children);
	}
	return n;
}
