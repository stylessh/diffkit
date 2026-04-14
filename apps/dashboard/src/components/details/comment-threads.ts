type CommentLike = {
	id: number;
	body: string;
	author: { login: string } | null;
};

/**
 * Detects reply relationships between comments by matching blockquote
 * patterns: `> **@user** [commented](#issuecomment-ID):` or
 * simple `> @user` prefix with quoted text matching a prior comment.
 */
export function buildCommentThreads<T extends CommentLike>(
	comments: T[],
): {
	repliesByCommentId: Map<number, T[]>;
	replyIds: Set<number>;
} {
	const repliesByCommentId = new Map<number, T[]>();
	const replyIds = new Set<number>();
	const commentById = new Map<number, T>();

	for (const c of comments) {
		commentById.set(c.id, c);
	}

	for (const comment of comments) {
		const body = comment.body;
		if (!body.startsWith(">")) continue;

		// Match our reply format: > **@user** [commented](#issuecomment-ID):
		const linkMatch = body.match(
			/^>\s*\*?\*?@(\S+)\*?\*?\s*\[commented\]\(#issuecomment-(\d+)\)/,
		);
		if (linkMatch) {
			const parentId = Number(linkMatch[2]);
			if (commentById.has(parentId)) {
				const existing = repliesByCommentId.get(parentId) ?? [];
				existing.push(comment);
				repliesByCommentId.set(parentId, existing);
				replyIds.add(comment.id);
				continue;
			}
		}

		// Fallback: match `> @user wrote:` or `> @user` pattern then fuzzy-match quoted text
		const simpleMatch = body.match(/^>\s*@(\S+)/);
		if (!simpleMatch) continue;

		const quotedAuthor = simpleMatch[1].replace(/[*:]/g, "");
		const quotedLines = body
			.split("\n")
			.filter((l) => l.startsWith("> "))
			.map((l) => l.slice(2).trim())
			.filter((l) => !l.startsWith("**@") && !l.startsWith("@"));

		if (quotedLines.length === 0) continue;

		const quotedSnippet = quotedLines[0].slice(0, 60);
		if (quotedSnippet.length < 10) continue;

		// Walk backwards looking for a matching parent
		for (let i = comments.indexOf(comment) - 1; i >= 0; i--) {
			const candidate = comments[i];
			if (
				candidate.author?.login === quotedAuthor &&
				candidate.body.includes(quotedSnippet)
			) {
				const existing = repliesByCommentId.get(candidate.id) ?? [];
				existing.push(comment);
				repliesByCommentId.set(candidate.id, existing);
				replyIds.add(comment.id);
				break;
			}
		}
	}

	return { repliesByCommentId, replyIds };
}
