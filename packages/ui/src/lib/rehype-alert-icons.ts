import type { Element, Root } from "hast";
import { getAlertIcon } from "remark-github-blockquote-alert";
import { visit } from "unist-util-visit";

const ALERT_TYPES = ["note", "tip", "important", "warning", "caution"] as const;
type AlertType = (typeof ALERT_TYPES)[number];

function classList(node: Element): string[] {
	const value = node.properties?.className;
	if (Array.isArray(value)) return value.map(String);
	if (typeof value === "string") return value.split(/\s+/u);
	return [];
}

function alertTypeOf(node: Element): AlertType | null {
	const classes = classList(node);
	if (!classes.includes("markdown-alert")) return null;
	for (const type of ALERT_TYPES) {
		if (classes.includes(`markdown-alert-${type}`)) return type;
	}
	return null;
}

type IconNode = {
	data?: { hProperties?: Record<string, unknown> };
	children?: IconNode[];
};

function buildIcon(type: AlertType): Element | null {
	// `getAlertIcon` returns an mdast node tagged for remark-rehype (svg > path).
	const icon = getAlertIcon(type) as unknown as IconNode;
	const pathD = icon.children?.[0]?.data?.hProperties?.d;
	if (typeof pathD !== "string") return null;
	return {
		type: "element",
		tagName: "svg",
		properties: (icon.data?.hProperties ?? {}) as Element["properties"],
		children: [
			{
				type: "element",
				tagName: "path",
				properties: { d: pathD },
				children: [],
			},
		],
	};
}

/**
 * Re-attaches the GitHub alert icon after `rehype-sanitize` has run.
 *
 * The sanitizer deliberately drops every `<svg>` from user markdown, which also
 * removes the icon `remark-github-blockquote-alert` generates. The icon markup
 * comes from that trusted package (never from user input), so it is safe to
 * append once sanitizing is done.
 */
export function rehypeAlertIcons() {
	return (tree: Root) => {
		visit(tree, "element", (node: Element) => {
			const type = alertTypeOf(node);
			if (!type) return;
			for (const child of node.children) {
				if (
					child.type === "element" &&
					child.tagName === "p" &&
					classList(child).includes("markdown-alert-title")
				) {
					const icon = buildIcon(type);
					if (icon) child.children.unshift(icon);
					return;
				}
			}
		});
	};
}
