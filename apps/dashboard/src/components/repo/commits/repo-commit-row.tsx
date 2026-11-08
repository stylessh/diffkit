import {
	CheckIcon,
	CodeIcon,
	CommentIcon,
	CopyIcon,
	MoreHorizontalIcon,
} from "@diffkit/icons";
import { Skeleton } from "@diffkit/ui/components/skeleton";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@diffkit/ui/components/tooltip";
import { cn } from "@diffkit/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { splitCommitMessage } from "#/lib/commit-groups";
import { formatRelativeTime } from "#/lib/format-relative-time";
import type { RepoCommitSummary } from "#/lib/github.types";

const ROW_CLASS = "flex items-start gap-3 px-4 py-3";

export const RepoCommitRow = memo(function RepoCommitRow({
	commit,
	owner,
	repo,
}: {
	commit: RepoCommitSummary;
	owner: string;
	repo: string;
}) {
	const [expanded, setExpanded] = useState(false);
	const { subject, body } = splitCommitMessage(commit.message);
	const authorLabel = commit.author?.login ?? commit.authorName ?? "Unknown";

	return (
		<div className={cn(ROW_CLASS, "transition-colors hover:bg-surface-1/60")}>
			<div className="flex min-w-0 flex-1 flex-col gap-1">
				<div className="flex min-w-0 items-center gap-1.5">
					<Link
						to="/$owner/$repo/commit/$sha"
						params={{ owner, repo, sha: commit.sha }}
						className="min-w-0 truncate text-sm font-medium text-foreground hover:underline"
					>
						{subject || "(no message)"}
					</Link>
					{body ? (
						<button
							type="button"
							onClick={() => setExpanded((value) => !value)}
							aria-expanded={expanded}
							aria-label={
								expanded ? "Hide commit description" : "Show commit description"
							}
							className={cn(
								"flex h-4 shrink-0 items-center rounded px-1 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground",
								expanded && "bg-surface-2 text-foreground",
							)}
						>
							<MoreHorizontalIcon size={12} strokeWidth={2} />
						</button>
					) : null}
				</div>
				{expanded ? (
					<pre className="mt-1 max-w-2xl whitespace-pre-wrap break-words font-sans text-xs leading-relaxed text-muted-foreground">
						{body}
					</pre>
				) : null}
				<div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
					{commit.author ? (
						<Link
							to="/$owner"
							params={{ owner: commit.author.login }}
							className="flex shrink-0 items-center"
						>
							<img
								src={commit.author.avatarUrl}
								alt=""
								className="size-4 rounded-full"
								loading="lazy"
							/>
						</Link>
					) : (
						<span className="size-4 shrink-0 rounded-full bg-surface-2" />
					)}
					{commit.author ? (
						<Link
							to="/$owner"
							params={{ owner: commit.author.login }}
							className="truncate font-medium text-foreground hover:underline"
						>
							{authorLabel}
						</Link>
					) : (
						<span className="truncate font-medium text-foreground">
							{authorLabel}
						</span>
					)}
					<span className="shrink-0">committed</span>
					<Tooltip>
						<TooltipTrigger asChild>
							<time dateTime={commit.date} className="shrink-0 tabular-nums">
								{formatRelativeTime(commit.date)}
							</time>
						</TooltipTrigger>
						<TooltipContent>
							{new Date(commit.date).toLocaleString()}
						</TooltipContent>
					</Tooltip>
					{commit.commentCount > 0 ? (
						<span className="flex shrink-0 items-center gap-0.5">
							<CommentIcon size={12} />
							{commit.commentCount}
						</span>
					) : null}
				</div>
			</div>

			<div className="flex shrink-0 items-center gap-1.5 pt-0.5">
				{commit.verified ? (
					<span className="hidden rounded-full bg-pill-ok px-1.5 py-px text-[10px] font-medium text-pill-ok-text sm:inline">
						Verified
					</span>
				) : null}
				<ShaButton owner={owner} repo={repo} sha={commit.sha} />
				<Tooltip>
					<TooltipTrigger asChild>
						<Link
							to="/$owner/$repo/tree/$"
							params={{ owner, repo, _splat: commit.sha }}
							aria-label="Browse the repository at this commit"
							className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
						>
							<CodeIcon size={14} />
						</Link>
					</TooltipTrigger>
					<TooltipContent>Browse files at this commit</TooltipContent>
				</Tooltip>
			</div>
		</div>
	);
});

function ShaButton({
	owner,
	repo,
	sha,
}: {
	owner: string;
	repo: string;
	sha: string;
}) {
	const [copied, setCopied] = useState(false);
	const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
	useEffect(() => () => clearTimeout(timeoutRef.current), []);

	const copy = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(sha);
			setCopied(true);
			clearTimeout(timeoutRef.current);
			timeoutRef.current = setTimeout(() => setCopied(false), 1500);
		} catch {
			setCopied(false);
		}
	}, [sha]);

	return (
		<span className="flex items-center overflow-hidden rounded-md border-[0.5px] border-border/60">
			<Link
				to="/$owner/$repo/commit/$sha"
				params={{ owner, repo, sha }}
				className="px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-surface-1 hover:text-foreground"
			>
				{sha.slice(0, 7)}
			</Link>
			<Tooltip open={copied ? true : undefined}>
				<TooltipTrigger asChild>
					<button
						type="button"
						onClick={copy}
						aria-label="Copy full SHA"
						className="flex items-center border-l-[0.5px] border-border/60 px-1 py-[3px] text-muted-foreground transition-colors hover:bg-surface-1 hover:text-foreground"
					>
						{copied ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
					</button>
				</TooltipTrigger>
				<TooltipContent>{copied ? "Copied!" : "Copy full SHA"}</TooltipContent>
			</Tooltip>
		</span>
	);
}

export function RepoCommitRowSkeleton({ width }: { width: string }) {
	return (
		<div className={ROW_CLASS}>
			<div className="flex min-w-0 flex-1 flex-col gap-2">
				<Skeleton className="h-4 rounded" style={{ width }} />
				<div className="flex items-center gap-1.5">
					<Skeleton className="size-4 rounded-full" />
					<Skeleton className="h-3 w-32 rounded" />
				</div>
			</div>
			<Skeleton className="h-5 w-20 shrink-0 rounded-md" />
		</div>
	);
}
