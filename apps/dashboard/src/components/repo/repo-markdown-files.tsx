import { FileIcon } from "@diffkit/icons";
import {
	markdownHeadingClassNames,
	markdownParagraphClassName,
	markdownRootClassName,
} from "@diffkit/ui/lib/markdown-theme";
import { cn } from "@diffkit/ui/lib/utils";
import {
	keepPreviousData,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { lazy, useCallback, useMemo, useState } from "react";
import { Skeleton, SkeletonSuspense } from "skullet/react";
import {
	type GitHubQueryScope,
	githubRepoBlobQueryOptions,
} from "#/lib/github.query";
import type { RepoTreeEntry } from "#/lib/github.types";

const Markdown = lazy(() =>
	import("@diffkit/ui/components/markdown").then((mod) => ({
		default: mod.Markdown,
	})),
);

const KNOWN_MD_FILES = [
	"README.md",
	"readme.md",
	"README",
	"CODE_OF_CONDUCT.md",
	"CONTRIBUTING.md",
	"LICENSE",
	"LICENSE.md",
	"LICENSE.txt",
	"SECURITY.md",
	"CHANGELOG.md",
];

const TAB_LABELS: Record<string, string> = {
	"README.md": "README",
	"readme.md": "README",
	README: "README",
	"CODE_OF_CONDUCT.md": "Code of conduct",
	"CONTRIBUTING.md": "Contributing",
	LICENSE: "License",
	"LICENSE.md": "License",
	"LICENSE.txt": "License",
	"SECURITY.md": "Security",
	"CHANGELOG.md": "Changelog",
};

export function RepoMarkdownFiles({
	entries,
	owner,
	repo,
	currentRef,
	scope,
}: {
	entries: RepoTreeEntry[];
	owner: string;
	repo: string;
	currentRef: string;
	scope: GitHubQueryScope;
}) {
	const mdFiles = useMemo(
		() =>
			KNOWN_MD_FILES.flatMap(
				(name) =>
					entries.find(
						(entry) => entry.name === name && entry.type === "file",
					) ?? [],
			),
		[entries],
	);

	const queryClient = useQueryClient();
	const prefetch = (path: string) => {
		void queryClient.prefetchQuery(
			githubRepoBlobQueryOptions(scope, { owner, repo, ref: currentRef, path }),
		);
	};

	// Nothing is open until asked for: the files come first, the docs on demand.
	const [openPath, setOpenPath] = useState<string | null>(null);
	const selectedFile = mdFiles.find((file) => file.path === openPath) ?? null;

	if (mdFiles.length === 0) return null;

	return (
		<section aria-label="Repository documents" className="flex flex-col gap-5">
			<div className="flex flex-wrap items-center gap-[7px]">
				{mdFiles.map((file) => (
					<button
						key={file.path}
						type="button"
						aria-pressed={file === selectedFile}
						aria-controls={
							file === selectedFile ? "repository-document" : undefined
						}
						onClick={() =>
							setOpenPath((open) => (open === file.path ? null : file.path))
						}
						onMouseEnter={() => prefetch(file.path)}
						className={cn(
							"inline-flex h-7 items-center gap-1.5 rounded-md bg-button pr-[10.5px] pl-2 text-xs font-medium whitespace-nowrap text-muted-foreground shadow-button transition-colors hover:bg-button-hover hover:text-foreground",
							"aria-pressed:bg-tab-selected aria-pressed:text-foreground aria-pressed:shadow-tab-selected",
						)}
					>
						<FileIcon size={14} strokeWidth={2} className="shrink-0" />
						{TAB_LABELS[file.name] ?? file.name}
					</button>
				))}
			</div>

			{selectedFile && (
				<div id="repository-document">
					<MarkdownFileContent
						owner={owner}
						repo={repo}
						path={selectedFile.path}
						currentRef={currentRef}
						scope={scope}
					/>
				</div>
			)}
		</section>
	);
}

function MarkdownFileContent({
	owner,
	repo,
	path,
	currentRef,
	scope,
}: {
	owner: string;
	repo: string;
	path: string;
	currentRef: string;
	scope: GitHubQueryScope;
}) {
	const contentQuery = useQuery({
		...githubRepoBlobQueryOptions(scope, {
			owner,
			repo,
			ref: currentRef,
			path,
		}),
		placeholderData: keepPreviousData,
	});

	const resolveAssetUrl = useCallback(
		(url: string) =>
			resolveGitHubMarkdownAssetUrl(
				{ owner, repo, ref: currentRef, path },
				url,
			),
		[owner, repo, currentRef, path],
	);

	const blob = contentQuery.data;

	return (
		<Skeleton loading={contentQuery.isLoading} label="Loading document">
			{contentQuery.isLoading ? (
				<MarkdownDocumentSample />
			) : blob?.kind === "text" ? (
				<SkeletonSuspense
					skeleton={<MarkdownDocumentSample />}
					label="Loading document"
				>
					<Markdown
						className={markdownDocumentClassName}
						resolveAssetUrl={resolveAssetUrl}
					>
						{blob.text}
					</Markdown>
				</SkeletonSuspense>
			) : (
				<p className="text-[13px] text-muted-foreground">
					Unable to load file content.
				</p>
			)}
		</Skeleton>
	);
}

const markdownDocumentClassName = "text-[15px] leading-6 text-text-header";

/** Mirrors what `Markdown` renders for a short README, without loading it. */
export function MarkdownDocumentSample() {
	return (
		<div className={cn(markdownRootClassName, markdownDocumentClassName)}>
			<h1 className={markdownHeadingClassNames.h1}>Project name</h1>
			<p className={markdownParagraphClassName}>
				A short description of what this project does, who it is for and why it
				exists, usually followed by a screenshot or a badge or two.
			</p>
			<h2 className={markdownHeadingClassNames.h2}>Getting started</h2>
			<p className={markdownParagraphClassName}>
				Install the dependencies, copy the example environment file and start
				the development server to see it running locally.
			</p>
		</div>
	);
}

const ABSOLUTE_MARKDOWN_URL_RE = /^[a-z][a-z\d+\-.]*:|^\/\//iu;

export function resolveGitHubMarkdownAssetUrl(
	{
		owner,
		repo,
		ref,
		path,
	}: { owner: string; repo: string; ref: string; path: string },
	url: string,
) {
	const trimmedUrl = url.trim();
	if (
		!trimmedUrl ||
		trimmedUrl.startsWith("#") ||
		ABSOLUTE_MARKDOWN_URL_RE.test(trimmedUrl)
	) {
		return trimmedUrl;
	}

	const rootUrl = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/raw/${encodePath(ref)}/`;
	const directoryPath = encodePath(getDirectoryPath(path));
	const baseUrl = trimmedUrl.startsWith("/")
		? rootUrl
		: directoryPath
			? new URL(`${directoryPath}/`, rootUrl).toString()
			: rootUrl;

	return new URL(trimmedUrl.replace(/^\/+/u, ""), baseUrl).toString();
}

function getDirectoryPath(path: string) {
	const lastSlashIndex = path.lastIndexOf("/");
	return lastSlashIndex === -1 ? "" : path.slice(0, lastSlashIndex);
}

function encodePath(path: string) {
	return path
		.split("/")
		.filter(Boolean)
		.map((segment) => encodeURIComponent(segment))
		.join("/");
}
