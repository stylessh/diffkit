import {
	ChevronRightIcon,
	GitBranchIcon,
	GitCommitIcon,
	TagIcon,
} from "@diffkit/icons";
import { Chip } from "@diffkit/ui/components/chip";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@diffkit/ui/components/tooltip";
import { cn } from "@diffkit/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { AppMarkdown } from "#/components/markdown/app-markdown";
import { resolveGitHubMarkdownAssetUrl } from "#/components/repo/repo-markdown-files";
import { formatRelativeTime } from "#/lib/format-relative-time";
import type { GitHubQueryScope } from "#/lib/github.query";
import type { RepoRelease } from "#/lib/github.types";
import { plainExcerpt } from "#/lib/plain-excerpt";
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

function ReleaseByline({ release }: { release: RepoRelease }) {
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
	defaultOpen = true,
}: {
	owner: string;
	repo: string;
	scope: GitHubQueryScope;
	release: RepoRelease;
	variant?: "list" | "detail";
	canPush: boolean;
	onDeleted?: () => void;
	/** In the list, whether the notes start open; only the newest does. */
	defaultOpen?: boolean;
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
			className="rounded-sm transition-colors hover:text-text-strong"
		>
			{release.name}
		</Link>
	);

	if (!isDetail) {
		return (
			<ReleaseTimelineItem
				owner={owner}
				repo={repo}
				scope={scope}
				release={release}
				canPush={canPush}
				onDeleted={onDeleted}
				resolveAssetUrl={resolveAssetUrl}
				defaultOpen={defaultOpen}
			/>
		);
	}

	return (
		<article
			aria-labelledby={`release-${release.id}-title`}
			className={cn(
				"group/release relative",
				isDetail
					? "flex flex-col gap-8"
					: "grid grid-cols-1 gap-5 rounded-lg bg-surface-0 p-5 shadow-card lg:grid-cols-[minmax(11rem,13rem)_minmax(0,1fr)] lg:gap-8",
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
						"font-semibold text-foreground [overflow-wrap:anywhere]",
						isDetail ? "text-[22px] leading-8" : "text-[15px] leading-[22px]",
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
						<AppMarkdown
							owner={owner}
							repo={repo}
							className={cn(
								"text-text-header",
								isDetail
									? "text-[15px] leading-6"
									: "text-[13px] leading-[21px]",
							)}
							resolveAssetUrl={resolveAssetUrl}
						>
							{release.body}
						</AppMarkdown>
						{isLong ? (
							<div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-surface-0 to-transparent" />
						) : null}
					</div>
				) : (
					<p className="text-[13px] text-muted-foreground">No release notes.</p>
				)}
				{isLong ? (
					<Link
						to="/$owner/$repo/releases/$tag"
						params={{ owner, repo, tag: release.tagName }}
						className="-ml-2 w-fit rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-ghost-hover hover:text-foreground"
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

const DOT_TONE: Record<ReleaseStatusBadge | "published", string> = {
	latest: "bg-success ring-success/25",
	prerelease: "bg-warning ring-warning/25",
	draft: "bg-icon-faint ring-icon-faint/25",
	published: "bg-icon-faint ring-transparent",
};

/**
 * One release in the changelog timeline: its date in the gutter, a dot on the
 * guide line, the name and status. The rest (who shipped it, the tag, the notes
 * and assets) folds under the name, so the list reads as a list of versions.
 */
function ReleaseTimelineItem({
	owner,
	repo,
	scope,
	release,
	canPush,
	onDeleted,
	resolveAssetUrl,
	defaultOpen,
}: {
	owner: string;
	repo: string;
	scope: GitHubQueryScope;
	release: RepoRelease;
	canPush: boolean;
	onDeleted?: () => void;
	resolveAssetUrl: (url: string) => string;
	defaultOpen: boolean;
}) {
	const [open, setOpen] = useState(defaultOpen);
	const when = release.publishedAt ?? release.createdAt;
	const isLong = release.body.length > LONG_BODY_CHARS;
	const tone = releaseStatusBadges(release)[0] ?? "published";
	const excerpt = plainExcerpt(release.body);
	const notesId = `release-${release.id}-notes`;

	return (
		<article
			aria-labelledby={`release-${release.id}-title`}
			className="group/release relative grid grid-cols-[1rem_minmax(0,1fr)] gap-x-4 md:grid-cols-[6.5rem_1rem_minmax(0,1fr)]"
		>
			<time
				dateTime={when}
				className="hidden pt-[9px] text-right text-xs font-[450] tabular-nums text-muted-foreground md:block"
			>
				{formatDate(when)}
			</time>
			<div aria-hidden className="relative flex justify-center">
				<span className="absolute top-5 bottom-0 left-1/2 w-px -translate-x-1/2 bg-activity-line/50 group-last/release:hidden" />
				<span
					className={cn(
						"relative mt-[11px] size-2 rounded-full ring-[3px]",
						DOT_TONE[tone],
					)}
				/>
			</div>
			<div
				className={cn(
					"flex min-w-0 flex-col pb-6 group-last/release:pb-2",
					open && "pb-10",
				)}
			>
				<div className="flex min-w-0 items-center gap-2">
					<button
						type="button"
						aria-expanded={open}
						aria-controls={notesId}
						onClick={() => setOpen((value) => !value)}
						className="-mx-2 flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-ghost-hover"
					>
						<h2
							id={`release-${release.id}-title`}
							className="min-w-0 shrink-0 truncate text-[15px] leading-6 font-semibold text-foreground"
						>
							{release.name}
						</h2>
						<ReleaseStatusBadges release={release} />
						{!open && excerpt ? (
							<span className="min-w-0 truncate text-[13px] font-[450] text-muted-foreground">
								{excerpt}
							</span>
						) : null}
						<ChevronRightIcon
							size={14}
							strokeWidth={2}
							className={cn(
								"ml-auto shrink-0 text-muted-foreground transition-transform duration-150",
								open && "rotate-90",
							)}
						/>
					</button>
					{canPush ? (
						<ReleaseCardActions
							owner={owner}
							repo={repo}
							scope={scope}
							release={release}
							onDeleted={onDeleted}
							className="opacity-0 transition-opacity group-hover/release:opacity-100 focus-within:opacity-100"
						/>
					) : null}
				</div>
				{open ? (
					<div id={notesId} className="flex min-w-0 flex-col gap-4 pt-2">
						<div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
							<ReleaseByline release={release} />
							<ReleaseMeta owner={owner} repo={repo} release={release} />
						</div>
						{release.body.trim() ? (
							<div
								className={cn(
									"relative",
									isLong && "max-h-[26rem] overflow-hidden",
								)}
							>
								<AppMarkdown
									owner={owner}
									repo={repo}
									className="text-[15px] leading-6 font-[450] text-text-header"
									resolveAssetUrl={resolveAssetUrl}
								>
									{release.body}
								</AppMarkdown>
								{isLong ? (
									<div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-main to-transparent" />
								) : null}
							</div>
						) : (
							<p className="text-[13px] text-muted-foreground">
								No release notes.
							</p>
						)}
						<div className="flex items-center gap-3">
							<Link
								to="/$owner/$repo/releases/$tag"
								params={{ owner, repo, tag: release.tagName }}
								className="-ml-2 w-fit rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-ghost-hover hover:text-foreground"
							>
								{isLong ? "Read full release notes" : "Open release"}
							</Link>
						</div>
						<ReleaseAssets
							owner={owner}
							repo={repo}
							release={release}
							collapsible
						/>
					</div>
				) : null}
			</div>
		</article>
	);
}
