const SPECIAL_KEY_NAMES = new Set([
	"command",
	"cmd",
	"\u2318",
	"shift",
	"option",
	"alt",
	"control",
	"ctrl",
	"space",
	"return",
	"enter",
	"\u2190",
	"\u2192",
	"meta",
	"mod",
]);

/** Single-letter chord keys (e.g. G, U in "Go to profile"). */
export function isPlainLetterShortcutKey(key: string): boolean {
	return /^[A-Za-z]$/.test(key.trim());
}

export function isSpecialShortcutKey(key: string): boolean {
	const trimmed = key.trim();
	if (!trimmed) return true;
	if (isPlainLetterShortcutKey(trimmed)) return false;
	if (SPECIAL_KEY_NAMES.has(trimmed.toLowerCase())) return true;
	// Ranges, symbols, multi-char labels (e.g. 1–9), arrows as words, etc.
	return trimmed.length !== 1;
}

/** Letter-only sequences render as one chip: "S then S". */
export function shouldCombineShortcutKeys(keys: readonly string[]): boolean {
	return keys.length > 1 && keys.every((key) => isPlainLetterShortcutKey(key));
}

export function formatCombinedShortcutKeys(keys: readonly string[]): string {
	return keys.join(" then ");
}
