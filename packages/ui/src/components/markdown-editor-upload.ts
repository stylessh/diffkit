/** Machine-readable token embedded in the composer; replaced when the upload finishes. */
export function getCommentMediaUploadToken(id: string): string {
	return `[[DIFFKIT_UPLOAD:${id}]]`;
}

/** User-facing line inserted while a comment attachment uploads. */
export function getCommentMediaUploadPlaceholderText(
	id: string,
	fileName?: string,
): string {
	const trimmedName = fileName?.trim();
	const label =
		trimmedName && trimmedName.length > 0
			? `⏳ Uploading “${trimmedName}”…`
			: "⏳ Uploading asset…";
	return `${label} ${getCommentMediaUploadToken(id)}`;
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Locate a pending upload placeholder line (or just its token) in the composer text. */
export function findCommentMediaUploadPlaceholderRange(
	content: string,
	id: string,
): { from: number; to: number } | null {
	const token = getCommentMediaUploadToken(id);
	const line = new RegExp(
		`⏳ Uploading[^\\n]*?\\s*${escapeRegExp(token)}`,
		"u",
	);
	const match = line.exec(content);
	if (match) {
		return { from: match.index, to: match.index + match[0].length };
	}
	const tokenIndex = content.indexOf(token);
	if (tokenIndex >= 0) {
		return { from: tokenIndex, to: tokenIndex + token.length };
	}
	return null;
}

/** Swap a pending upload placeholder for final markdown/HTML (or an error line). */
export function replaceCommentMediaUploadPlaceholder(
	content: string,
	id: string,
	replacement: string,
): string {
	const range = findCommentMediaUploadPlaceholderRange(content, id);
	if (!range) return content;
	return `${content.slice(0, range.from)}${replacement}${content.slice(range.to)}`;
}
