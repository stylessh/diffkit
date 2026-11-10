import type { DiffFile } from "./diff-files";

export type SettledDiff =
	| { phase: "complete"; files: readonly DiffFile[] }
	| { phase: "too-large" };

const MAX_RAW_CHARACTERS = 8_000_000;

const settled = new Map<string, { diff: SettledDiff; rawCharacters: number }>();
let heldCharacters = 0;

/**
 * Parsed diffs of the revisions opened most recently in this tab. A revision
 * is immutable, so coming back to one paints from here on the first frame
 * instead of re-reading and re-parsing its raw diff.
 */
export function recallSettledDiff(revision: string): SettledDiff | undefined {
	return settled.get(revision)?.diff;
}

export function rememberSettledDiff(
	revision: string,
	diff: SettledDiff,
	rawCharacters: number,
) {
	if (rawCharacters > MAX_RAW_CHARACTERS) return;
	forget(revision);
	settled.set(revision, { diff, rawCharacters });
	heldCharacters += rawCharacters;
	for (const oldest of settled.keys()) {
		if (heldCharacters <= MAX_RAW_CHARACTERS) break;
		forget(oldest);
	}
}

function forget(revision: string) {
	const entry = settled.get(revision);
	if (!entry) return;
	settled.delete(revision);
	heldCharacters -= entry.rawCharacters;
}
