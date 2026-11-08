import type { Parent } from "unist";
import { visit } from "unist-util-visit";
import {
	MARKDOWN_REFERENCE_TAG,
	type MarkdownReferenceResolver,
	type ResourceReference,
	referenceToHProperties,
} from "./markdown-resource-reference";
import type { MdLink } from "./mdast-text-tokens";

function defaultLabel(ref: ResourceReference): string {
	switch (ref.kind) {
		case "user":
			return `@${ref.login}`;
		case "repo":
			return `${ref.owner}/${ref.repo}`;
		case "pull":
		case "issue":
		case "issueOrPull":
			return `${ref.owner}/${ref.repo}#${ref.number}`;
		case "commit":
			return `${ref.owner}/${ref.repo}@${ref.sha.slice(0, 7)}`;
		case "release":
			return `${ref.owner}/${ref.repo}@${ref.tag}`;
	}
}

/**
 * Turns bare resource URLs into reference nodes. Only autolinks (link text
 * equal to the URL) change, so an explicit `[label](url)` keeps the author's
 * text, as on GitHub. Must run after `remark-gfm` has made literal URLs links.
 */
export function remarkResourceReferences(resolve: MarkdownReferenceResolver) {
	return () => (tree: Parent) => {
		visit(tree, "link", (node): void => {
			const link = node as unknown as MdLink;
			if (link.children.length !== 1) {
				return;
			}
			const child = link.children[0];
			if (child?.type !== "text" || child.value !== link.url) {
				return;
			}

			const ref = resolve(link.url);
			if (!ref) {
				return;
			}

			link.data = {
				...(link.data ?? {}),
				hName: MARKDOWN_REFERENCE_TAG,
				hProperties: referenceToHProperties(ref, "url"),
			};
			link.children = [{ type: "text", value: defaultLabel(ref) }];
		});
	};
}
