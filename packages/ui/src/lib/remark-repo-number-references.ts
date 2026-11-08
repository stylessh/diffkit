import type { Parent } from "unist";
import {
	MARKDOWN_REFERENCE_TAG,
	type ResourceReference,
	referenceToHProperties,
} from "./markdown-resource-reference";

type MdText = { type: "text"; value: string };
type PhrasingParent = Parent & { children: MdText[] };
type PhrasingChunk = MdText | { type: string; [key: string]: unknown };

type MdNode = {
	type: string;
	children?: MdNode[];
};

/** `#123` in repo-scoped markdown. `##123` stays a literal `#123` (no reference). */
const REPO_NUMBER = /(^|[^\w/#])#(\d+)\b/g;
const REPO_NUMBER_LITERAL = /(^|[^\w/#])##(\d+)\b/g;

type RepoNumberMatch = {
	index: number;
	full: string;
	prefix: string;
	digits: string;
	literal: boolean;
};

function collectRepoNumberMatches(str: string): RepoNumberMatch[] {
	const matches: RepoNumberMatch[] = [];
	for (const match of str.matchAll(REPO_NUMBER_LITERAL)) {
		matches.push({
			index: match.index ?? 0,
			full: match[0],
			prefix: match[1] ?? "",
			digits: match[2],
			literal: true,
		});
	}
	for (const match of str.matchAll(REPO_NUMBER)) {
		matches.push({
			index: match.index ?? 0,
			full: match[0],
			prefix: match[1] ?? "",
			digits: match[2],
			literal: false,
		});
	}
	return matches.sort((a, b) => a.index - b.index);
}

/**
 * Turn `#123` into rich reference nodes when the app supplies a resolver for the
 * current repository. Skips text inside links.
 */
export function remarkRepoNumberReferences(
	resolve: (number: number) => ResourceReference | null,
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
				if (!str.includes("#")) continue;

				const matches = collectRepoNumberMatches(str);
				if (matches.length === 0) continue;

				const nodes: PhrasingChunk[] = [];
				let last = 0;
				for (const match of matches) {
					const i = match.index;
					if (i < last) continue;
					const { full, prefix, digits, literal } = match;
					if (i > last) {
						nodes.push({ type: "text", value: str.slice(last, i) });
					}
					if (prefix) {
						nodes.push({ type: "text", value: prefix });
					}
					if (literal) {
						nodes.push({ type: "text", value: `#${digits}` });
						last = i + full.length;
						continue;
					}
					const number = Number(digits);
					const ref =
						Number.isSafeInteger(number) && number > 0 ? resolve(number) : null;
					if (ref) {
						nodes.push({
							type: "link",
							url: ref.href,
							data: {
								hName: MARKDOWN_REFERENCE_TAG,
								hProperties: referenceToHProperties(ref),
							},
							children: [{ type: "text", value: `#${digits}` }],
						});
					} else {
						nodes.push({ type: "text", value: `#${digits}` });
					}
					last = i + full.length;
				}
				if (last < str.length) {
					nodes.push({ type: "text", value: str.slice(last) });
				}
				parent.children.splice(index, 1, ...(nodes as MdText[]));
			}
		};

		visitChildren(tree as PhrasingParent);
	};
}
