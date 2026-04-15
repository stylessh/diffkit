import {
	CopyIcon,
	DownloadIcon,
	FileIcon,
	GitCommitIcon,
} from "@diffkit/icons";
import { highlightCode } from "@diffkit/ui/components/markdown";
import { Skeleton } from "@diffkit/ui/components/skeleton";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@diffkit/ui/components/tooltip";
import { useQuery } from "@tanstack/react-query";
import { Suspense, use, useCallback, useMemo, useRef, useState } from "react";
import { formatRelativeTime } from "#/lib/format-relative-time";
import {
	type GitHubQueryScope,
	githubFileLastCommitQueryOptions,
	githubRepoFileContentQueryOptions,
	githubRepoTreeQueryOptions,
} from "#/lib/github.query";
import type { FileLastCommit } from "#/lib/github.types";

const EXT_TO_LANG: Record<string, string> = {
	ts: "typescript",
	mts: "typescript",
	cts: "typescript",
	tsx: "tsx",
	js: "javascript",
	mjs: "javascript",
	cjs: "javascript",
	jsx: "jsx",
	json: "json",
	jsonc: "json",
	json5: "json",
	md: "markdown",
	mdx: "markdown",
	html: "html",
	htm: "html",
	xhtml: "html",
	svg: "html",
	xml: "xml",
	css: "css",
	scss: "scss",
	sass: "sass",
	less: "less",
	py: "python",
	pyi: "python",
	pyw: "python",
	rs: "rust",
	go: "go",
	rb: "ruby",
	erb: "ruby",
	java: "java",
	c: "c",
	cpp: "cpp",
	cc: "cpp",
	cxx: "cpp",
	h: "c",
	hpp: "cpp",
	hxx: "cpp",
	cs: "csharp",
	swift: "swift",
	kt: "kotlin",
	kts: "kotlin",
	sql: "sql",
	graphql: "graphql",
	gql: "graphql",
	yml: "yaml",
	yaml: "yaml",
	toml: "toml",
	ini: "ini",
	cfg: "ini",
	conf: "ini",
	env: "bash",
	sh: "bash",
	bash: "bash",
	zsh: "bash",
	fish: "bash",
	ps1: "powershell",
	dockerfile: "dockerfile",
	diff: "diff",
	patch: "diff",
	lua: "lua",
	r: "r",
	R: "r",
	pl: "perl",
	pm: "perl",
	php: "php",
	ex: "elixir",
	exs: "elixir",
	erl: "erlang",
	hs: "haskell",
	scala: "scala",
	clj: "clojure",
	vim: "viml",
	tf: "hcl",
	tfvars: "hcl",
	proto: "protobuf",
	prisma: "prisma",
};

const NAME_TO_LANG: Record<string, string> = {
	dockerfile: "dockerfile",
	makefile: "bash",
	gemfile: "ruby",
	rakefile: "ruby",
	justfile: "bash",
	vagrantfile: "ruby",
	brewfile: "ruby",
	".gitignore": "bash",
	".gitattributes": "bash",
	".dockerignore": "bash",
	".editorconfig": "ini",
	".env": "bash",
	".env.local": "bash",
	".env.example": "bash",
	".npmrc": "ini",
	".eslintrc": "json",
	".prettierrc": "json",
	".babelrc": "json",
};

function detectLang(path: string): string {
	const name = path.split("/").pop() ?? "";
	const lower = name.toLowerCase();
	const nameMatch = NAME_TO_LANG[lower];
	if (nameMatch) return nameMatch;
	const ext = lower.split(".").pop() ?? "";
	return EXT_TO_LANG[ext] ?? "text";
}

function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function CodeFileView({
	owner,
	repo,
	currentRef,
	path,
	scope,
}: {
	owner: string;
	repo: string;
	currentRef: string;
	path: string;
	scope: GitHubQueryScope;
}) {
	const contentQuery = useQuery(
		githubRepoFileContentQueryOptions(scope, {
			owner,
			repo,
			ref: currentRef,
			path,
		}),
	);

	const fileCommitQuery = useQuery(
		githubFileLastCommitQueryOptions(scope, {
			owner,
			repo,
			ref: currentRef,
			path,
		}),
	);

	// Fetch parent directory tree to get file metadata (size)
	const parentPath = path.includes("/")
		? path.slice(0, path.lastIndexOf("/"))
		: "";
	const parentTreeQuery = useQuery({
		...githubRepoTreeQueryOptions(scope, {
			owner,
			repo,
			ref: currentRef,
			path: parentPath,
		}),
	});

	const fileName = path.split("/").pop() ?? path;
	const fileEntry = useMemo(
		() => parentTreeQuery.data?.find((e) => e.name === fileName),
		[parentTreeQuery.data, fileName],
	);

	if (contentQuery.isLoading) {
		return <CodeFileViewSkeleton fileName={fileName} />;
	}

	if (contentQuery.error || contentQuery.data == null) {
		return (
			<div className="rounded-lg border">
				<FileViewHeader fileName={fileName} />
				<div className="p-6 text-sm text-muted-foreground">
					Unable to load file content.
				</div>
			</div>
		);
	}

	const code = contentQuery.data.replace(/\n$/, "");
	const lang = detectLang(path);
	const lineCount = code.split("\n").length;
	const commit = fileCommitQuery.data;

	return (
		<div className="flex flex-col gap-4">
			<FileCommitBar commit={commit} />
			<div className="overflow-hidden rounded-lg border">
				<FileViewHeader
					fileName={fileName}
					lineCount={lineCount}
					size={fileEntry?.size ?? null}
					code={code}
					owner={owner}
					repo={repo}
					currentRef={currentRef}
					path={path}
				/>
				<div className="overflow-x-auto">
					<Suspense fallback={<PlainCode code={code} />}>
						<HighlightedCode code={code} lang={lang} />
					</Suspense>
				</div>
			</div>
		</div>
	);
}

function FileViewHeader({
	fileName,
	lineCount,
	size,
	code,
	owner,
	repo,
	currentRef,
	path,
}: {
	fileName: string;
	lineCount?: number;
	size?: number | null;
	code?: string;
	owner?: string;
	repo?: string;
	currentRef?: string;
	path?: string;
}) {
	const [copied, setCopied] = useState(false);
	const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

	const handleCopy = useCallback(() => {
		if (!code) return;
		navigator.clipboard.writeText(code);
		setCopied(true);
		clearTimeout(timeoutRef.current);
		timeoutRef.current = setTimeout(() => setCopied(false), 1500);
	}, [code]);

	return (
		<div className="flex items-center gap-2 border-b bg-surface-0 px-4 py-2.5 text-sm">
			<FileIcon size={14} className="shrink-0 text-muted-foreground" />
			<span className="font-medium text-foreground">{fileName}</span>
			<div className="flex items-center gap-2 text-xs text-muted-foreground">
				{lineCount != null && (
					<span>
						{lineCount} {lineCount === 1 ? "line" : "lines"}
					</span>
				)}
				{lineCount != null && size != null && (
					<span aria-hidden="true">&middot;</span>
				)}
				{size != null && <span>{formatFileSize(size)}</span>}
			</div>
			<div className="ml-auto flex items-center gap-1">
				{code && (
					<button
						type="button"
						onClick={handleCopy}
						className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-1 hover:text-foreground"
						title={copied ? "Copied!" : "Copy file content"}
					>
						<CopyIcon size={14} />
					</button>
				)}
				{owner && repo && currentRef && path && (
					<a
						href={`https://raw.githubusercontent.com/${owner}/${repo}/${currentRef}/${path}`}
						target="_blank"
						rel="noopener noreferrer"
						className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-1 hover:text-foreground"
						title="View raw"
					>
						<DownloadIcon size={14} />
					</a>
				)}
			</div>
		</div>
	);
}

function FileCommitBar({
	commit,
}: {
	commit: FileLastCommit | null | undefined;
}) {
	if (!commit) {
		return (
			<div className="flex items-center gap-3 rounded-lg bg-surface-1 px-4 py-2.5 text-sm">
				<Skeleton className="size-5 rounded-full" />
				<Skeleton className="h-4 w-48 rounded" />
			</div>
		);
	}

	const shortSha = commit.sha.slice(0, 7);
	const firstLine = commit.message.split("\n")[0];

	return (
		<div className="flex items-center gap-3 rounded-lg bg-surface-1 px-4 py-2.5 text-sm">
			{commit.author && (
				<img
					src={commit.author.avatarUrl}
					alt={commit.author.login}
					className="size-5 shrink-0 rounded-full"
				/>
			)}
			<span className="font-medium">{commit.author?.login ?? "Unknown"}</span>
			<Tooltip>
				<TooltipTrigger asChild>
					<span className="min-w-0 flex-1 truncate text-muted-foreground">
						{firstLine}
					</span>
				</TooltipTrigger>
				{firstLine.length > 60 && (
					<TooltipContent side="bottom" className="max-w-sm">
						{firstLine}
					</TooltipContent>
				)}
			</Tooltip>
			<div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
				<Tooltip>
					<TooltipTrigger asChild>
						<span className="flex items-center gap-1">
							<GitCommitIcon size={14} />
							<code>{shortSha}</code>
						</span>
					</TooltipTrigger>
					<TooltipContent side="bottom">
						<code>{commit.sha}</code>
					</TooltipContent>
				</Tooltip>
				<span>{formatRelativeTime(commit.date)}</span>
			</div>
		</div>
	);
}

function LineNumbers({ count }: { count: number }) {
	return (
		<div className="flex flex-col items-end border-r bg-surface-0 px-3 py-3 text-muted-foreground select-none">
			{Array.from({ length: count }, (_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: line numbers are stable indices
				<span key={i} className="leading-5">
					{i + 1}
				</span>
			))}
		</div>
	);
}

function PlainCode({ code }: { code: string }) {
	const lineCount = code.split("\n").length;

	return (
		<div className="flex text-xs">
			<LineNumbers count={lineCount} />
			<pre className="flex-1 overflow-x-auto p-3">
				<code className="leading-5 text-foreground">{code}</code>
			</pre>
		</div>
	);
}

function HighlightedCode({ code, lang }: { code: string; lang: string }) {
	const html = use(highlightCode(code, lang));
	const lineCount = code.split("\n").length;

	return (
		<div className="flex text-xs">
			<LineNumbers count={lineCount} />
			<div
				className="flex-1 overflow-x-auto [&_pre]:p-3 [&_pre]:leading-5 [&_code]:text-xs"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: shiki output is trusted
				dangerouslySetInnerHTML={{ __html: html }}
			/>
		</div>
	);
}

const skeletonWidths = [
	"75%",
	"60%",
	"85%",
	"45%",
	"90%",
	"55%",
	"70%",
	"80%",
	"50%",
	"65%",
	"88%",
	"42%",
];

function CodeFileViewSkeleton({ fileName }: { fileName: string }) {
	return (
		<div className="overflow-hidden rounded-lg border">
			<FileViewHeader fileName={fileName} />
			<div className="flex flex-col gap-2 p-4">
				{skeletonWidths.map((width) => (
					<Skeleton key={width} className="h-4 rounded" style={{ width }} />
				))}
			</div>
		</div>
	);
}
