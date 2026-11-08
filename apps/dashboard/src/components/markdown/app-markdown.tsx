import {
	Markdown,
	type MarkdownInternalLinkProps,
} from "@diffkit/ui/components/markdown";
import { Link } from "@tanstack/react-router";
import { type ComponentProps, useMemo } from "react";
import {
	createTextReferenceResolver,
	resolveGitHubLinkUrl,
	resolveGitHubUrlReference,
} from "#/lib/github-links";
import { MarkdownMention } from "./markdown-mention";
import { MarkdownReference } from "./markdown-reference";

function MarkdownRouterLink({
	href,
	className,
	children,
}: MarkdownInternalLinkProps) {
	return (
		<Link to={href} className={className}>
			{children}
		</Link>
	);
}

function mentionHref(login: string) {
	return `/${login}`;
}

type AppMarkdownProps = Pick<
	ComponentProps<typeof Markdown>,
	"children" | "className" | "resolveAssetUrl"
> & {
	/** The repository `#12` and bare SHAs refer to. */
	owner?: string;
	repo?: string;
};

/**
 * GitHub-flavoured markdown for user content: autolinked references and
 * github.com URLs open in-app routes and show hover cards.
 */
export function AppMarkdown({
	owner,
	repo,
	children,
	className,
	resolveAssetUrl,
}: AppMarkdownProps) {
	const resolveTextReference = useMemo(
		() => createTextReferenceResolver(owner && repo ? { owner, repo } : null),
		[owner, repo],
	);

	return (
		<Markdown
			className={className}
			resolveAssetUrl={resolveAssetUrl}
			resolveLinkUrl={resolveGitHubLinkUrl}
			resolveReference={resolveGitHubUrlReference}
			resolveTextReference={resolveTextReference}
			resolveMentionHref={mentionHref}
			internalLinkComponent={MarkdownRouterLink}
			mentionComponent={MarkdownMention}
			referenceComponent={MarkdownReference}
		>
			{children}
		</Markdown>
	);
}
