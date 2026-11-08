import { GitBranchIcon, GitCommitIcon } from "@diffkit/icons";
import { Markdown } from "@diffkit/ui/components/markdown";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@diffkit/ui/components/tooltip";
import { cn } from "@diffkit/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { useCallback } from "react";
import { TagIcon } from "#/components/repo/refs/tag-icon";
import { resolveGitHubMarkdownAssetUrl } from "#/components/repo/repo-markdown-files";
import { formatRelativeTime } from "#/lib/format-relative-time";
import type { GitHubQueryScope } from "#/lib/github.query";
import type { RepoRelease } from "#/lib/github.types";
import { ReleaseAssets } from "./release-assets";
import { ReleaseCardActions } from "./release-card-actions";
import {
	type ReleaseStatusBadge,
	releaseStatusBadges,
} from "./release-save-utils";

const SHA_RE = /^[0-9a-f]{40}$/i;
/** Bodies longer than this get clamped in the list with a "Read more" link. */
const LONG_BODY_CHARS = 1400;

const STATUS_BADGE: Record<
	ReleaseStatusBadge,
	{ label: string; className: string }
> = {
	draft: {
		label: "Draft",
		className: "border-border text-muted-foreground",
	},
	prerelease: {
		label: "Pre-release",
		className: "border-amber-500/40 text-amber-600 dark:text-amber-400",
	},
	latest: {
		label: "Latest",
		className: "border-green-500/40 text-green-600 dark:text-green-400",
	},
};

function formatDate(iso: string) {
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
						"rounded-full border px-2 py-px text-[11px] font-medium",
						STATUS_BADGE[badge].className,
					)}
				>
					{STATUS_BADGE[badge].label}
				</span>
			))}
		</>
	);
}

function ReleaseMeta({
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
			<Link
				to="/$owner/$repo/tree/$"
				params={{ owner, repo, _splat: release.tagName }}
				className="flex items-center gap-1 rounded-md bg-surface-1 px-1.5 py-0.5 font-mono text-foreground transition-colors hover:bg-surface-2"
			>
				<TagIcon size={12} />
				{release.tagName}
			</Link>
			{target ? (
				<Tooltip>
					<TooltipTrigger asChild>
						{targetIsSha ? (
							<Link
								to="/$owner/$repo/commit/$sha"
								params={{ owner, repo, sha: target }}
								className="flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono transition-colors hover:bg-surface-1 hover:text-foreground"
							>
								<GitCommitIcon size={12} />
								{target.slice(0, 7)}
							</Link>
						) : (
							<Link
								to="/$owner/$repo/commits/$"
								params={{ owner, repo, _splat: target }}
								className="flex min-w-0 items-center gap-1 rounded-md px-1.5 py-0.5 font-mono transition-colors hover:bg-surface-1 hover:text-foreground"
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

function ReleaseByline({ release }: { release: RepoRelease }) {
	const when = release.publishedAt ?? release.createdAt;
	const verb = release.isDraft ? "drafted" : "released";
	return (
		<p className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
			{release.author ? (
				<>
					<img
						src={release.author.avatarUrl}
						alt=""
						className="size-4 rounded-full"
					/>
					<Link
						to="/$owner"
						params={{ owner: release.author.login }}
						className="font-medium text-foreground hover:underline"
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
				<TooltipContent>{formatDate(when)}</TooltipContent>
			</Tooltip>
		</p>
	);
}

/**
 * Changelog-style release card: metadata column + rendered notes. `list`
 * clamps long notes and folds assets; `detail` shows everything.
 */
export function ReleaseCard({
	owner,
	repo,
	scope,
	release,
	variant = "list",
	canPush,
	onDeleted,
}: {
	owner: string;
	repo: string;
	scope: GitHubQueryScope;
	release: RepoRelease;
	variant?: "list" | "detail";
	canPush: boolean;
	onDeleted?: () => void;
}) {
	const isDetail = variant === "detail";
	const Heading = isDetail ? "h1" : "h2";
	const isLong = !isDetail && release.body.length > LONG_BODY_CHARS;
	const resolveAssetUrl = useCallback(
		(url: string) =>
			resolveGitHubMarkdownAssetUrl(
				{ owner, repo, ref: release.tagName, path: "" },
				url,
			),
		[owner, repo, release.tagName],
	);

	const titleNode = isDetail ? (
		release.name
	) : (
		<Link
			to="/$owner/$repo/releases/$tag"
			params={{ owner, repo, tag: release.tagName }}
			className="underline-offset-4 hover:underline"
		>
			{release.name}
		</Link>
	);

	return (
		<article
			aria-labelledby={`release-${release.id}-title`}
			className={cn(
				"group/release relative rounded-xl border bg-surface-0",
				isDetail
					? "flex flex-col gap-6 p-5 sm:p-6"
					: "grid grid-cols-1 gap-5 p-5 lg:grid-cols-[minmax(11rem,14rem)_minmax(0,1fr)] lg:gap-8",
			)}
		>
			<header
				className={cn(
					"flex min-w-0 flex-col gap-3",
					!isDetail && "lg:sticky lg:top-6 lg:self-start",
				)}
			>
				<div className="flex items-start justify-between gap-2">
					<div className="flex flex-wrap items-center gap-1.5">
						<ReleaseStatusBadges release={release} />
					</div>
					{canPush ? (
						<ReleaseCardActions
							owner={owner}
							repo={repo}
							scope={scope}
							release={release}
							onDeleted={onDeleted}
							className={cn(
								!isDetail &&
									"lg:absolute lg:right-4 lg:top-4 lg:opacity-0 lg:transition-opacity lg:group-hover/release:opacity-100 lg:focus-within:opacity-100",
							)}
						/>
					) : null}
				</div>
				<Heading
					id={`release-${release.id}-title`}
					className={cn(
						"font-semibold leading-snug tracking-tight text-foreground [overflow-wrap:anywhere]",
						isDetail ? "text-2xl" : "text-lg",
					)}
				>
					{titleNode}
				</Heading>
				<ReleaseByline release={release} />
				<ReleaseMeta owner={owner} repo={repo} release={release} />
			</header>

			<div className="flex min-w-0 flex-col gap-4">
				{release.body.trim() ? (
					<div
						className={cn(
							"relative",
							isLong && "max-h-[26rem] overflow-hidden",
						)}
					>
						<Markdown
							className="prose prose-sm dark:prose-invert max-w-none"
							resolveAssetUrl={resolveAssetUrl}
						>
							{release.body}
						</Markdown>
						{isLong ? (
							<div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-surface-0 to-transparent" />
						) : null}
					</div>
				) : (
					<p className="text-sm text-muted-foreground">No release notes.</p>
				)}
				{isLong ? (
					<Link
						to="/$owner/$repo/releases/$tag"
						params={{ owner, repo, tag: release.tagName }}
						className="w-fit text-sm font-medium text-muted-foreground hover:text-foreground hover:underline"
					>
						Read full release notes
					</Link>
				) : null}
				<ReleaseAssets
					owner={owner}
					repo={repo}
					release={release}
					collapsible={!isDetail}
				/>
			</div>
		</article>
	);
}
