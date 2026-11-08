import type { Parent } from "unist";

export type MdText = { type: "text"; value: string };

export type MdLink = {
	type: "link";
	url: string;
	data?: Record<string, unknown>;
	children: MdText[];
};

type MdNode = { type: string; value?: string; children?: MdNode[] };

const LINK_TYPES = new Set(["link", "linkReference"]);

/**
 * Replaces each `pattern` match inside text nodes with the node `toNode`
 * returns (or leaves the match as text when it returns `null`). Text inside
 * links is never touched, so a token can't become a link nested in a link.
 * `pattern` must be global; group 1, when present, is a leading boundary
 * character that stays as plain text.
 */
export function replaceTextTokens(
	tree: Parent,
	pattern: RegExp,
	toNode: (match: RegExpMatchArray) => MdLink | null,
) {
	const visit = (parent: MdNode) => {
		const children = parent.children;
		if (!children) {
			return;
		}
		for (let index = children.length - 1; index >= 0; index -= 1) {
			const child = children[index];
			if (LINK_TYPES.has(child.type)) {
				continue;
			}
			if (child.type !== "text") {
				visit(child);
				continue;
			}
			const replacement = tokenize(child.value ?? "", pattern, toNode);
			if (replacement) {
				children.splice(index, 1, ...replacement);
			}
		}
	};
	visit(tree as MdNode);
}

function tokenize(
	text: string,
	pattern: RegExp,
	toNode: (match: RegExpMatchArray) => MdLink | null,
): MdNode[] | null {
	const nodes: MdNode[] = [];
	let last = 0;
	for (const match of text.matchAll(pattern)) {
		const link = toNode(match);
		if (!link) {
			continue;
		}
		const boundary = match[1] ?? "";
		const start = (match.index ?? 0) + boundary.length;
		if (start > last) {
			nodes.push({ type: "text", value: text.slice(last, start) });
		}
		nodes.push(link);
		last = (match.index ?? 0) + match[0].length;
	}
	if (nodes.length === 0) {
		return null;
	}
	if (last < text.length) {
		nodes.push({ type: "text", value: text.slice(last) });
	}
	return nodes;
}
