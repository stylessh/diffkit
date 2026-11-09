/** Markdown's marks dropped, for a one-line plain-text excerpt. */
export function plainExcerpt(body: string) {
	return body
		.replace(/<!--[\s\S]*?-->/g, " ")
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
		.replace(/^#+\s.*$/gm, " ")
		.replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, " ")
		.replace(/`+/g, "")
		.replace(/[*_>|]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}
