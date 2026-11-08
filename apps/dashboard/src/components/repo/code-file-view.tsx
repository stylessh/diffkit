import {
	CheckIcon,
	CodeIcon,
	CopyIcon,
	DownloadIcon,
	FileIcon,
	ViewIcon,
} from "@diffkit/icons";
import { highlightCode } from "@diffkit/ui/components/markdown";
import { Skeleton } from "@diffkit/ui/components/skeleton";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@diffkit/ui/components/tooltip";
import { cn } from "@diffkit/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Suspense, use, useCallback, useMemo, useRef, useState } from "react";
import { formatRelativeTime } from "#/lib/format-relative-time";
import {
	type GitHubQueryScope,
	githubFileLastCommitQueryOptions,
	githubRepoFileContentQueryOptions,
	githubRepoTreeQueryOptions,
} from "#/lib/github.query";
import type { FileLastCommit } from "#/lib/github.types";
import { CommitHistoryLink } from "./commits/commit-history-link";
import {
	iconButtonClassName,
	RepoAvatar,
	RepoCard,
	RepoCardHead,
} from "./repo-ui";

const IMAGE_EXTENSIONS = new Set([
	"png",
	"jpg",
	"jpeg",
	"avif",
	"gif",
	"webp",
	"svg",
	"ico",
	"bmp",
]);

function isImageFile(path: string): boolean {
	const ext = path.split(".").pop()?.toLowerCase() ?? "";
	return IMAGE_EXTENSIONS.has(ext);
}

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

	const commit = fileCommitQuery.data;
	const isImage = isImageFile(path);
	const isSvg = path.toLowerCase().endsWith(".svg");

	// Non-SVG images — no code content needed
	if (isImage && !isSvg) {
		const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${currentRef}/${path}`;
		return (
			<RepoCard>
				<FileCommitBar
					owner={owner}
					repo={repo}
					commit={commit}
					currentRef={currentRef}
					path={path}
				/>
				<FileViewHeader
					fileName={fileName}
					size={fileEntry?.size ?? null}
					owner={owner}
					repo={repo}
					currentRef={currentRef}
					path={path}
				/>
				<div className="flex items-center justify-center p-8">
					<img
						src={rawUrl}
						alt={fileName}
						className="max-h-[70vh] max-w-full object-contain"
					/>
				</div>
			</RepoCard>
		);
	}

	if (contentQuery.isLoading) {
		return <CodeFileViewSkeleton fileName={fileName} />;
	}

	if (contentQuery.error || contentQuery.data == null) {
		return (
			<RepoCard>
				<FileViewHeader fileName={fileName} />
				<p className="px-4 py-6 text-[13px] text-muted-foreground">
					Unable to load file content.
				</p>
			</RepoCard>
		);
	}

	const code = contentQuery.data.replace(/\n$/, "");
	const lang = detectLang(path);
	const lineCount = code.split("\n").length;

	// SVG — toggle between preview and code
	if (isSvg) {
		return (
			<SvgFileView
				code={code}
				lang={lang}
				lineCount={lineCount}
				fileName={fileName}
				size={fileEntry?.size ?? null}
				commit={commit}
				owner={owner}
				repo={repo}
				currentRef={currentRef}
				path={path}
			/>
		);
	}

	return (
		<RepoCard>
			<FileCommitBar
				owner={owner}
				repo={repo}
				commit={commit}
				currentRef={currentRef}
				path={path}
			/>
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
		</RepoCard>
	);
}

function SvgFileView({
	code,
	lang,
	lineCount,
	fileName,
	size,
	commit,
	owner,
	repo,
	currentRef,
	path,
}: {
	code: string;
	lang: string;
	lineCount: number;
	fileName: string;
	size: number | null;
	commit: FileLastCommit | null | undefined;
	owner: string;
	repo: string;
	currentRef: string;
	path: string;
}) {
	const [mode, setMode] = useState<"preview" | "code">("preview");
	const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${currentRef}/${path}`;

	return (
		<RepoCard>
			<FileCommitBar
				owner={owner}
				repo={repo}
				commit={commit}
				currentRef={currentRef}
				path={path}
			/>
			<FileViewHeader
				fileName={fileName}
				lineCount={mode === "code" ? lineCount : undefined}
				size={size}
				code={code}
				owner={owner}
				repo={repo}
				currentRef={currentRef}
				path={path}
			>
				<div className="flex gap-0.5">
					{(["preview", "code"] as const).map((value) => (
						<button
							key={value}
							type="button"
							aria-pressed={mode === value}
							onClick={() => setMode(value)}
							className={cn(
								"flex h-6 items-center gap-1.5 rounded-md px-2 font-medium transition-colors",
								mode === value
									? "bg-pill-neutral text-foreground"
									: "hover:text-text-header",
							)}
						>
							{value === "preview" ? (
								<ViewIcon size={13} />
							) : (
								<CodeIcon size={13} />
							)}
							{value === "preview" ? "Preview" : "Code"}
						</button>
					))}
				</div>
			</FileViewHeader>
			{mode === "preview" ? (
				<div className="flex items-center justify-center p-8">
					<img
						src={rawUrl}
						alt={fileName}
						className="max-h-[70vh] max-w-full object-contain"
					/>
				</div>
			) : (
				<div className="overflow-x-auto">
					<Suspense fallback={<PlainCode code={code} />}>
						<HighlightedCode code={code} lang={lang} />
					</Suspense>
				</div>
			)}
		</RepoCard>
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
	children,
}: {
	fileName: string;
	lineCount?: number;
	size?: number | null;
	code?: string;
	owner?: string;
	repo?: string;
	currentRef?: string;
	path?: string;
	children?: React.ReactNode;
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
		<div className="flex h-10 min-w-0 items-center gap-3 border-b-[0.5px] border-card-border pr-2 pl-4 text-xs font-[450] text-muted-foreground">
			{children}
			{lineCount == null && size == null ? (
				<span className="flex min-w-0 items-center gap-1.5 text-text-header">
					<FileIcon size={14} className="shrink-0 text-muted-foreground" />
					<span className="truncate">{fileName}</span>
				</span>
			) : (
				<span className="tabular-nums">
					{lineCount != null
						? `${lineCount} ${lineCount === 1 ? "line" : "lines"}`
						: null}
					{lineCount != null && size != null ? " · " : null}
					{size != null ? formatFileSize(size) : null}
				</span>
			)}
			<div className="ml-auto flex items-center gap-0.5">
				{code && (
					<button
						type="button"
						onClick={handleCopy}
						className={iconButtonClassName}
						aria-label={copied ? "Copied" : "Copy file content"}
						title={copied ? "Copied!" : "Copy file content"}
					>
						{copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
					</button>
				)}
				{owner && repo && currentRef && path && (
					<a
						href={`https://raw.githubusercontent.com/${owner}/${repo}/${currentRef}/${path}`}
						target="_blank"
						rel="noopener noreferrer"
						className={iconButtonClassName}
						aria-label="View raw"
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
	owner,
	repo,
	commit,
	currentRef,
	path,
}: {
	owner: string;
	repo: string;
	commit: FileLastCommit | null | undefined;
	currentRef: string;
	path: string;
}) {
	if (!commit) {
		return (
			<RepoCardHead>
				<Skeleton className="size-[18px] rounded-full" />
				<Skeleton className="h-3.5 w-48 rounded" />
			</RepoCardHead>
		);
	}

	const shortSha = commit.sha.slice(0, 7);
	const firstLine = commit.message.split("\n")[0];

	return (
		<RepoCardHead>
			{commit.author && (
				<RepoAvatar src={commit.author.avatarUrl} alt={commit.author.login} />
			)}
			<p className="min-w-0 flex-1 truncate font-[450] text-muted-foreground">
				<span className="font-medium text-foreground">
					{commit.author?.login ?? "Unknown"}
				</span>{" "}
				<Link
					to="/$owner/$repo/commit/$sha"
					params={{ owner, repo, sha: commit.sha }}
					className="rounded-sm transition-colors hover:text-foreground"
				>
					{firstLine}
				</Link>
			</p>
			<div className="flex shrink-0 items-center gap-1 text-xs font-[450] text-muted-foreground">
				<Tooltip>
					<TooltipTrigger asChild>
						<span className="mr-2 font-mono max-sm:hidden">{shortSha}</span>
					</TooltipTrigger>
					<TooltipContent side="bottom">
						<code>{commit.sha}</code>
					</TooltipContent>
				</Tooltip>
				<time dateTime={commit.date} className="mr-1 tabular-nums">
					{formatRelativeTime(commit.date)}
				</time>
				<CommitHistoryLink
					owner={owner}
					repo={repo}
					ref={currentRef}
					path={path}
					className="-mr-2"
				/>
			</div>
		</RepoCardHead>
	);
}

function LineNumbers({ count }: { count: number }) {
	return (
		<div className="sticky left-0 z-10 flex w-[50px] shrink-0 flex-col items-end bg-surface-0 py-2 pr-3 font-mono text-line-number tabular-nums select-none">
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
		<div className="overflow-x-auto text-xs">
			<div className="flex min-w-fit">
				<LineNumbers count={lineCount} />
				<pre className="flex-1 py-2 pr-4">
					<code className="leading-5 text-foreground">{code}</code>
				</pre>
			</div>
		</div>
	);
}

function HighlightedCode({ code, lang }: { code: string; lang: string }) {
	const html = use(highlightCode(code, lang));
	const lineCount = code.split("\n").length;

	return (
		<div className="overflow-x-auto text-xs">
			<div className="flex min-w-fit">
				<LineNumbers count={lineCount} />
				<div
					className="flex-1 [&_pre]:py-2 [&_pre]:pr-4 [&_pre]:leading-5 [&_code]:text-xs"
					// biome-ignore lint/security/noDangerouslySetInnerHtml: shiki output is trusted
					dangerouslySetInnerHTML={{ __html: html }}
				/>
			</div>
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
		<RepoCard>
			<FileViewHeader fileName={fileName} />
			<div className="flex flex-col gap-2 py-3 pr-4 pl-[50px]">
				{skeletonWidths.map((width) => (
					<Skeleton key={width} className="h-3.5 rounded" style={{ width }} />
				))}
			</div>
		</RepoCard>
	);
}
