const MAX_EXCERPT_LENGTH = 220;

const CLEANUPS: [RegExp, string][] = [
	[/```[\s\S]*?(```|$)/gu, " "],
	[/<!--[\s\S]*?-->/gu, " "],
	[/<\/?[a-z][^>]*>/giu, " "],
	[/!\[[^\]]*\]\([^)]*\)/gu, " "],
	[/\[([^\]]+)\]\([^)]*\)/gu, "$1"],
	[/^\s{0,3}(?:#{1,6}\s+|>\s?|[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+)/gmu, ""],
	[/\[\^[^\]]+\]/gu, ""],
	[/(\*\*|__|~~|`)/gu, ""],
	[/(^|\s)[*_](\S[^*_]*)[*_](?=\s|$|[.,;:!?])/gu, "$1$2"],
	[/\s+/gu, " "],
];

/** Plain-text preview of a markdown body for hover cards and previews. */
export function markdownExcerpt(markdown: string | null | undefined) {
	if (!markdown) return null;
	const text = CLEANUPS.reduce(
		(current, [pattern, replacement]) => current.replace(pattern, replacement),
		markdown,
	).trim();
	if (!text) return null;
	if (text.length <= MAX_EXCERPT_LENGTH) return text;
	const cut = text.slice(0, MAX_EXCERPT_LENGTH);
	return `${cut.slice(0, cut.lastIndexOf(" ")).trimEnd()}…`;
}
