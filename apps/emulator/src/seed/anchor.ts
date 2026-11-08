/**
 * Every seeded timestamp is an offset before this anchor, so the workspace is
 * byte-for-byte reproducible (same SHAs, same screenshots). Set
 * `DIFFKIT_DEMO_ANCHOR=now` to make the data look fresh instead, or pass any
 * ISO date.
 */
import type { Ago } from "./types";

export const DEFAULT_DEMO_ANCHOR = "2026-11-02T17:00:00.000Z";

export function resolveAnchor(value = process.env.DIFFKIT_DEMO_ANCHOR) {
	if (value === "now") {
		const now = new Date();
		now.setUTCMinutes(0, 0, 0);
		return now;
	}
	const parsed = new Date(value ?? DEFAULT_DEMO_ANCHOR);
	if (Number.isNaN(parsed.getTime())) {
		throw new Error(`Invalid DIFFKIT_DEMO_ANCHOR: ${value}`);
	}
	return parsed;
}

export function createClock(anchor: Date) {
	return (ago: Ago) =>
		new Date(
			anchor.getTime() -
				((ago.d * 24 + (ago.h ?? 0)) * 60 + (ago.m ?? 0)) * 60 * 1000,
		).toISOString();
}

export type Clock = ReturnType<typeof createClock>;
