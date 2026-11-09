import {
	CheckIcon,
	ChevronDownIcon,
	CopyIcon,
	GitCommitIcon,
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
	CommentsChip,
	listRowClassName,
	RowAvatar,
	RowStateIcon,
	RowTime,
} from "#/components/shared/list-row";
import { splitCommitMessage } from "#/lib/commit-groups";
import { formatRelativeTime } from "#/lib/format-relative-time";
import type { RepoCommitSummary } from "#/lib/github.types";

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
	const bodyLines = body
		? body.split("\n").filter((line) => line.trim()).length
		: 0;
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
							<Chip asChild className="relative z-[1] shrink-0">
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
									className="tabular-nums transition-colors hover:text-foreground aria-expanded:text-foreground"
								>
									{bodyLines} {bodyLines === 1 ? "line" : "lines"}
									<ChevronDownIcon
										size={12}
										strokeWidth={2}
										className={cn(
											"transition-transform duration-150",
											expanded && "rotate-180",
										)}
									/>
								</button>
							</Chip>
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
				<div className="relative z-[1] hidden min-w-0 shrink items-center gap-1 md:flex">
					{commit.verified ? (
						<Chip className="shrink-0 text-pill-ok-text">Verified</Chip>
					) : null}
					<CommentsChip count={commit.commentCount} />
					<ShaButton owner={owner} repo={repo} sha={commit.sha} />
				</div>
				<span className="relative z-[1] hidden shrink-0 items-center gap-2 md:ml-3 md:flex">
					{commit.author ? (
						<Link
							to="/$owner"
							params={{ owner: commit.author.login }}
							data-action
							aria-label={authorLabel}
							className="flex rounded-full"
						>
							<RowAvatar actor={commit.author} />
						</Link>
					) : (
						<span title={authorLabel} className="flex">
							<RowAvatar actor={null} />
						</span>
					)}
					<Tooltip>
						<TooltipTrigger asChild>
							<RowTime dateTime={commit.date}>{time}</RowTime>
						</TooltipTrigger>
						<TooltipContent>
							{new Date(commit.date).toLocaleString()}
						</TooltipContent>
					</Tooltip>
				</span>
			</div>
			{expanded ? (
				<pre className="mb-2 ml-[19px] max-w-2xl px-3 font-sans text-xs leading-relaxed break-words whitespace-pre-wrap text-muted-foreground md:ml-[46px]">
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
		<span className="flex h-6 shrink-0 items-center overflow-hidden rounded-full bg-chip shadow-chip">
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
