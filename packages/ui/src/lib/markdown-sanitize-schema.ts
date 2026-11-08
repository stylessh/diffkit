import {
	defaultSchema,
	type Options as RehypeSanitizeSchema,
} from "rehype-sanitize";
import {
	MARKDOWN_MENTION_TAG,
	MARKDOWN_REFERENCE_ATTRIBUTES,
	MARKDOWN_REFERENCE_TAG,
} from "./markdown-resource-reference";

/**
 * GitHub-style defaults from `rehype-sanitize`, plus tags/classes used by our
 * markdown renderer: GFM alerts (`div` or `blockquote`; the icon is re-attached by `rehypeAlertIcons`), video embeds, tight iframes (`src` only —
 * `srcdoc` is not allowed), and the `<dk-mention>` / `<dk-reference>` elements
 * our remark plugins emit for rich @mentions and resource references.
 */
export const markdownSanitizeSchema: RehypeSanitizeSchema = {
	...defaultSchema,
	tagNames: [
		...(defaultSchema.tagNames ?? []),
		"iframe",
		"video",
		MARKDOWN_MENTION_TAG,
		MARKDOWN_REFERENCE_TAG,
	],
	attributes: {
		...defaultSchema.attributes,
		[MARKDOWN_MENTION_TAG]: ["login", "href"],
		[MARKDOWN_REFERENCE_TAG]: [...MARKDOWN_REFERENCE_ATTRIBUTES],
		blockquote: [
			...(defaultSchema.attributes?.blockquote ?? []),
			["className", /^markdown-alert/],
		],
		div: [
			...(defaultSchema.attributes?.div ?? []),
			["className", /^markdown-alert/],
		],
		p: [
			...(defaultSchema.attributes?.p ?? []),
			["className", "markdown-alert-title"],
		],
		iframe: [
			"ariaDescribedBy",
			"ariaLabel",
			"ariaLabelledBy",
			"src",
			"title",
			"loading",
		],
		video: [
			"ariaDescribedBy",
			"ariaLabel",
			"ariaLabelledBy",
			"src",
			"controls",
			"preload",
			"playsInline",
		],
	},
};
