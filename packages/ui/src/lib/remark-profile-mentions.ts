import type { Parent } from "unist";
import { MARKDOWN_MENTION_TAG } from "./markdown-resource-reference";
import { replaceTextTokens } from "./mdast-text-tokens";

/**
 * GitHub logins: alphanumerics with interior hyphens. The leading boundary
 * keeps emails out, and the trailing one keeps `@org/team` out (team
 * mentions are not profiles).
 */
const MENTION =
	/(^|[^\w/])@([a-zA-Z\d](?:[a-zA-Z\d]|-(?=[a-zA-Z\d])){0,38})(?![\w/])/gu;

export function remarkProfileMentions(
	resolveHref: (login: string) => string | undefined,
) {
	return () => (tree: Parent) =>
		replaceTextTokens(tree, MENTION, (match) => {
			const login = match[2];
			const href = resolveHref(login);
			if (!href) {
				return null;
			}
			return {
				type: "link",
				url: href,
				data: {
					hName: MARKDOWN_MENTION_TAG,
					hProperties: { login, href },
				},
				children: [{ type: "text", value: `@${login}` }],
			};
		});
}
