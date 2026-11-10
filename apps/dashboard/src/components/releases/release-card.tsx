import type { GitHubQueryScope } from "#/lib/github.query";
import type { RepoRelease } from "#/lib/github.types";
import { ReleaseAssets } from "./release-assets";
import { ReleaseCardActions } from "./release-card-actions";
import {
	ReleaseByline,
	ReleaseMeta,
	ReleaseNotes,
	ReleaseStatusBadges,
} from "./release-card-parts";
import { ReleaseTimelineItem } from "./release-timeline-item";

type ReleaseCardProps = {
	owner: string;
	repo: string;
	scope: GitHubQueryScope;
	release: RepoRelease;
	canPush: boolean;
	onDeleted?: () => void;
};

/** A release as a changelog entry (`list`) or as the whole page (`detail`). */
export function ReleaseCard({
	variant = "list",
	defaultOpen = true,
	...props
}: ReleaseCardProps & {
	variant?: "list" | "detail";
	/** In the list, whether the notes start open; only the newest does. */
	defaultOpen?: boolean;
}) {
	return variant === "detail" ? (
		<ReleaseDetail {...props} />
	) : (
		<ReleaseTimelineItem {...props} defaultOpen={defaultOpen} />
	);
}

function ReleaseDetail({
	owner,
	repo,
	scope,
	release,
	canPush,
	onDeleted,
}: ReleaseCardProps) {
	const titleId = `release-${release.id}-title`;
	return (
		<article aria-labelledby={titleId} className="flex flex-col gap-8">
			<header className="flex min-w-0 flex-col gap-3">
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
						/>
					) : null}
				</div>
				<h1
					id={titleId}
					className="text-[22px] leading-8 font-semibold text-foreground [overflow-wrap:anywhere]"
				>
					{release.name}
				</h1>
				<ReleaseByline release={release} />
				<ReleaseMeta owner={owner} repo={repo} release={release} />
			</header>

			<div className="flex min-w-0 flex-col gap-4">
				<ReleaseNotes
					owner={owner}
					repo={repo}
					release={release}
					className="text-[15px] leading-6 text-text-header"
				/>
				<ReleaseAssets
					owner={owner}
					repo={repo}
					release={release}
					collapsible={false}
				/>
			</div>
		</article>
	);
}
