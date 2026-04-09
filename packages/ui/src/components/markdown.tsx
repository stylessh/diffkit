import { Suspense, use, useCallback, useRef, useState } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import type { BundledLanguage, Highlighter } from "shiki";
import { vercelDark, vercelLight } from "../lib/shiki-themes";
import { cn } from "../lib/utils";

const PRELOADED_LANGS: BundledLanguage[] = [
	"javascript",
	"typescript",
	"jsx",
	"tsx",
	"json",
	"html",
	"css",
	"bash",
	"shell",
	"python",
	"go",
	"rust",
	"yaml",
	"markdown",
	"diff",
	"sql",
	"graphql",
	"ruby",
	"java",
	"c",
	"cpp",
	"swift",
	"kotlin",
	"dockerfile",
	"toml",
];

// Eagerly start loading the highlighter at module level (client-only to avoid
// bundling all shiki language grammars into the server bundle for CF Workers).
const highlighterPromise: Promise<Highlighter> =
	typeof window !== "undefined"
		? import("shiki").then((shiki) =>
				shiki.createHighlighter({
					themes: [vercelLight, vercelDark],
					langs: PRELOADED_LANGS,
				}),
			)
		: new Promise<Highlighter>(() => {}); // Never resolves on server → Suspense fallback

const htmlCache = new Map<string, Promise<string>>();

export function highlightCode(code: string, lang: string): Promise<string> {
	const key = `${lang}:${code}`;
	const cached = htmlCache.get(key);
	if (cached) return cached;

	const promise = highlighterPromise.then(async (highlighter) => {
		let effectiveLang = lang;
		if (!highlighter.getLoadedLanguages().includes(lang)) {
			try {
				await highlighter.loadLanguage(lang as BundledLanguage);
			} catch {
				effectiveLang = "text";
			}
		}
		return highlighter.codeToHtml(code, {
			lang: effectiveLang,
			themes: { light: "vercel-light", dark: "vercel-dark" },
			defaultColor: false,
		});
	});
	htmlCache.set(key, promise);
	return promise;
}

function CopyButton({ code }: { code: string }) {
	const [copied, setCopied] = useState(false);
	const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

	const handleClick = useCallback(() => {
		navigator.clipboard.writeText(code);
		setCopied(true);
		clearTimeout(timeoutRef.current);
		timeoutRef.current = setTimeout(() => setCopied(false), 1500);
	}, [code]);

	return (
		<button
			type="button"
			onClick={handleClick}
			className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-md bg-surface-1 text-muted-foreground opacity-0 transition-all hover:bg-surface-2 hover:text-foreground group-hover/code:opacity-100"
		>
			{copied ? (
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

function ShikiCodeInner({ code, lang }: { code: string; lang: string }) {
	const html = use(highlightCode(code, lang));

	return (
		<div className="group/code relative mb-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:text-xs">
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: shiki output is trusted */}
			<div dangerouslySetInnerHTML={{ __html: html }} />
			<CopyButton code={code} />
		</div>
	);
}

function ShikiCode({ code, lang }: { code: string; lang: string }) {
	return (
		<Suspense
			fallback={
				<div className="group/code relative mb-2">
					<pre className="overflow-x-auto rounded-lg bg-surface-1 p-3 text-xs">
						<code>{code}</code>
					</pre>
				</div>
			}
		>
			<ShikiCodeInner code={code} lang={lang} />
		</Suspense>
	);
}

const components: Components = {
	h1: ({ children, ...props }) => (
		<h1
			className="text-2xl font-semibold tracking-tight mb-3 mt-5 first:mt-0"
			{...props}
		>
			{children}
		</h1>
	),
	h2: ({ children, ...props }) => (
		<h2
			className="text-xl font-semibold tracking-tight mb-2 mt-4 first:mt-0"
			{...props}
		>
			{children}
		</h2>
	),
	h3: ({ children, ...props }) => (
		<h3
			className="text-lg font-semibold tracking-tight mb-2 mt-3 first:mt-0"
			{...props}
		>
			{children}
		</h3>
	),
	h4: ({ children, ...props }) => (
		<h4 className="text-base font-semibold mb-1.5 mt-3 first:mt-0" {...props}>
			{children}
		</h4>
	),
	p: ({ children, ...props }) => (
		<p className="text-sm leading-relaxed mb-2 last:mb-0" {...props}>
			{children}
		</p>
	),
	a: ({ children, href, ...props }) => (
		<a
			href={href}
			className="text-sm font-medium underline underline-offset-2 decoration-border hover:decoration-foreground transition-colors"
			target="_blank"
			rel="noopener noreferrer"
			{...props}
		>
			{children}
		</a>
	),
	ul: ({ children, ...props }) => (
		<ul
			className="text-sm list-disc pl-5 mb-2 flex flex-col gap-0.5"
			{...props}
		>
			{children}
		</ul>
	),
	ol: ({ children, ...props }) => (
		<ol
			className="text-sm list-decimal pl-5 mb-2 flex flex-col gap-0.5"
			{...props}
		>
			{children}
		</ol>
	),
	li: ({ children, ...props }) => (
		<li className="text-sm leading-relaxed" {...props}>
			{children}
		</li>
	),
	blockquote: ({ children, ...props }) => (
		<blockquote
			className="border-l-2 border-border pl-3 text-sm text-muted-foreground italic mb-2"
			{...props}
		>
			{children}
		</blockquote>
	),
	code: ({ children, className, ...props }) => {
		const langMatch = className?.match(/language-(\w+)/);
		if (langMatch) {
			const code = String(children).replace(/\n$/, "");
			return <ShikiCode code={code} lang={langMatch[1]} />;
		}
		return (
			<code
				className="rounded-md bg-surface-1 px-1.5 py-0.5 text-xs font-mono"
				{...props}
			>
				{children}
			</code>
		);
	},
	pre: ({ children, node, ...props }) => {
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
		return (
			<pre
				className="overflow-x-auto rounded-lg bg-surface-1 p-3 text-xs mb-2"
				{...props}
			>
				{children}
			</pre>
		);
	},
	hr: (props) => <hr className="my-4 border-border" {...props} />,
	img: ({ alt, ...props }) => (
		<img
			className="inline-block max-w-full rounded-lg my-2"
			alt={alt}
			{...props}
		/>
	),
	table: ({ children, ...props }) => (
		<div className="overflow-hidden mb-2 rounded-lg border border-border bg-surface-0">
			<table className="w-full text-sm border-collapse" {...props}>
				{children}
			</table>
		</div>
	),
	thead: ({ children, ...props }) => (
		<thead className="bg-surface-1" {...props}>
			{children}
		</thead>
	),
	th: ({ children, ...props }) => (
		<th
			className="border-b border-r border-border/50 px-3 py-1.5 text-left text-xs font-medium text-muted-foreground last:border-r-0"
			{...props}
		>
			{children}
		</th>
	),
	td: ({ children, ...props }) => (
		<td
			className="border-b border-r border-border/50 px-3 py-1.5 text-xs last:border-r-0 [tr:last-child_&]:border-b-0"
			{...props}
		>
			{children}
		</td>
	),
	input: ({ type, checked, ...props }) => {
		if (type === "checkbox") {
			return (
				<input
					type="checkbox"
					checked={checked}
					readOnly
					className="mr-1.5 rounded border-border"
					{...props}
				/>
			);
		}
		return <input type={type} {...props} />;
	},
	strong: ({ children, ...props }) => (
		<strong className="font-semibold" {...props}>
			{children}
		</strong>
	),
	em: ({ children, ...props }) => (
		<em className="italic" {...props}>
			{children}
		</em>
	),
	del: ({ children, ...props }) => (
		<del className="text-muted-foreground line-through" {...props}>
			{children}
		</del>
	),
	details: ({ children, ...props }) => (
		<details
			className="group/details mb-2 text-sm [&>:not(summary)]:mt-2"
			{...props}
		>
			{children}
		</details>
	),
	summary: ({ children, ...props }) => (
		<summary
			className="flex w-fit cursor-pointer select-none list-none items-center gap-1.5 rounded-lg border border-border bg-surface-0 px-3 py-1.5 text-[13px] font-medium hover:bg-surface-1 [&::-webkit-details-marker]:hidden"
			{...props}
		>
			<svg
				className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open/details:rotate-90"
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
}: {
	children: string;
	className?: string;
}) {
	return (
		<div className={cn("text-foreground", className)}>
			<ReactMarkdown
				remarkPlugins={[remarkGfm]}
				rehypePlugins={[rehypeRaw]}
				components={components}
			>
				{children}
			</ReactMarkdown>
		</div>
	);
}
