import { ChevronRightIcon } from "@diffkit/icons";
import { cn } from "@diffkit/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import type { GitHubQueryScope } from "#/lib/github.query";
import type { RepoRelease } from "#/lib/github.types";
import { plainExcerpt } from "#/lib/plain-excerpt";
import { ReleaseAssets } from "./release-assets";
import { ReleaseCardActions } from "./release-card-actions";
import {
	formatReleaseDate,
	ReleaseByline,
	ReleaseMeta,
	ReleaseNotes,
	ReleaseStatusBadges,
} from "./release-card-parts";
import {
	type ReleaseStatusBadge,
	releaseStatusBadges,
} from "./release-save-utils";

/** Notes longer than this are clamped in the list, with a link to the full release. */
const LONG_BODY_CHARS = 1400;

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
export function ReleaseTimelineItem({
	owner,
	repo,
	scope,
	release,
	canPush,
	onDeleted,
	defaultOpen,
}: {
	owner: string;
	repo: string;
	scope: GitHubQueryScope;
	release: RepoRelease;
	canPush: boolean;
	onDeleted?: () => void;
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
				{formatReleaseDate(when)}
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
						<ReleaseNotes
							owner={owner}
							repo={repo}
							release={release}
							clamped={isLong}
							className="text-[15px] leading-6 font-[450] text-text-header"
						/>
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
