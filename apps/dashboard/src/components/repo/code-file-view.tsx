import { FileIcon, FolderIcon, PackageIcon } from "@diffkit/icons";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@diffkit/ui/components/tooltip";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { lazy, type ReactNode, useCallback, useState } from "react";
import { Skeleton, SkeletonSuspense } from "skullet/react";
import {
	detectLang,
	formatFileSize,
	isMarkdownPath,
	isSvgPath,
} from "#/lib/code-browsing/languages";
import type { RepoBlob } from "#/lib/code-browsing/types";
import { formatRelativeTime } from "#/lib/format-relative-time";
import {
	type GitHubQueryScope,
	githubFileLastCommitQueryOptions,
	githubRepoBlobQueryOptions,
} from "#/lib/github.query";
import type { FileLastCommit, RepoTreeEntry } from "#/lib/github.types";
import {
	BlobHeader,
	type BlobLocation,
	base64Bytes,
	downloadBytes,
	SegmentLinks,
	SegmentToggle,
} from "./code/blob-header";
import { CodeLines, countLines } from "./code/code-lines";
import { SAMPLE_CODE } from "./code/code-samples";
import { useLineSelection } from "./code/use-line-selection";
import { usePermalink } from "./code/use-permalink";
import { CommitHistoryLink } from "./commits/commit-history-link";
import {
	MarkdownDocumentSample,
	resolveGitHubMarkdownAssetUrl,
} from "./repo-markdown-files";
import { SAMPLE_COMMIT } from "./repo-samples";
import { RepoAvatar, RepoCard, RepoCardHead, RepoEmptyState } from "./repo-ui";

const Markdown = lazy(() =>
	import("@diffkit/ui/components/markdown").then((mod) => ({
		default: mod.Markdown,
	})),
);

type CodeFileViewProps = {
	location: BlobLocation;
	scope: GitHubQueryScope;
	entry: RepoTreeEntry | undefined;
};

export function CodeFileView({ location, scope, entry }: CodeFileViewProps) {
	const blobQuery = useQuery(githubRepoBlobQueryOptions(scope, location));
	const commitQuery = useQuery(
		githubFileLastCommitQueryOptions(scope, location),
	);
	const copyPermalink = usePermalink(scope, { ...location, view: "blob" });

	return (
		<RepoCard>
			<FileCommitBar location={location} commit={commitQuery.data} />
			{blobQuery.data ? (
				<BlobContent
					key={`${location.ref}:${location.path}`}
					blob={blobQuery.data}
					location={location}
					onCopyPermalink={copyPermalink}
				/>
			) : (
				<>
					<BlobHeader
						location={location}
						leading={<SegmentLinks location={location} view="blob" />}
						stats={entry?.size != null ? formatFileSize(entry.size) : null}
						onCopyPermalink={copyPermalink}
					/>
					{blobQuery.error ? (
						<RepoEmptyState title="Couldn't load this file">
							{blobQuery.error.message}
						</RepoEmptyState>
					) : (
						<Skeleton loading label="Loading file">
							<CodeSample />
						</Skeleton>
					)}
				</>
			)}
		</RepoCard>
	);
}

function fileNameOf(path: string) {
	return path.slice(path.lastIndexOf("/") + 1);
}

function BlobContent({
	blob,
	location,
	onCopyPermalink,
}: {
	blob: RepoBlob;
	location: BlobLocation;
	onCopyPermalink: () => void;
}) {
	const fileName = fileNameOf(location.path);
	const header: HeaderRenderer = (props) => (
		<BlobHeader
			location={location}
			leading={
				<>
					{props.canBlame === false ? null : (
						<SegmentLinks location={location} view="blob" />
					)}
					{props.toggle ? (
						<>
							<span aria-hidden className="h-4 w-[0.5px] bg-card-border" />
							{props.toggle}
						</>
					) : null}
				</>
			}
			stats={props.stats}
			copyText={props.copyText}
			onDownload={props.onDownload}
			onCopyPermalink={onCopyPermalink}
		/>
	);

	switch (blob.kind) {
		case "text":
			return <TextBlob blob={blob} location={location} header={header} />;
		case "image": {
			const download = () =>
				downloadBytes(fileName, base64Bytes(blob.base64), blob.mimeType);
			return (
				<>
					{header({
						stats: formatFileSize(blob.size),
						onDownload: download,
						canBlame: false,
					})}
					<ImagePreview
						src={`data:${blob.mimeType};base64,${blob.base64}`}
						alt={fileName}
					/>
				</>
			);
		}
		case "binary":
			return (
				<>
					{header({
						stats: formatFileSize(blob.size),
						onDownload: () =>
							downloadBytes(
								fileName,
								base64Bytes(blob.base64),
								"application/octet-stream",
							),
						canBlame: false,
					})}
					<RepoEmptyState icon={<FileIcon />} title="Binary file not shown">
						{formatFileSize(blob.size)} · download it or view the raw file on
						GitHub.
					</RepoEmptyState>
				</>
			);
		case "tooLarge":
			return (
				<>
					{header({
						stats: blob.size != null ? formatFileSize(blob.size) : null,
						canBlame: false,
					})}
					<RepoEmptyState
						icon={<FileIcon />}
						title="This file is too large to display"
					>
						GitHub only serves files up to 1 MB through its API
						{blob.size != null
							? `; this one is ${formatFileSize(blob.size)}`
							: ""}
						. View the raw file on GitHub instead.
					</RepoEmptyState>
				</>
			);
		case "submodule":
			return (
				<>
					{header({ canBlame: false })}
					<RepoEmptyState icon={<PackageIcon />} title="Submodule">
						Pinned at <code className="font-mono">{blob.sha.slice(0, 7)}</code>.
					</RepoEmptyState>
				</>
			);
		case "missing":
			return (
				<>
					{header({ canBlame: false })}
					<RepoEmptyState
						icon={<FolderIcon />}
						title={`${fileName} doesn't exist at ${location.ref}`}
						action={
							<Link
								to="/$owner/$repo/tree/$"
								params={{
									owner: location.owner,
									repo: location.repo,
									_splat: location.ref,
								}}
								className="text-[13px] font-medium text-foreground hover:underline"
							>
								Browse {location.ref}
							</Link>
						}
					/>
				</>
			);
	}
}

type HeaderProps = {
	stats?: ReactNode;
	copyText?: string;
	onDownload?: () => void;
	toggle?: ReactNode;
	canBlame?: boolean;
};

type HeaderRenderer = (props: HeaderProps) => ReactNode;

type TextMode = "preview" | "code";

function initialTextMode(path: string): TextMode {
	const previewable = isMarkdownPath(path) || isSvgPath(path);
	const linkedToLines =
		typeof window !== "undefined" && window.location.hash.startsWith("#L");
	return previewable && !linkedToLines ? "preview" : "code";
}

function TextBlob({
	blob,
	location,
	header,
}: {
	blob: Extract<RepoBlob, { kind: "text" }>;
	location: BlobLocation;
	header: HeaderRenderer;
}) {
	const code = blob.text.replace(/\n$/, "");
	const lineCount = countLines(code);
	const previewable = isMarkdownPath(location.path) || isSvgPath(location.path);
	const [mode, setMode] = useState<TextMode>(() =>
		initialTextMode(location.path),
	);
	const fileName = fileNameOf(location.path);
	const stats = `${lineCount.toLocaleString()} ${lineCount === 1 ? "line" : "lines"} · ${formatFileSize(blob.size)}`;

	return (
		<>
			{header({
				stats,
				copyText: blob.text,
				onDownload: () => downloadBytes(fileName, blob.text, "text/plain"),
				toggle: previewable ? (
					<SegmentToggle
						label="Display"
						value={mode}
						onChange={setMode}
						options={[
							{ value: "preview", label: "Preview" },
							{ value: "code", label: "Source" },
						]}
					/>
				) : null,
			})}
			{mode === "preview" && isSvgPath(location.path) ? (
				<ImagePreview
					src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(blob.text)}`}
					alt={fileName}
				/>
			) : mode === "preview" ? (
				<MarkdownPreview text={blob.text} location={location} />
			) : (
				<SelectableCode
					code={code}
					lang={detectLang(location.path)}
					lineCount={lineCount}
				/>
			)}
		</>
	);
}

function SelectableCode({
	code,
	lang,
	lineCount,
}: {
	code: string;
	lang: string;
	lineCount: number;
}) {
	const { range, select } = useLineSelection(lineCount);
	return (
		<CodeLines
			code={code}
			lang={lang}
			lineCount={lineCount}
			selection={range}
			onSelectLine={select}
		/>
	);
}

function MarkdownPreview({
	text,
	location,
}: {
	text: string;
	location: BlobLocation;
}) {
	const resolveAssetUrl = useCallback(
		(url: string) => resolveGitHubMarkdownAssetUrl(location, url),
		[location],
	);
	return (
		<div className="px-6 py-5 md:px-8">
			<SkeletonSuspense
				skeleton={<MarkdownDocumentSample />}
				label="Loading preview"
			>
				<Markdown
					className="text-[15px] leading-6 text-text-header"
					resolveAssetUrl={resolveAssetUrl}
				>
					{text}
				</Markdown>
			</SkeletonSuspense>
		</div>
	);
}

function ImagePreview({ src, alt }: { src: string; alt: string }) {
	return (
		<div className="flex items-center justify-center bg-surface-0 p-8">
			<img
				src={src}
				alt={alt}
				className="max-h-[70vh] max-w-full object-contain"
			/>
		</div>
	);
}

function FileCommitBar({
	location,
	commit,
}: {
	location: BlobLocation;
	commit: FileLastCommit | null | undefined;
}) {
	if (commit === null) return null;

	return (
		<Skeleton
			data={commit}
			sample={SAMPLE_COMMIT}
			label="Loading latest commit"
		>
			{(commit) => <FileCommitHead location={location} commit={commit} />}
		</Skeleton>
	);
}

function FileCommitHead({
	location,
	commit,
}: {
	location: BlobLocation;
	commit: FileLastCommit;
}) {
	return (
		<RepoCardHead>
			{commit.author ? (
				<RepoAvatar src={commit.author.avatarUrl} alt={commit.author.login} />
			) : null}
			<p className="min-w-0 flex-1 truncate font-[450] text-muted-foreground">
				<span className="font-medium text-foreground">
					{commit.author?.login ?? "Unknown"}
				</span>{" "}
				<Link
					to="/$owner/$repo/commit/$sha"
					params={{
						owner: location.owner,
						repo: location.repo,
						sha: commit.sha,
					}}
					className="rounded-sm transition-colors hover:text-foreground"
				>
					{commit.message.split("\n")[0]}
				</Link>
			</p>
			<div className="flex shrink-0 items-center gap-1 text-xs font-[450] text-muted-foreground">
				<Tooltip>
					<TooltipTrigger asChild>
						<span className="mr-2 font-mono max-sm:hidden">
							{commit.sha.slice(0, 7)}
						</span>
					</TooltipTrigger>
					<TooltipContent side="bottom">
						<code>{commit.sha}</code>
					</TooltipContent>
				</Tooltip>
				<time dateTime={commit.date} className="mr-1 tabular-nums">
					{formatRelativeTime(commit.date)}
				</time>
				<CommitHistoryLink
					owner={location.owner}
					repo={location.repo}
					ref={location.ref}
					path={location.path}
					className="-mr-2"
				/>
			</div>
		</RepoCardHead>
	);
}

const SAMPLE_CODE_LINE_COUNT = countLines(SAMPLE_CODE);

function ignoreLineSelection() {}

export function CodeSample({ gutter }: { gutter?: ReactNode }) {
	return (
		<CodeLines
			code={SAMPLE_CODE}
			lang="text"
			lineCount={SAMPLE_CODE_LINE_COUNT}
			selection={null}
			onSelectLine={ignoreLineSelection}
			gutter={gutter}
		/>
	);
}
