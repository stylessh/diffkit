import { Skeleton } from "@diffkit/ui/components/skeleton";
import { cn } from "@diffkit/ui/lib/utils";
import {
	keepPreviousData,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import {
	lazy,
	Suspense,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import {
	type GitHubQueryScope,
	githubRepoFileContentQueryOptions,
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
	const mdFiles = useMemo(() => {
		const fileNames = new Set(entries.map((e) => e.name));
		return KNOWN_MD_FILES.filter((name) => fileNames.has(name));
	}, [entries]);

	// Prefetch all MD files in background so tab switches are instant
	const queryClient = useQueryClient();
	useEffect(() => {
		for (const file of mdFiles) {
			void queryClient.prefetchQuery(
				githubRepoFileContentQueryOptions(scope, {
					owner,
					repo,
					ref: currentRef,
					path: file,
				}),
			);
		}
	}, [queryClient, mdFiles, scope, owner, repo, currentRef]);

	const [activeTab, setActiveTab] = useState<string | null>(null);
	const selectedFile = activeTab ?? mdFiles[0] ?? null;

	if (mdFiles.length === 0) return null;

	return (
		<div className="flex flex-col gap-2">
			{/* Tab bar */}
			<div className="flex items-center gap-1">
				{mdFiles.map((file) => (
					<button
						key={file}
						type="button"
						onClick={() => setActiveTab(file)}
						className={cn(
							"rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
							file === selectedFile
								? "bg-secondary text-secondary-foreground"
								: "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
						)}
					>
						{TAB_LABELS[file] ?? file}
					</button>
				))}
			</div>

			{/* Content */}
			{selectedFile && (
				<div className="overflow-hidden rounded-lg border">
					<MarkdownFileContent
						owner={owner}
						repo={repo}
						path={selectedFile}
						currentRef={currentRef}
						scope={scope}
					/>
				</div>
			)}
		</div>
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
		...githubRepoFileContentQueryOptions(scope, {
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

	if (contentQuery.isLoading) {
		return (
			<div className="flex flex-col gap-3 p-6">
				<Skeleton className="h-6 w-48 rounded-md" />
				<Skeleton className="h-4 w-full rounded-md" />
				<Skeleton className="h-4 w-[90%] rounded-md" />
				<Skeleton className="h-4 w-[75%] rounded-md" />
				<Skeleton className="h-4 w-full rounded-md" />
				<Skeleton className="h-4 w-[60%] rounded-md" />
			</div>
		);
	}

	if (!contentQuery.data) {
		return (
			<div className="p-6 text-sm text-muted-foreground">
				Unable to load file content.
			</div>
		);
	}

	return (
		<div className="px-6 py-16">
			<Suspense
				fallback={
					<div className="flex flex-col gap-3">
						<Skeleton className="h-6 w-48 rounded-md" />
						<Skeleton className="h-4 w-full rounded-md" />
						<Skeleton className="h-4 w-[90%] rounded-md" />
					</div>
				}
			>
				<Markdown
					className="prose prose-sm dark:prose-invert mx-auto max-w-3xl"
					resolveAssetUrl={resolveAssetUrl}
				>
					{contentQuery.data}
				</Markdown>
			</Suspense>
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
