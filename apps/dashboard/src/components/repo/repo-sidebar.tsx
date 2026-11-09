import { GitBranchIcon, GitForkIcon, StarIcon, ViewIcon } from "@diffkit/icons";
import { Chip } from "@diffkit/ui/components/chip";
import {
	PanelPill,
	PanelRow,
	PanelSection,
} from "@diffkit/ui/components/detail-layout";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@diffkit/ui/components/tooltip";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type * as React from "react";
import { Skeleton } from "skullet/react";
import { SAMPLE_RELEASES } from "#/components/releases/release-samples";
import { TagIcon } from "#/components/repo/refs/tag-icon";
import { useIsSkeletonSample } from "#/components/shared/skeleton-sample";
import {
	type GitHubQueryScope,
	githubRepoContributorsQueryOptions,
	githubRepoReleasesQueryOptions,
	REPO_RELEASES_PER_PAGE,
} from "#/lib/github.query";
import type { RepoOverview, RepoRelease } from "#/lib/github.types";
import { useHasMounted } from "#/lib/use-has-mounted";
import { HairlineBadge, ReleaseGlyph } from "./repo-ui";

function formatCount(n: number): string {
	if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
	return String(n);
}

function LinkRow({
	icon,
	children,
	after,
}: {
	icon: React.ReactNode;
	children: React.ReactElement;
	after?: React.ReactNode;
}) {
	return (
		<div className="group/row flex w-fit max-w-full items-center gap-2.5">
			<PanelPill asChild icon={icon}>
				{children}
			</PanelPill>
			{after}
		</div>
	);
}

/**
 * What a repository is, beside its files: the description, its stats, topics,
 * the latest release and who builds it.
 */
export function RepoSidebar({
	repo,
	scope,
}: {
	repo: RepoOverview;
	scope: GitHubQueryScope;
}) {
	const params = { owner: repo.owner, repo: repo.name };
	return (
		<>
			{repo.description || (repo.isFork && repo.forkParentFullName) ? (
				<section className="mb-7 flex flex-col gap-1.5">
					{repo.description ? (
						<p className="text-[13px] leading-5 font-[450] text-pretty text-text-header">
							{repo.description}
						</p>
					) : null}
					{repo.isFork && repo.forkParentFullName ? (
						<p className="flex min-w-0 items-center gap-1.5 text-[13px] font-[450] text-muted-foreground">
							<GitForkIcon size={14} strokeWidth={2} className="shrink-0" />
							Forked from
							<ForkParentLink fullName={repo.forkParentFullName} />
						</p>
					) : null}
				</section>
			) : null}

			<PanelSection label="Stats">
				<PanelRow muted icon={<StarIcon size={14} strokeWidth={2} />}>
					<span className="tabular-nums">{formatCount(repo.stars)}</span>{" "}
					{repo.stars === 1 ? "star" : "stars"}
				</PanelRow>
				<PanelRow muted icon={<ViewIcon size={14} strokeWidth={2} />}>
					<span className="tabular-nums">{formatCount(repo.watchers)}</span>{" "}
					watching
				</PanelRow>
				<PanelRow muted icon={<GitForkIcon size={14} strokeWidth={2} />}>
					<span className="tabular-nums">{formatCount(repo.forks)}</span>{" "}
					{repo.forks === 1 ? "fork" : "forks"}
				</PanelRow>
				<LinkRow icon={<GitBranchIcon size={14} strokeWidth={2} />}>
					<Link to="/$owner/$repo/branches" params={params}>
						<span className="tabular-nums">{repo.branchCount}</span>
						{repo.branchCount === 1 ? "branch" : "branches"}
					</Link>
				</LinkRow>
				<LinkRow icon={<TagIcon size={14} strokeWidth={2} />}>
					<Link to="/$owner/$repo/tags" params={params}>
						<span className="tabular-nums">{repo.tagCount}</span>
						{repo.tagCount === 1 ? "tag" : "tags"}
					</Link>
				</LinkRow>
			</PanelSection>

			{repo.topics.length > 0 ? (
				<PanelSection label="Topics">
					<div className="flex flex-wrap gap-1.5 py-0.5">
						{repo.topics.map((topic) => (
							<Chip key={topic}>{topic}</Chip>
						))}
					</div>
				</PanelSection>
			) : null}

			<ReleasesSection repo={repo} scope={scope} />
			<ContributorsSection repo={repo} scope={scope} />
		</>
	);
}

function ForkParentLink({ fullName }: { fullName: string }) {
	const i = fullName.indexOf("/");
	if (i <= 0 || i === fullName.length - 1) {
		return <span className="truncate text-text-header">{fullName}</span>;
	}
	return (
		<Link
			to="/$owner/$repo"
			params={{ owner: fullName.slice(0, i), repo: fullName.slice(i + 1) }}
			className="min-w-0 truncate font-medium text-text-header hover:text-foreground"
		>
			{fullName}
		</Link>
	);
}

function ReleasesSection({
	repo,
	scope,
}: {
	repo: RepoOverview;
	scope: GitHubQueryScope;
}) {
	const hasMounted = useHasMounted();
	const isSample = useIsSkeletonSample();
	const params = { owner: repo.owner, repo: repo.name };
	const releasesQuery = useQuery({
		...githubRepoReleasesQueryOptions(scope, {
			...params,
			page: 1,
			perPage: REPO_RELEASES_PER_PAGE,
		}),
		enabled: hasMounted && !isSample,
	});
	const latest = isSample
		? SAMPLE_RELEASES[0]
		: releasesQuery.data
			? (releasesQuery.data.releases.find((release) => release.isLatest) ??
				releasesQuery.data.releases[0] ??
				null)
			: undefined;

	return (
		<Skeleton
			data={latest === undefined ? undefined : { latest }}
			sample={{ latest: SAMPLE_RELEASES[0] }}
			label="Loading releases"
		>
			{({ latest }) => <ReleasesPanel params={params} latest={latest} />}
		</Skeleton>
	);
}

function ReleasesPanel({
	params,
	latest,
}: {
	params: { owner: string; repo: string };
	latest: RepoRelease | null;
}) {
	return (
		<PanelSection
			label="Releases"
			action={
				latest ? (
					<Link
						to="/$owner/$repo/releases"
						params={params}
						className="rounded-sm text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
					>
						View all
					</Link>
				) : undefined
			}
		>
			{latest ? (
				<LinkRow
					icon={<ReleaseGlyph latest />}
					after={
						latest.isPrerelease ? (
							<HairlineBadge>Pre-release</HairlineBadge>
						) : null
					}
				>
					<Link
						to="/$owner/$repo/releases/$tag"
						params={{ ...params, tag: latest.tagName }}
					>
						<span className="shrink-0 font-mono text-xs">{latest.tagName}</span>
						{latest.name && latest.name !== latest.tagName ? (
							<span className="truncate font-[450] text-muted-foreground">
								{latest.name}
							</span>
						) : null}
					</Link>
				</LinkRow>
			) : (
				<PanelRow muted icon={<ReleaseGlyph />}>
					No releases yet
				</PanelRow>
			)}
		</PanelSection>
	);
}

function ContributorsSection({
	repo,
	scope,
}: {
	repo: RepoOverview;
	scope: GitHubQueryScope;
}) {
	const hasMounted = useHasMounted();
	const isSample = useIsSkeletonSample();
	const contributorsQuery = useQuery({
		...githubRepoContributorsQueryOptions(scope, {
			owner: repo.owner,
			repo: repo.name,
		}),
		enabled: hasMounted && !isSample,
	});

	const data = contributorsQuery.data;
	if (!data) return null;
	const rest = data.totalCount - data.contributors.length;

	return (
		<PanelSection
			label={
				<>
					Contributors{" "}
					<span className="ml-1 tabular-nums">
						{formatCount(data.totalCount)}
					</span>
				</>
			}
		>
			<div className="flex min-h-7 flex-wrap items-center gap-y-1">
				<span className="-ml-[1.5px] flex flex-wrap items-center">
					{data.contributors.map((c, i) => (
						<Tooltip key={c.login}>
							<TooltipTrigger asChild>
								<Link
									to="/$owner"
									params={{ owner: c.login }}
									aria-label={c.login}
									className="flex rounded-full bg-main p-[1.5px] transition-transform hover:z-10 hover:-translate-y-px"
									style={{ marginLeft: i === 0 ? 0 : -6 }}
								>
									<img
										src={c.avatarUrl}
										alt=""
										className="size-5 rounded-full ring-[0.5px] ring-chip-border"
									/>
								</Link>
							</TooltipTrigger>
							<TooltipContent>
								{c.login} · {formatCount(c.contributions)} commits
							</TooltipContent>
						</Tooltip>
					))}
				</span>
				{rest > 0 ? (
					<span className="ml-1.5 text-[13px] font-[450] whitespace-nowrap tabular-nums text-muted-foreground">
						{formatCount(rest)} more
					</span>
				) : null}
			</div>
		</PanelSection>
	);
}
