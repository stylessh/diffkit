import { FileIcon, GitCommitIcon } from "@diffkit/icons";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@diffkit/ui/components/hover-card";
import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { memo } from "react";
import { detectLang } from "#/lib/code-browsing/languages";
import type {
	BlameCommit,
	BlameRange,
	RepoBlame,
	RepoBlob,
} from "#/lib/code-browsing/types";
import { formatRelativeTime } from "#/lib/format-relative-time";
import {
	type GitHubQueryScope,
	githubRepoBlameQueryOptions,
	githubRepoBlobQueryOptions,
} from "#/lib/github.query";
import { CodeSkeleton } from "../code-file-view";
import { RepoAvatar, RepoCard, RepoEmptyState } from "../repo-ui";
import { BlobHeader, type BlobLocation, SegmentLinks } from "./blob-header";
import { CODE_LINE_HEIGHT_PX, CodeLines, countLines } from "./code-lines";
import { useLineSelection } from "./use-line-selection";
import { usePermalink } from "./use-permalink";

type BlameViewState =
	| { status: "loading" }
	| { status: "error"; message: string }
	| { status: "unavailable"; reason: string }
	| {
			status: "ready";
			code: string;
			blame: Extract<RepoBlame, { status: "ok" }>;
	  };

function blameViewState(
	blobQuery: UseQueryResult<RepoBlob>,
	blameQuery: UseQueryResult<RepoBlame>,
): BlameViewState {
	const error = blobQuery.error ?? blameQuery.error;
	if (error) return { status: "error", message: error.message };
	const blob = blobQuery.data;
	if (blob && blob.kind !== "text") {
		return {
			status: "unavailable",
			reason:
				blob.kind === "missing"
					? "This file doesn't exist at this ref."
					: "Blame is only available for text files.",
		};
	}
	const blame = blameQuery.data;
	if (blame?.status === "missing") {
		return {
			status: "unavailable",
			reason: "GitHub has no blame for this file.",
		};
	}
	if (!blob || !blame) return { status: "loading" };
	return { status: "ready", code: blob.text.replace(/\n$/, ""), blame };
}

function commitCount(blame: Extract<RepoBlame, { status: "ok" }>) {
	const count = Object.keys(blame.commits).length;
	return `${count} ${count === 1 ? "commit" : "commits"}`;
}

export function BlameView({
	location,
	scope,
}: {
	location: BlobLocation;
	scope: GitHubQueryScope;
}) {
	const blobQuery = useQuery(githubRepoBlobQueryOptions(scope, location));
	const blameQuery = useQuery(githubRepoBlameQueryOptions(scope, location));
	const copyPermalink = usePermalink(scope, { ...location, view: "blame" });
	const state = blameViewState(blobQuery, blameQuery);

	return (
		<RepoCard>
			<BlobHeader
				location={location}
				leading={<SegmentLinks location={location} view="blame" />}
				stats={state.status === "ready" ? commitCount(state.blame) : null}
				onCopyPermalink={copyPermalink}
			/>
			<BlameBody state={state} location={location} />
		</RepoCard>
	);
}

function BlameBody({
	state,
	location,
}: {
	state: BlameViewState;
	location: BlobLocation;
}) {
	switch (state.status) {
		case "loading":
			return <CodeSkeleton />;
		case "error":
			return (
				<RepoEmptyState title="Couldn't load blame">
					{state.message}
				</RepoEmptyState>
			);
		case "unavailable":
			return (
				<RepoEmptyState icon={<FileIcon />} title="Blame unavailable">
					{state.reason}
				</RepoEmptyState>
			);
		case "ready":
			return (
				<BlameLines code={state.code} blame={state.blame} location={location} />
			);
	}
}

function BlameLines({
	code,
	blame,
	location,
}: {
	code: string;
	blame: Extract<RepoBlame, { status: "ok" }>;
	location: BlobLocation;
}) {
	const lineCount = countLines(code);
	const { range, select } = useLineSelection(lineCount);
	return (
		<CodeLines
			code={code}
			lang={detectLang(location.path)}
			lineCount={lineCount}
			selection={range}
			onSelectLine={select}
			gutter={
				<BlameGutter
					ranges={blame.ranges}
					commits={blame.commits}
					location={location}
				/>
			}
		/>
	);
}

const BlameGutter = memo(function BlameGutter({
	ranges,
	commits,
	location,
}: {
	ranges: BlameRange[];
	commits: Record<string, BlameCommit>;
	location: BlobLocation;
}) {
	return (
		<div className="w-[92px] shrink-0 border-r-[0.5px] border-card-border py-2 font-sans md:w-[300px]">
			{ranges.map((range, index) => {
				const commit = commits[range.commitOid];
				if (!commit) return null;
				const continues = ranges[index - 1]?.commitOid === range.commitOid;
				return (
					<div
						key={`${range.start}-${range.commitOid}`}
						className="relative border-t-[0.5px] border-card-border first:border-t-0"
						style={{
							height: (range.end - range.start + 1) * CODE_LINE_HEIGHT_PX,
						}}
					>
						<span
							aria-hidden
							className="absolute inset-y-0 left-0 w-0.5 bg-indigo"
							style={{ opacity: Math.max(0.12, 1 - (range.age - 1) / 9) }}
						/>
						{continues ? null : (
							<BlameEntry commit={commit} location={location} />
						)}
					</div>
				);
			})}
		</div>
	);
});

function BlameEntry({
	commit,
	location,
}: {
	commit: BlameCommit;
	location: BlobLocation;
}) {
	return (
		<HoverCard openDelay={300}>
			<HoverCardTrigger asChild>
				<Link
					to="/$owner/$repo/commit/$sha"
					params={{
						owner: location.owner,
						repo: location.repo,
						sha: commit.oid,
					}}
					className="flex h-5 min-w-0 items-center gap-2 pr-3 pl-3 text-xs text-muted-foreground hover:text-foreground"
				>
					{commit.avatarUrl ? (
						<RepoAvatar src={commit.avatarUrl} alt="" size={14} />
					) : null}
					<span className="min-w-0 flex-1 truncate max-md:hidden">
						{commit.headline}
					</span>
					<time
						dateTime={commit.committedDate}
						className="ml-auto shrink-0 tabular-nums"
					>
						{formatRelativeTime(commit.committedDate, undefined, {
							compact: true,
						})}
					</time>
				</Link>
			</HoverCardTrigger>
			<HoverCardContent align="start" side="right" className="w-80">
				<BlameCommitCard commit={commit} location={location} />
			</HoverCardContent>
		</HoverCard>
	);
}

const cardLinkClassName =
	"flex h-8 items-center gap-2 rounded-lg px-2 text-[13px] text-text-header transition-colors hover:bg-menu-hover hover:text-foreground";

function BlameCommitCard({
	commit,
	location,
}: {
	commit: BlameCommit;
	location: BlobLocation;
}) {
	const repoParams = { owner: location.owner, repo: location.repo };
	return (
		<div className="flex flex-col">
			<div className="flex flex-col gap-2 border-b-[0.5px] border-popover-border p-3">
				<div className="flex items-center gap-2 text-xs text-muted-foreground">
					{commit.avatarUrl ? (
						<RepoAvatar src={commit.avatarUrl} alt="" size={16} />
					) : null}
					<span className="font-medium text-text-header">
						{commit.authorName}
					</span>
					<span>committed {formatRelativeTime(commit.committedDate)}</span>
				</div>
				<p className="text-[13px] font-medium text-foreground">
					{commit.headline}
				</p>
				<code className="font-mono text-xs text-muted-foreground">
					{commit.abbreviatedOid}
				</code>
			</div>
			<div className="flex flex-col p-1">
				<Link
					to="/$owner/$repo/commit/$sha"
					params={{ ...repoParams, sha: commit.oid }}
					className={cardLinkClassName}
				>
					<GitCommitIcon size={14} className="text-muted-foreground" />
					View commit
				</Link>
				<Link
					to="/$owner/$repo/blob/$"
					params={{ ...repoParams, _splat: `${commit.oid}/${location.path}` }}
					className={cardLinkClassName}
				>
					<FileIcon size={14} className="text-muted-foreground" />
					View file at this commit
				</Link>
				{commit.parentOid ? (
					<Link
						to="/$owner/$repo/blame/$"
						params={{
							...repoParams,
							_splat: `${commit.parentOid}/${location.path}`,
						}}
						className={cardLinkClassName}
					>
						<GitCommitIcon size={14} className="text-muted-foreground" />
						Blame prior to this change
					</Link>
				) : null}
			</div>
		</div>
	);
}
