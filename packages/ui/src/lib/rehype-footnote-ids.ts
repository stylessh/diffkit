import type { Root } from "hast";
import { visit } from "unist-util-visit";

const PREFIX = "user-content-";

/**
 * remark-rehype already prefixes footnote ids with `user-content-`, and the
 * sanitizer prefixes every id again to prevent DOM clobbering, so footnote
 * hrefs (`#user-content-fn-1`) would miss their targets. Runs after sanitizing
 * and only drops the duplicate, so every id keeps one prefix.
 */
export function rehypeFootnoteIds() {
	return (tree: Root) => {
		visit(tree, "element", (node) => {
			const id = node.properties?.id;
			if (typeof id === "string" && id.startsWith(PREFIX + PREFIX)) {
				node.properties.id = id.slice(PREFIX.length);
			}
		});
	};
}
