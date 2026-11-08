import type { Parent } from "unist";
import { visit } from "unist-util-visit";
import {
	MARKDOWN_REFERENCE_TAG,
	type MarkdownReferenceResolver,
	type ResourceReference,
	referenceToHProperties,
} from "./markdown-resource-reference";

type MdText = { type: "text"; value: string };

type MdLink = {
	type: "link";
	url: string;
	children: { type: string; value?: string }[];
	data?: Record<string, unknown>;
};

/** Compact identifier shown when no richer label is available yet. */
function defaultLabel(ref: ResourceReference): string {
	switch (ref.kind) {
		case "user":
			return `@${ref.login}`;
		case "repo":
			return `${ref.owner}/${ref.repo}`;
		case "pull":
		case "issue":
			return `${ref.owner}/${ref.repo}#${ref.number}`;
		case "release":
			return `${ref.owner}/${ref.repo}@${ref.tag}`;
		default:
			return "";
	}
}

/**
 * Turn bare resource URLs into rich reference nodes. Only *autolinks* (where the
 * link text equals the URL, i.e. a pasted/literal link) are transformed, so an
 * explicit `[label](url)` keeps the author's chosen text — mirroring GitHub.
 *
 * Must run after `remark-gfm` so literal URLs have already become link nodes.
 */
export function remarkResourceReferences(resolve: MarkdownReferenceResolver) {
	return () => (tree: Parent) => {
		visit(tree, "link", (node): void => {
			const link = node as unknown as MdLink;
			if (link.children.length !== 1) return;
			const child = link.children[0] as MdText | undefined;
			if (child?.type !== "text" || child.value !== link.url) return;

			const ref = resolve(link.url);
			if (!ref) return;

			link.data = {
				...(link.data ?? {}),
				hName: MARKDOWN_REFERENCE_TAG,
				hProperties: referenceToHProperties(ref),
			};
			link.children = [{ type: "text", value: defaultLabel(ref) }];
		});
	};
}
