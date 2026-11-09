import {
	CheckIcon,
	CodeIcon,
	CommentIcon,
	CopyIcon,
	GitCommitIcon,
	MoreHorizontalIcon,
} from "@diffkit/icons";
import { Chip } from "@diffkit/ui/components/chip";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@diffkit/ui/components/tooltip";
import { cn } from "@diffkit/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
	listRowClassName,
	RowAvatar,
	RowStateIcon,
	RowTime,
} from "#/components/shared/list-row";
import { splitCommitMessage } from "#/lib/commit-groups";
import { formatRelativeTime } from "#/lib/format-relative-time";
import type { RepoCommitSummary } from "#/lib/github.types";
import { iconButtonClassName } from "../repo-ui";

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
	const time = formatRelativeTime(commit.date, undefined, { compact: true });

	return (
		<div>
			<div
				className={cn(
					listRowClassName,
					"hover:[&:not(:has([data-action]:hover))]:before:bg-row-hover",
					expanded && "before:bg-row-selected",
				)}
			>
				<RowStateIcon className="text-muted-foreground">
					<GitCommitIcon size={14} strokeWidth={2} />
				</RowStateIcon>
				<div className="flex min-w-0 flex-1 flex-col gap-1 md:flex-row md:items-center md:gap-2">
					<span className="flex min-w-0 items-center gap-1.5">
						<Link
							to="/$owner/$repo/commit/$sha"
							params={{ owner, repo, sha: commit.sha }}
							title={subject || undefined}
							className="min-w-0 truncate rounded-sm text-[13px] font-medium text-foreground after:absolute after:inset-0 after:content-['']"
						>
							{subject || "(no message)"}
						</Link>
						{body ? (
							<button
								type="button"
								data-action
								onClick={() => setExpanded((value) => !value)}
								aria-expanded={expanded}
								aria-label={
									expanded
										? "Hide commit description"
										: "Show commit description"
								}
								className="relative z-[1] flex h-5 shrink-0 items-center rounded-md px-1.5 text-muted-foreground transition-colors hover:bg-ghost-hover hover:text-foreground aria-expanded:bg-ghost-hover aria-expanded:text-foreground"
							>
								<MoreHorizontalIcon size={12} strokeWidth={2} />
							</button>
						) : null}
						{commit.commentCount > 0 ? (
							<span
								className="hidden shrink-0 items-center gap-1 text-xs tabular-nums text-muted-foreground md:flex"
								title={`${commit.commentCount} comments`}
							>
								<CommentIcon size={12} strokeWidth={2} />
								{commit.commentCount}
							</span>
						) : null}
					</span>
					<p className="flex min-w-0 items-center gap-1 truncate text-xs text-muted-foreground md:hidden">
						<span className="truncate">{authorLabel}</span>
						<span aria-hidden>·</span>
						<span className="font-mono">{commit.sha.slice(0, 7)}</span>
						<span aria-hidden>·</span>
						<span className="tabular-nums">{time}</span>
					</p>
				</div>
				<div className="relative z-[1] hidden shrink-0 items-center gap-1.5 md:flex">
					{commit.verified ? (
						<Chip className="text-pill-ok-text">Verified</Chip>
					) : null}
					<ShaButton owner={owner} repo={repo} sha={commit.sha} />
					<Tooltip>
						<TooltipTrigger asChild>
							<Link
								to="/$owner/$repo/tree/$"
								params={{ owner, repo, _splat: commit.sha }}
								data-action
								aria-label="Browse the repository at this commit"
								className={iconButtonClassName}
							>
								<CodeIcon size={14} />
							</Link>
						</TooltipTrigger>
						<TooltipContent>Browse files at this commit</TooltipContent>
					</Tooltip>
				</div>
				<span className="relative z-[1] hidden shrink-0 items-center gap-2 md:flex">
					{commit.author ? (
						<Link
							to="/$owner"
							params={{ owner: commit.author.login }}
							data-action
							className="flex max-w-32 items-center gap-1.5 rounded-md text-xs font-[450] text-muted-foreground transition-colors hover:text-foreground"
						>
							<span className="truncate max-lg:hidden">{authorLabel}</span>
							<RowAvatar actor={commit.author} />
						</Link>
					) : (
						<>
							<span className="max-w-32 truncate text-xs font-[450] text-muted-foreground max-lg:hidden">
								{authorLabel}
							</span>
							<RowAvatar actor={null} />
						</>
					)}
					<Tooltip>
						<TooltipTrigger asChild>
							<time dateTime={commit.date}>
								<RowTime>{time}</RowTime>
							</time>
						</TooltipTrigger>
						<TooltipContent>
							{new Date(commit.date).toLocaleString()}
						</TooltipContent>
					</Tooltip>
				</span>
			</div>
			{expanded ? (
				<pre className="mb-2 ml-[19px] max-w-2xl px-3 font-sans text-xs leading-relaxed break-words whitespace-pre-wrap text-muted-foreground md:ml-[42px]">
					{body}
				</pre>
			) : null}
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
		<span className="flex h-6 items-center overflow-hidden rounded-full bg-chip shadow-chip">
			<Link
				to="/$owner/$repo/commit/$sha"
				params={{ owner, repo, sha }}
				data-action
				className="flex h-full items-center pr-1 pl-2 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
			>
				{sha.slice(0, 7)}
			</Link>
			<Tooltip open={copied ? true : undefined}>
				<TooltipTrigger asChild>
					<button
						type="button"
						onClick={copy}
						aria-label="Copy full SHA"
						data-action
						className="flex h-full items-center pr-2 pl-1 text-muted-foreground transition-colors hover:text-foreground"
					>
						{copied ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
					</button>
				</TooltipTrigger>
				<TooltipContent>{copied ? "Copied!" : "Copy full SHA"}</TooltipContent>
			</Tooltip>
		</span>
	);
}
