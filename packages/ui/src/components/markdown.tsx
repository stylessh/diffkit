import { Md } from "@m2d/react-markdown/client";
import type { ComponentType, ImgHTMLAttributes, ReactNode } from "react";
import {
	createContext,
	Suspense,
	use,
	useCallback,
	useContext,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { remarkAlert } from "remark-github-blockquote-alert";
import type { PluggableList } from "unified";
import { CODE_THEME_NAMES } from "../lib/code-theme-names";
import {
	MARKDOWN_MENTION_TAG,
	MARKDOWN_REFERENCE_TAG,
	type MarkdownReferenceResolver,
	type MarkdownTextReferenceResolver,
	type ResourceReference,
	type ResourceReferenceOrigin,
	referenceFromProperties,
	referenceOriginFromProperties,
} from "../lib/markdown-resource-reference";
import { markdownSanitizeSchema } from "../lib/markdown-sanitize-schema";
import {
	markdownAlertBlockquoteClassName,
	markdownAlertTitleClassName,
	markdownBlockquoteClassName,
	markdownCodeBlockFallbackClassName,
	markdownCodeBlockShellClassName,
	markdownCopyButtonClassName,
	markdownDelClassName,
	markdownDetailsClassName,
	markdownEmClassName,
	markdownFootnotesClassName,
	markdownHeadingClassNames,
	markdownHrClassName,
	markdownImageClassName,
	markdownInlineCodeClassName,
	markdownLinkClassName,
	markdownListClassNames,
	markdownMediaClassName,
	markdownParagraphClassName,
	markdownRootClassName,
	markdownStrongClassName,
	markdownSummaryChevronClassName,
	markdownSummaryClassName,
	markdownTableClassName,
	markdownTableShellClassName,
	markdownTaskCheckboxClassName,
	markdownTaskListClassName,
	markdownTdClassName,
	markdownThClassName,
	markdownTheadClassName,
} from "../lib/markdown-theme";
import { rehypeAlertIcons } from "../lib/rehype-alert-icons";
import { rehypeFootnoteIds } from "../lib/rehype-footnote-ids";
import { remarkProfileMentions } from "../lib/remark-profile-mentions";
import { remarkResourceReferences } from "../lib/remark-resource-references";
import { remarkTextReferences } from "../lib/remark-text-references";
import {
	createMarkdownHighlighter,
	type MarkdownHighlighter,
	type ShikiBundledLang,
	shikiBundledLangSet,
} from "../lib/shiki-bundle";
import { cn } from "../lib/utils";

const FENCE_LANG_ALIASES: Record<string, ShikiBundledLang> = {
	shell: "shellscript",
	sh: "shellscript",
	zsh: "shellscript",
	console: "shellscript",
	js: "javascript",
	ts: "typescript",
	py: "python",
	rs: "rust",
	rb: "ruby",
	kt: "kotlin",
	cs: "csharp",
	yml: "yaml",
	gql: "graphql",
	md: "markdown",
};

// Defer Shiki's full language graph until a hydrated code block needs it, then
// share that initialization across every block rendered by this module.
let highlighterPromise: Promise<MarkdownHighlighter> | null = null;

function getHighlighterPromise(): Promise<MarkdownHighlighter> {
	if (typeof window === "undefined") {
		throw new Error("Shiki highlighting is only available after hydration");
	}
	highlighterPromise ??= createMarkdownHighlighter();
	return highlighterPromise;
}

const HIGHLIGHT_CACHE_MAX_ENTRIES = 100;
const HIGHLIGHT_CACHE_MAX_BYTES = 1_000_000;
const HIGHLIGHT_CACHE_MAX_SOURCE_BYTES = 50_000;

type HighlightCacheEntry = {
	promise: Promise<string>;
	bytes: number;
};

const htmlCache = new Map<string, HighlightCacheEntry>();
const textEncoder = new TextEncoder();
let htmlCacheBytes = 0;

function utf8ByteLength(value: string): number {
	return textEncoder.encode(value).byteLength;
}

function deleteHighlightCacheEntry(key: string, entry: HighlightCacheEntry) {
	if (htmlCache.get(key) !== entry) return;
	htmlCache.delete(key);
	htmlCacheBytes -= entry.bytes;
}

function evictHighlightCacheEntries() {
	while (
		htmlCache.size > HIGHLIGHT_CACHE_MAX_ENTRIES ||
		htmlCacheBytes > HIGHLIGHT_CACHE_MAX_BYTES
	) {
		const oldest = htmlCache.entries().next().value;
		if (!oldest) return;
		deleteHighlightCacheEntry(oldest[0], oldest[1]);
	}
}

export type MarkdownAssetUrlResolver = (url: string) => string;

export type MarkdownLinkUrlResolver = (url: string) => string;

export type MarkdownMentionHrefResolver = (login: string) => string | undefined;

export type MarkdownInternalLinkProps = {
	href: string;
	className?: string;
	children?: ReactNode;
};

const MarkdownAssetUrlResolverContext =
	createContext<MarkdownAssetUrlResolver | null>(null);

const MarkdownLinkUrlResolverContext =
	createContext<MarkdownLinkUrlResolver | null>(null);

export type MarkdownImageProps = ImgHTMLAttributes<HTMLImageElement>;

export type MarkdownImageComponent = ComponentType<MarkdownImageProps>;

const MarkdownImageComponentContext =
	createContext<MarkdownImageComponent | null>(null);

export const MarkdownCodeBlockContext = createContext<ComponentType<{
	code: string;
	lang: string;
	className?: string;
}> | null>(null);
function MarkdownCodeBlock(props: {
	code: string;
	lang: string;
	className?: string;
}) {
	const Component = useContext(MarkdownCodeBlockContext) ?? ShikiCode;
	return <Component {...props} />;
}

const MarkdownInternalLinkContext =
	createContext<ComponentType<MarkdownInternalLinkProps> | null>(null);

export type MarkdownMentionProps = {
	login: string;
	href?: string;
	children?: ReactNode;
};

export type MarkdownMentionComponent = ComponentType<MarkdownMentionProps>;

const MarkdownMentionComponentContext =
	createContext<MarkdownMentionComponent | null>(null);

export type MarkdownReferenceProps = {
	reference: ResourceReference;
	origin: ResourceReferenceOrigin;
	children?: ReactNode;
};

export type MarkdownReferenceComponent = ComponentType<MarkdownReferenceProps>;

const MarkdownReferenceComponentContext =
	createContext<MarkdownReferenceComponent | null>(null);

function useResolvedAssetUrl(url: string | undefined) {
	const resolveAssetUrl = useContext(MarkdownAssetUrlResolverContext);
	if (!url || !resolveAssetUrl) return url;
	return resolveAssetUrl(url);
}

function resolveAssetSrcSet(
	srcSet: string | undefined,
	resolveAssetUrl: MarkdownAssetUrlResolver | null,
) {
	if (!srcSet || !resolveAssetUrl) return srcSet;

	return srcSet
		.split(",")
		.map((candidate) => {
			const trimmed = candidate.trim();
			if (!trimmed) return candidate;

			const match = trimmed.match(/^(\S+)(\s+.+)?$/u);
			if (!match) return candidate;

			const url = match[1];
			if (/^data:/iu.test(url)) return candidate;

			return `${resolveAssetUrl(url)}${match[2] ?? ""}`;
		})
		.join(", ");
}

function createHighlightedHtml(code: string, lang: string): Promise<string> {
	return getHighlighterPromise().then((highlighter) => {
		const normalized =
			FENCE_LANG_ALIASES[lang] ??
			(shikiBundledLangSet.has(lang) ? (lang as ShikiBundledLang) : null);
		const effectiveLang = normalized ?? "text";
		return highlighter.codeToHtml(code, {
			lang: effectiveLang,
			themes: CODE_THEME_NAMES,
			defaultColor: false,
		});
	});
}

export function highlightCode(code: string, lang: string): Promise<string> {
	const key = `${lang}:${code}`;
	const cached = htmlCache.get(key);
	if (cached) {
		htmlCache.delete(key);
		htmlCache.set(key, cached);
		return cached.promise;
	}

	const promise = createHighlightedHtml(code, lang);
	const sourceBytes = utf8ByteLength(key);
	if (sourceBytes > HIGHLIGHT_CACHE_MAX_SOURCE_BYTES) return promise;

	const entry = { promise, bytes: sourceBytes };
	htmlCache.set(key, entry);
	htmlCacheBytes += entry.bytes;
	evictHighlightCacheEntries();
	promise.then(
		(html) => {
			if (htmlCache.get(key) !== entry) return;
			htmlCacheBytes -= entry.bytes;
			entry.bytes = sourceBytes + utf8ByteLength(html);
			htmlCacheBytes += entry.bytes;
			evictHighlightCacheEntries();
		},
		() => deleteHighlightCacheEntry(key, entry),
	);
	return promise;
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		return false;
	}
}

function CopyButton({ code }: { code: string }) {
	const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
		"idle",
	);
	const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

	const handleClick = useCallback(async () => {
		const copied = await copyTextToClipboard(code);
		setCopyState(copied ? "copied" : "failed");
		clearTimeout(timeoutRef.current);
		timeoutRef.current = setTimeout(() => setCopyState("idle"), 1500);
	}, [code]);
	const copyLabel =
		copyState === "copied"
			? "Copied"
			: copyState === "failed"
				? "Copy failed"
				: "Copy code";

	return (
		<button
			type="button"
			onClick={handleClick}
			aria-label={copyLabel}
			title={copyLabel}
			className={markdownCopyButtonClassName}
		>
			{copyState === "copied" ? (
				<svg
					width={14}
					height={14}
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth={2}
					strokeLinecap="round"
					strokeLinejoin="round"
					aria-hidden="true"
				>
					<polyline points="20 6 9 17 4 12" />
				</svg>
			) : (
				<svg
					width={14}
					height={14}
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth={2}
					strokeLinecap="round"
					strokeLinejoin="round"
					aria-hidden="true"
				>
					<rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
					<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
				</svg>
			)}
		</button>
	);
}

function ShikiHighlightedHtml({ html }: { html: string }) {
	const containerRef = useRef<HTMLDivElement>(null);
	const appliedHtmlRef = useRef<string | null>(null);

	useLayoutEffect(() => {
		const el = containerRef.current;
		if (!el || appliedHtmlRef.current === html) return;
		el.innerHTML = html;
		appliedHtmlRef.current = html;
	}, [html]);

	return <div ref={containerRef} className="select-text" />;
}

function ShikiCodeInner({
	code,
	className,
	htmlPromise,
	showCopyButton,
}: {
	code: string;
	className?: string;
	htmlPromise: Promise<string>;
	showCopyButton: boolean;
}) {
	const html = use(htmlPromise);

	return (
		<div className={cn(markdownCodeBlockShellClassName, className)}>
			<ShikiHighlightedHtml html={html} />
			{showCopyButton ? <CopyButton code={code} /> : null}
		</div>
	);
}

function HydratedShikiCode({
	className,
	code,
	fallback,
	lang,
	sensitive,
	showCopyButton,
}: {
	className?: string;
	code: string;
	fallback: ReactNode;
	lang: string;
	sensitive: boolean;
	showCopyButton: boolean;
}) {
	// This component only mounts after hydration. Keeping the promise here means
	// server rendering never captures code in the shared cache or a pending
	// highlighter callback, while sensitive snippets still bypass that cache.
	const htmlPromise = useMemo(
		() =>
			sensitive ? createHighlightedHtml(code, lang) : highlightCode(code, lang),
		[code, lang, sensitive],
	);

	return (
		<Suspense fallback={fallback}>
			<ShikiCodeInner
				className={className}
				code={code}
				htmlPromise={htmlPromise}
				showCopyButton={showCopyButton}
			/>
		</Suspense>
	);
}

/**
 * Plain monospace block for copy-friendly snippets (setup commands, etc.).
 * Prefer this over {@link ShikiCode} when users need to select individual lines.
 */
export function PlainCodeBlock({
	className,
	code,
}: {
	className?: string;
	code: string;
}) {
	return (
		<div className={cn(markdownCodeBlockShellClassName, className)}>
			<pre
				className={cn(
					markdownCodeBlockFallbackClassName,
					"mb-0 select-text whitespace-pre",
				)}
			>
				<code className="font-mono text-inherit">{code}</code>
			</pre>
			<CopyButton code={code} />
		</div>
	);
}

const emptySubscribe = () => () => {};

/**
 * False during SSR and the initial hydration render, true right after.
 * Lets us keep suspending client-only work (shiki) out of the server stream
 * without causing hydration mismatches.
 */
function useHydrated() {
	return useSyncExternalStore(
		emptySubscribe,
		() => true,
		() => false,
	);
}

/**
 * Shiki-highlighted code block (same path as markdown fenced code). Use for inline examples
 * outside of {@link Markdown}.
 */
export function ShikiCode({
	className,
	code,
	lang,
	sensitive = false,
	showCopyButton = true,
}: {
	className?: string;
	code: string;
	lang: string;
	/** Avoid retaining secrets or other sensitive snippets in the shared HTML cache. */
	sensitive?: boolean;
	showCopyButton?: boolean;
}) {
	const hydrated = useHydrated();
	const fallback = (
		<div className={cn("group/code relative mb-2.5", className)}>
			<pre className={markdownCodeBlockFallbackClassName}>
				<code>{code}</code>
			</pre>
		</div>
	);
	// Keep the promise-producing component out of both SSR and the initial
	// hydration render so no server-side snippet is retained.
	if (!hydrated) return fallback;
	return (
		<HydratedShikiCode
			className={className}
			code={code}
			fallback={fallback}
			lang={lang}
			sensitive={sensitive}
			showCopyButton={showCopyButton}
		/>
	);
}

function MarkdownImageNode({
	alt,
	src,
	className,
	...props
}: ImgHTMLAttributes<HTMLImageElement>) {
	const ImageComponent = useContext(MarkdownImageComponentContext);
	const resolvedSrc = useResolvedAssetUrl(src);

	if (ImageComponent) {
		return (
			<ImageComponent
				alt={alt}
				src={resolvedSrc}
				className={className}
				{...props}
			/>
		);
	}

	return (
		<img
			className={cn(markdownImageClassName, className)}
			alt={alt}
			src={resolvedSrc}
			{...props}
		/>
	);
}

const referenceLinkClassName = markdownLinkClassName;

// biome-ignore lint/suspicious/noExplicitAny: hast Element node from @m2d/react-markdown
function nodeProperties(node: any): Record<string, unknown> | undefined {
	const properties = node?.properties;
	return properties && typeof properties === "object" ? properties : undefined;
}

// biome-ignore lint/suspicious/noExplicitAny: component overrides receive union props from @m2d/react-markdown
function MarkdownMentionNode({ node, children }: any) {
	const MentionComponent = useContext(MarkdownMentionComponentContext);
	const props = nodeProperties(node);
	const login = typeof props?.login === "string" ? props.login : "";
	const href = typeof props?.href === "string" ? props.href : undefined;

	if (!login) return children;
	if (MentionComponent) {
		return (
			<MentionComponent login={login} href={href}>
				{children}
			</MentionComponent>
		);
	}
	if (!href) return children;
	return (
		<a className={referenceLinkClassName} href={href}>
			{children}
		</a>
	);
}

// biome-ignore lint/suspicious/noExplicitAny: component overrides receive union props from @m2d/react-markdown
function MarkdownReferenceNode({ node, children }: any) {
	const ReferenceComponent = useContext(MarkdownReferenceComponentContext);
	const properties = nodeProperties(node);
	const reference = referenceFromProperties(properties);

	if (!reference) return children;
	if (ReferenceComponent) {
		return (
			<ReferenceComponent
				reference={reference}
				origin={referenceOriginFromProperties(properties)}
			>
				{children}
			</ReferenceComponent>
		);
	}
	return (
		<a className={referenceLinkClassName} href={reference.href}>
			{children}
		</a>
	);
}

function hasClassNameToken(className: unknown, token: string) {
	if (typeof className === "string") {
		return className.split(/\s+/u).includes(token);
	}
	if (Array.isArray(className)) {
		return className.some((value) => value === token);
	}
	return false;
}

function hastTextContent(node: unknown): string {
	if (typeof node !== "object" || node === null) return "";
	const value = (node as { value?: unknown }).value;
	if (typeof value === "string") return value;
	const children = (node as { children?: unknown }).children;
	if (!Array.isArray(children)) return "";
	return children.map(hastTextContent).join("");
}

// biome-ignore lint/suspicious/noExplicitAny: component overrides receive union props from @m2d/react-markdown
const components: Record<string, React.FC<any>> = {
	[MARKDOWN_MENTION_TAG]: MarkdownMentionNode,
	[MARKDOWN_REFERENCE_TAG]: MarkdownReferenceNode,
	h1: ({ node: _, children, ...props }) => (
		<h1 className={markdownHeadingClassNames.h1} {...props}>
			{children}
		</h1>
	),
	h2: ({ node: _, children, ...props }) => (
		<h2 className={markdownHeadingClassNames.h2} {...props}>
			{children}
		</h2>
	),
	h3: ({ node: _, children, ...props }) => (
		<h3 className={markdownHeadingClassNames.h3} {...props}>
			{children}
		</h3>
	),
	h4: ({ node: _, children, ...props }) => (
		<h4 className={markdownHeadingClassNames.h4} {...props}>
			{children}
		</h4>
	),
	p: ({ node: _, children, className, ...props }) => {
		const baseClassName = hasClassNameToken(className, "markdown-alert-title")
			? markdownAlertTitleClassName
			: markdownParagraphClassName;
		return (
			<p className={cn(baseClassName, className)} {...props}>
				{children}
			</p>
		);
	},
	a: ({ node: _, children, href, className, ...props }) => {
		const InternalLink = useContext(MarkdownInternalLinkContext);
		const resolveLinkUrl = useContext(MarkdownLinkUrlResolverContext);
		const resolvedHref =
			typeof href === "string" && resolveLinkUrl ? resolveLinkUrl(href) : href;
		const isAppInternal =
			typeof resolvedHref === "string" &&
			resolvedHref.startsWith("/") &&
			!resolvedHref.startsWith("//");
		const isSameDocument =
			typeof resolvedHref === "string" &&
			(resolvedHref.startsWith("#") || resolvedHref.startsWith("?"));
		if (isAppInternal && InternalLink && resolvedHref) {
			return (
				<InternalLink
					href={resolvedHref}
					className={cn(markdownLinkClassName, className)}
				>
					{children}
				</InternalLink>
			);
		}
		return (
			<a
				href={resolvedHref}
				{...props}
				className={cn(markdownLinkClassName, className)}
				{...(isSameDocument
					? {}
					: { target: "_blank", rel: "noopener noreferrer" })}
			>
				{children}
			</a>
		);
	},
	ul: ({ node: _, children, className, ...props }) => (
		<ul
			className={
				hasClassNameToken(className, "contains-task-list")
					? markdownTaskListClassName
					: markdownListClassNames.ul
			}
			{...props}
		>
			{children}
		</ul>
	),
	ol: ({ node: _, children, ...props }) => (
		<ol className={markdownListClassNames.ol} {...props}>
			{children}
		</ol>
	),
	li: ({ node: _, children, ...props }) => (
		<li className={markdownListClassNames.li} {...props}>
			{children}
		</li>
	),
	blockquote: ({ node: _, children, className, ...props }) => {
		const baseClassName = hasClassNameToken(className, "markdown-alert")
			? markdownAlertBlockquoteClassName
			: markdownBlockquoteClassName;
		return (
			<blockquote className={cn(baseClassName, className)} {...props}>
				{children}
			</blockquote>
		);
	},
	code: ({ node: _, children, className, ...props }) => {
		const langMatch = className?.match(/language-(\w+)/);
		if (langMatch) {
			const code = String(children).replace(/\n$/, "");
			return <MarkdownCodeBlock code={code} lang={langMatch[1]} />;
		}
		return (
			<code className={markdownInlineCodeClassName} {...props}>
				{children}
			</code>
		);
	},
	pre: ({ children, node, className }) => {
		const codeChild = node?.children?.[0];
		if (
			codeChild?.type === "element" &&
			codeChild.tagName === "code" &&
			Array.isArray(codeChild.properties?.className) &&
			(codeChild.properties.className as string[]).some((c) =>
				String(c).startsWith("language-"),
			)
		) {
			return <>{children}</>;
		}
		const code =
			codeChild?.type === "element" && codeChild.tagName === "code"
				? hastTextContent(codeChild).replace(/\n$/u, "")
				: hastTextContent(node).replace(/\n$/u, "");
		return <MarkdownCodeBlock className={className} code={code} lang="text" />;
	},
	hr: ({ node: _, ...props }) => (
		<hr className={markdownHrClassName} {...props} />
	),
	img: ({ node: _, alt, src, className, ...props }) => (
		<MarkdownImageNode alt={alt} src={src} className={className} {...props} />
	),
	video: ({ node: _, src, className, ...props }) => (
		<video
			className={cn(markdownMediaClassName, className)}
			{...props}
			controls
			preload="metadata"
			src={useResolvedAssetUrl(src)}
		/>
	),
	source: ({ node: _, src, srcSet, srcset, ...props }) => {
		const resolveAssetUrl = useContext(MarkdownAssetUrlResolverContext);
		const resolvedSrcSet = resolveAssetSrcSet(
			srcSet ?? srcset,
			resolveAssetUrl,
		);

		return (
			<source
				src={useResolvedAssetUrl(src)}
				srcSet={resolvedSrcSet}
				{...props}
			/>
		);
	},
	iframe: ({ node: _, children, ...props }) => {
		const p = props as React.IframeHTMLAttributes<HTMLIFrameElement> & {
			srcdoc?: unknown;
		};
		// srcdoc is same-origin to the app — never render it from untrusted markdown.
		if (p.srcdoc != null || p.srcDoc != null) {
			return null;
		}
		const { srcdoc: _sd, srcDoc: _sD, ...rest } = p;
		return <iframe {...rest}>{children}</iframe>;
	},
	table: ({ node: _, children, ...props }) => (
		<div className={markdownTableShellClassName}>
			<table className={markdownTableClassName} {...props}>
				{children}
			</table>
		</div>
	),
	thead: ({ node: _, children, ...props }) => (
		<thead className={markdownTheadClassName} {...props}>
			{children}
		</thead>
	),
	th: ({ node: _, children, ...props }) => (
		<th className={markdownThClassName} {...props}>
			{children}
		</th>
	),
	td: ({ node: _, children, ...props }) => (
		<td className={markdownTdClassName} {...props}>
			{children}
		</td>
	),
	input: ({ node: _, type, checked, ...props }) => {
		if (type === "checkbox") {
			return (
				<input
					type="checkbox"
					checked={checked}
					readOnly
					className={markdownTaskCheckboxClassName}
					{...props}
				/>
			);
		}
		return <input type={type} {...props} />;
	},
	strong: ({ node: _, children, ...props }) => (
		<strong className={markdownStrongClassName} {...props}>
			{children}
		</strong>
	),
	em: ({ node: _, children, ...props }) => (
		<em className={markdownEmClassName} {...props}>
			{children}
		</em>
	),
	del: ({ node: _, children, ...props }) => (
		<del className={markdownDelClassName} {...props}>
			{children}
		</del>
	),
	section: ({ node: _, children, className, ...props }) => (
		<section
			className={cn(
				hasClassNameToken(className, "footnotes") && markdownFootnotesClassName,
				className,
			)}
			{...props}
		>
			{children}
		</section>
	),
	details: ({ node: _, children, ...props }) => (
		<details className={markdownDetailsClassName} {...props}>
			{children}
		</details>
	),
	summary: ({ node: _, children, ...props }) => (
		<summary className={markdownSummaryClassName} {...props}>
			<svg
				className={markdownSummaryChevronClassName}
				viewBox="0 0 16 16"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
			>
				<path d="M6 4l4 4-4 4" />
			</svg>
			{children}
		</summary>
	),
};

export function Markdown({
	children,
	className,
	resolveAssetUrl,
	resolveLinkUrl,
	resolveMentionHref,
	resolveReference,
	resolveTextReference,
	internalLinkComponent,
	imageComponent,
	mentionComponent,
	referenceComponent,
	remarkPlugins: additionalRemarkPlugins,
}: {
	children: string;
	className?: string;
	resolveAssetUrl?: MarkdownAssetUrlResolver;
	resolveLinkUrl?: MarkdownLinkUrlResolver;
	resolveMentionHref?: MarkdownMentionHrefResolver;
	resolveReference?: MarkdownReferenceResolver;
	resolveTextReference?: MarkdownTextReferenceResolver;
	internalLinkComponent?: ComponentType<MarkdownInternalLinkProps>;
	imageComponent?: MarkdownImageComponent;
	mentionComponent?: MarkdownMentionComponent;
	referenceComponent?: MarkdownReferenceComponent;
	/** App-scoped semantic transforms; the shared sanitizer still runs afterwards. */
	remarkPlugins?: PluggableList;
}) {
	const remarkPlugins = useMemo(() => {
		const plugins: PluggableList = [];
		if (additionalRemarkPlugins) plugins.push(...additionalRemarkPlugins);
		if (resolveMentionHref) {
			plugins.push(remarkProfileMentions(resolveMentionHref));
		}
		plugins.push(remarkGfm, remarkAlert);
		if (resolveTextReference) {
			plugins.push(remarkTextReferences(resolveTextReference));
		}
		if (resolveReference) {
			plugins.push(remarkResourceReferences(resolveReference));
		}
		return plugins;
	}, [
		additionalRemarkPlugins,
		resolveMentionHref,
		resolveReference,
		resolveTextReference,
	]);

	return (
		<MarkdownInternalLinkContext.Provider value={internalLinkComponent ?? null}>
			<MarkdownLinkUrlResolverContext.Provider value={resolveLinkUrl ?? null}>
				<MarkdownMentionComponentContext.Provider
					value={mentionComponent ?? null}
				>
					<MarkdownReferenceComponentContext.Provider
						value={referenceComponent ?? null}
					>
						<MarkdownImageComponentContext.Provider
							value={imageComponent ?? null}
						>
							<MarkdownAssetUrlResolverContext.Provider
								value={resolveAssetUrl ?? null}
							>
								<div className={cn(markdownRootClassName, className)}>
									<Md
										remarkPlugins={[...remarkPlugins]}
										rehypePlugins={[
											rehypeRaw,
											[rehypeSanitize, markdownSanitizeSchema],
											rehypeAlertIcons,
											rehypeFootnoteIds,
										]}
										components={components}
									>
										{children}
									</Md>
								</div>
							</MarkdownAssetUrlResolverContext.Provider>
						</MarkdownImageComponentContext.Provider>
					</MarkdownReferenceComponentContext.Provider>
				</MarkdownMentionComponentContext.Provider>
			</MarkdownLinkUrlResolverContext.Provider>
		</MarkdownInternalLinkContext.Provider>
	);
}

export type {
	MarkdownReferenceResolver,
	MarkdownTextReference,
	MarkdownTextReferenceResolver,
	ResourceReference,
	ResourceReferenceKind,
	ResourceReferenceOrigin,
} from "../lib/markdown-resource-reference";
