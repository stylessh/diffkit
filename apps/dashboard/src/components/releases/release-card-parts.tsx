import { GitBranchIcon, GitCommitIcon, TagIcon } from "@diffkit/icons";
import { Chip } from "@diffkit/ui/components/chip";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@diffkit/ui/components/tooltip";
import { cn } from "@diffkit/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { useCallback } from "react";
import { AppMarkdown } from "#/components/markdown/app-markdown";
import { resolveGitHubMarkdownAssetUrl } from "#/components/repo/repo-markdown-files";
import { formatRelativeTime } from "#/lib/format-relative-time";
import type { RepoRelease } from "#/lib/github.types";
import {
	type ReleaseStatusBadge,
	releaseStatusBadges,
} from "./release-save-utils";

const SHA_RE = /^[0-9a-f]{40}$/i;

const STATUS_BADGE: Record<
	ReleaseStatusBadge,
	{ label: string; className: string }
> = {
	draft: {
		label: "Draft",
		className: "bg-pill-neutral text-muted-foreground",
	},
	prerelease: {
		label: "Pre-release",
		className: "bg-pill-warning text-pill-warning-text",
	},
	latest: {
		label: "Latest",
		className: "bg-pill-ok text-pill-ok-text",
	},
};
export function formatReleaseDate(iso: string) {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return iso;
	return date.toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}
export function ReleaseStatusBadges({ release }: { release: RepoRelease }) {
	const badges = releaseStatusBadges(release);
	if (badges.length === 0) return null;
	return (
		<>
			{badges.map((badge) => (
				<span
					key={badge}
					className={cn(
						"inline-flex h-5 shrink-0 items-center whitespace-nowrap rounded-full px-2 text-[11px] font-medium",
						STATUS_BADGE[badge].className,
					)}
				>
					{STATUS_BADGE[badge].label}
				</span>
			))}
		</>
	);
}
export function ReleaseMeta({
	owner,
	repo,
	release,
}: {
	owner: string;
	repo: string;
	release: RepoRelease;
}) {
	const target = release.targetCommitish;
	const targetIsSha = SHA_RE.test(target);
	return (
		<div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
			<Chip
				asChild
				className="font-mono text-text-header hover:text-foreground"
			>
				<Link
					to="/$owner/$repo/tree/$"
					params={{ owner, repo, _splat: release.tagName }}
				>
					<TagIcon size={12} strokeWidth={2} />
					{release.tagName}
				</Link>
			</Chip>
			{target ? (
				<Tooltip>
					<TooltipTrigger asChild>
						{targetIsSha ? (
							<Link
								to="/$owner/$repo/commit/$sha"
								params={{ owner, repo, sha: target }}
								className="flex h-6 items-center gap-1 rounded-md px-2 font-mono transition-colors hover:bg-ghost-hover hover:text-foreground"
							>
								<GitCommitIcon size={12} />
								{target.slice(0, 7)}
							</Link>
						) : (
							<Link
								to="/$owner/$repo/commits/$"
								params={{ owner, repo, _splat: target }}
								className="flex h-6 min-w-0 items-center gap-1 rounded-md px-2 font-mono transition-colors hover:bg-ghost-hover hover:text-foreground"
							>
								<GitBranchIcon size={12} />
								<span className="max-w-32 truncate">{target}</span>
							</Link>
						)}
					</TooltipTrigger>
					<TooltipContent>
						Target {targetIsSha ? "commit" : "branch"}
					</TooltipContent>
				</Tooltip>
			) : null}
		</div>
	);
}
export function ReleaseByline({ release }: { release: RepoRelease }) {
	const when = release.publishedAt ?? release.createdAt;
	const verb = release.isDraft ? "drafted" : "released";
	return (
		<p className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs font-[450] text-muted-foreground">
			{release.author ? (
				<>
					<img
						src={release.author.avatarUrl}
						alt=""
						className="size-4 rounded-full ring-[0.5px] ring-chip-border"
					/>
					<Link
						to="/$owner"
						params={{ owner: release.author.login }}
						className="font-medium text-text-header hover:text-foreground"
					>
						{release.author.login}
					</Link>
				</>
			) : null}
			<span>{verb}</span>
			<Tooltip>
				<TooltipTrigger asChild>
					<time dateTime={when} className="tabular-nums">
						{formatRelativeTime(when)}
					</time>
				</TooltipTrigger>
				<TooltipContent>{formatReleaseDate(when)}</TooltipContent>
			</Tooltip>
		</p>
	);
}

/** Rendered release notes. `clamped` caps long notes and fades them into the page. */
export function ReleaseNotes({
	owner,
	repo,
	release,
	clamped = false,
	className,
}: {
	owner: string;
	repo: string;
	release: RepoRelease;
	clamped?: boolean;
	className?: string;
}) {
	const resolveAssetUrl = useCallback(
		(url: string) =>
			resolveGitHubMarkdownAssetUrl(
				{ owner, repo, ref: release.tagName, path: "" },
				url,
			),
		[owner, repo, release.tagName],
	);

	if (!release.body.trim()) {
		return (
			<p className="text-[13px] text-muted-foreground">No release notes.</p>
		);
	}
	return (
		<div className={cn("relative", clamped && "max-h-[26rem] overflow-hidden")}>
			<AppMarkdown
				owner={owner}
				repo={repo}
				className={className}
				resolveAssetUrl={resolveAssetUrl}
			>
				{release.body}
			</AppMarkdown>
			{clamped ? (
				<div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-main to-transparent" />
			) : null}
		</div>
	);
}
