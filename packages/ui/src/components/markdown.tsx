import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { cn } from "../lib/utils";

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
		const isBlock = className?.includes("language-");
		if (isBlock) {
			return (
				<code className={cn("text-xs", className)} {...props}>
					{children}
				</code>
			);
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
	pre: ({ children, ...props }) => (
		<pre
			className="overflow-x-auto rounded-lg bg-surface-1 p-3 text-xs mb-2"
			{...props}
		>
			{children}
		</pre>
	),
	hr: (props) => <hr className="my-4 border-border" {...props} />,
	img: ({ alt, ...props }) => (
		<img className="max-w-full rounded-lg my-2" alt={alt} {...props} />
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
