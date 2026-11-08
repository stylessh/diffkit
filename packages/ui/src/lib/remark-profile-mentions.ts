import type { Parent } from "unist";
import { MARKDOWN_MENTION_TAG } from "./markdown-resource-reference";

type MdText = {
	type: "text";
	value: string;
};

type MdMention = {
	/** Kept as a `link` so it stays valid mdast phrasing content; `data.hName`
	 * re-tags it as a `<dk-mention>` element during the mdast→hast step. */
	type: "link";
	url: string;
	data: {
		hName: typeof MARKDOWN_MENTION_TAG;
		hProperties: { login: string; href: string };
	};
	children: [MdText];
};

type PhrasingChunk = MdText | MdMention;

type PhrasingParent = Parent & { children: PhrasingChunk[] };

type MdNode = {
	type: string;
	children?: MdNode[];
};

/** GitHub-style @login (alphanumeric + interior hyphens). Not emails: requires non-word before @. */
const MENTION = /(^|[^\w/])@([a-zA-Z\d](?:[a-zA-Z\d]|-(?=[a-zA-Z\d]))*)/g;

/**
 * Turn @username in markdown text into `<dk-mention>` nodes (rendered with a
 * profile hover card by the app). Skips text inside links. `resolveHref`
 * returns undefined to leave the mention as plain text.
 */
export function remarkProfileMentions(
	resolveHref: (login: string) => string | undefined,
) {
	return () => (tree: Parent) => {
		const visitChildren = (parent: PhrasingParent): void => {
			for (let index = parent.children.length - 1; index >= 0; index -= 1) {
				const child = parent.children[index] as MdNode;
				if (child.type === "link" || child.type === "linkReference") continue;
				if (child.type !== "text") {
					if (child.children) {
						visitChildren(child as PhrasingParent);
					}
					continue;
				}

				const textNode = child as MdText;
				const str = textNode.value;
				if (!str.includes("@")) continue;

				const matches = [...str.matchAll(MENTION)];
				if (matches.length === 0) continue;

				const nodes: PhrasingChunk[] = [];
				let last = 0;
				for (const match of matches) {
					const i = match.index ?? 0;
					const full = match[0];
					const prefix = match[1];
					const login = match[2];
					if (i > last) {
						nodes.push({ type: "text", value: str.slice(last, i) });
					}
					if (prefix) {
						nodes.push({ type: "text", value: prefix });
					}
					const href = resolveHref(login);
					if (href) {
						nodes.push({
							type: "link",
							url: href,
							data: {
								hName: MARKDOWN_MENTION_TAG,
								hProperties: { login, href },
							},
							children: [{ type: "text", value: `@${login}` }],
						});
					} else {
						nodes.push({ type: "text", value: `@${login}` });
					}
					last = i + full.length;
				}
				if (last < str.length) {
					nodes.push({ type: "text", value: str.slice(last) });
				}
				parent.children.splice(index, 1, ...nodes);
			}
		};

		visitChildren(tree as PhrasingParent);
	};
}
