import type { AreaMatch } from "./path-rules";

export type ChangedFile = {
	path: string;
	additions: number;
	deletions: number;
};

/** How much of one pull request lands on one product area, by lines changed. */
export type WorkPart = { area: string; lines: number; share: number };

/**
 * Splits a pull request's changed lines across the areas its files belong to,
 * largest first. Ignored and unmapped files are left out of the total, so a
 * share is the area's part of the change the map can place.
 *
 * A change with no countable lines (renames, binary files) still touches its
 * areas: they are kept, and shared out by file count instead.
 */
export function pullParts(
	files: readonly ChangedFile[],
	match: (path: string) => AreaMatch,
): WorkPart[] {
	const touched = new Map<string, { lines: number; files: number }>();
	for (const file of files) {
		const found = match(file.path);
		if (found.kind !== "area") continue;
		const area = touched.get(found.area) ?? { lines: 0, files: 0 };
		area.lines += file.additions + file.deletions;
		area.files += 1;
		touched.set(found.area, area);
	}
	const totals = { lines: 0, files: 0 };
	for (const area of touched.values()) {
		totals.lines += area.lines;
		totals.files += area.files;
	}
	const weigh = totals.lines > 0 ? "lines" : "files";
	return [...touched]
		.map(([area, counts]) => ({
			area,
			lines: counts.lines,
			share: counts[weigh] / totals[weigh],
		}))
		.sort((a, b) => b.share - a.share || a.area.localeCompare(b.area));
}

const FIX_TITLE = /\b(hot)?fix(es|ed)?\b|^revert|^harden|^stabilize|^handle /i;
const FEATURE_PREFIX = /^feat\b(?!.*\bfix)/i;

/** A guess from the title alone; a `feat:` prefix wins unless it also says fix. */
export function isFixTitle(title: string) {
	return !FEATURE_PREFIX.test(title) && FIX_TITLE.test(title);
}

const WEEK_MS = 7 * 86_400_000;

/** Monday 00:00 UTC of the week `date` falls in. */
export function weekStartOf(date: Date) {
	const day = (date.getUTCDay() + 6) % 7;
	return Date.UTC(
		date.getUTCFullYear(),
		date.getUTCMonth(),
		date.getUTCDate() - day,
	);
}

/** Counts per week from `firstWeek` (a Monday, ms) for `weeks` weeks; dates outside are dropped. */
export function weeklyCounts(
	dates: readonly string[],
	firstWeek: number,
	weeks: number,
) {
	const counts = new Array<number>(weeks).fill(0);
	for (const date of dates) {
		const index = Math.floor((new Date(date).getTime() - firstWeek) / WEEK_MS);
		if (index >= 0 && index < weeks) counts[index] += 1;
	}
	return counts;
}
