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
 * largest first. Ignored and unmapped files are left out of the total, so the
 * shares describe the part of the change the map can place.
 */
export function pullParts(
	files: readonly ChangedFile[],
	match: (path: string) => AreaMatch,
): WorkPart[] {
	const lines = new Map<string, number>();
	for (const file of files) {
		const found = match(file.path);
		if (found.kind !== "area") continue;
		lines.set(
			found.area,
			(lines.get(found.area) ?? 0) + file.additions + file.deletions,
		);
	}
	const total = [...lines.values()].reduce((sum, value) => sum + value, 0);
	return [...lines]
		.filter(([, value]) => value > 0)
		.map(([area, value]) => ({ area, lines: value, share: value / total }))
		.sort((a, b) => b.lines - a.lines);
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
