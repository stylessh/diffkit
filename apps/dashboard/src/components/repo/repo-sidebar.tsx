import {
	CodeIcon,
	GitBranchIcon,
	GitForkIcon,
	GlobeIcon,
	LicenseIcon,
	LockIcon,
	StarIcon,
	ViewIcon,
} from "@diffkit/icons";
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
import { TagIcon } from "#/components/repo/refs/tag-icon";
import {
	type GitHubQueryScope,
	githubRepoContributorsQueryOptions,
	githubRepoReleasesQueryOptions,
	REPO_RELEASES_PER_PAGE,
} from "#/lib/github.query";
import type { RepoOverview } from "#/lib/github.types";
import { useHasMounted } from "#/lib/use-has-mounted";
import { HairlineBadge, LabeledRow, ReleaseGlyph } from "./repo-ui";

function formatCount(n: number): string {
	if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
	return String(n);
}

/** A panel row whose pill is a link (pass the link as the child). */
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
 * The overview's right panel, as the reference lays out a repository: its
 * name and description, then its properties with their names on the left,
 * topics, stats, the latest releases and the contributors.
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
			<section className="mb-7">
				<div className="flex h-6 items-center">
					<h2 className="min-w-0 truncate text-[15px] font-semibold text-foreground">
						{repo.name}
					</h2>
				</div>
				{repo.description ? (
					<p className="mt-1 text-[13px] leading-5 font-[450] text-pretty text-muted-foreground">
						{repo.description}
					</p>
				) : null}
				{repo.isFork && repo.forkParentFullName ? (
					<p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[13px] font-[450] text-muted-foreground">
						<GitForkIcon size={14} strokeWidth={2} className="shrink-0" />
						Forked from
						<ForkParentLink fullName={repo.forkParentFullName} />
					</p>
				) : null}
			</section>

			<PanelSection label="Properties">
				<LabeledRow label="Visibility">
					<PanelRow
						icon={
							repo.isPrivate ? (
								<LockIcon className="text-muted-foreground" />
							) : (
								<GlobeIcon className="text-muted-foreground" />
							)
						}
					>
						{repo.isPrivate ? "Private" : "Public"}
					</PanelRow>
				</LabeledRow>
				<LabeledRow label="Default branch">
					<PanelRow
						icon={
							<GitBranchIcon
								strokeWidth={2}
								className="text-muted-foreground"
							/>
						}
					>
						<span className="truncate font-mono text-xs font-[450]">
							{repo.defaultBranch}
						</span>
					</PanelRow>
				</LabeledRow>
				{repo.language ? (
					<LabeledRow label="Language">
						<PanelRow icon={<CodeIcon className="text-muted-foreground" />}>
							{repo.language}
						</PanelRow>
					</LabeledRow>
				) : null}
				{repo.license ? (
					<LabeledRow label="License">
						<PanelRow icon={<LicenseIcon className="text-muted-foreground" />}>
							{repo.license}
						</PanelRow>
					</LabeledRow>
				) : null}
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

			<PanelSection label="Stats">
				<PanelRow icon={<StarIcon className="text-muted-foreground" />}>
					<span>
						<span className="tabular-nums">{formatCount(repo.stars)}</span>{" "}
						<span className="font-[450] text-muted-foreground">
							{repo.stars === 1 ? "star" : "stars"}
						</span>
					</span>
				</PanelRow>
				<PanelRow icon={<ViewIcon className="text-muted-foreground" />}>
					<span>
						<span className="tabular-nums">{formatCount(repo.watchers)}</span>{" "}
						<span className="font-[450] text-muted-foreground">watching</span>
					</span>
				</PanelRow>
				<PanelRow icon={<GitForkIcon className="text-muted-foreground" />}>
					<span>
						<span className="tabular-nums">{formatCount(repo.forks)}</span>{" "}
						<span className="font-[450] text-muted-foreground">
							{repo.forks === 1 ? "fork" : "forks"}
						</span>
					</span>
				</PanelRow>
				<LinkRow icon={<GitBranchIcon className="text-muted-foreground" />}>
					<Link to="/$owner/$repo/branches" params={params}>
						<span>
							<span className="tabular-nums">{repo.branchCount}</span>{" "}
							<span className="font-[450] text-muted-foreground">
								{repo.branchCount === 1 ? "branch" : "branches"}
							</span>
						</span>
					</Link>
				</LinkRow>
				<LinkRow icon={<TagIcon className="text-muted-foreground" />}>
					<Link to="/$owner/$repo/tags" params={params}>
						<span>
							<span className="tabular-nums">{repo.tagCount}</span>{" "}
							<span className="font-[450] text-muted-foreground">
								{repo.tagCount === 1 ? "tag" : "tags"}
							</span>
						</span>
					</Link>
				</LinkRow>
			</PanelSection>

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

/** The latest three releases, a diamond each, the newest in the open color. */
function ReleasesSection({
	repo,
	scope,
}: {
	repo: RepoOverview;
	scope: GitHubQueryScope;
}) {
	const hasMounted = useHasMounted();
	const params = { owner: repo.owner, repo: repo.name };
	const releasesQuery = useQuery({
		...githubRepoReleasesQueryOptions(scope, {
			...params,
			page: 1,
			perPage: REPO_RELEASES_PER_PAGE,
		}),
		enabled: hasMounted,
	});
	const releases = (releasesQuery.data?.releases ?? []).slice(0, 3);
	if (!releasesQuery.data) return null;

	return (
		<PanelSection
			label="Releases"
			action={
				releases.length > 0 ? (
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
			{releases.length === 0 ? (
				<PanelRow muted icon={<ReleaseGlyph />}>
					No releases yet
				</PanelRow>
			) : (
				releases.map((release) => (
					<LinkRow
						key={release.id}
						icon={<ReleaseGlyph latest={release.isLatest} />}
						after={
							release.isLatest ? (
								<HairlineBadge>Latest</HairlineBadge>
							) : release.isPrerelease ? (
								<HairlineBadge>Pre-release</HairlineBadge>
							) : null
						}
					>
						<Link
							to="/$owner/$repo/releases/$tag"
							params={{ ...params, tag: release.tagName }}
						>
							<span className="shrink-0 font-mono text-xs">
								{release.tagName}
							</span>
							{release.name && release.name !== release.tagName ? (
								<span className="truncate font-[450] text-muted-foreground">
									{release.name}
								</span>
							) : null}
						</Link>
					</LinkRow>
				))
			)}
		</PanelSection>
	);
}

/** Contributors as a facepile: 20px faces, each cut out of the one before. */
function ContributorsSection({
	repo,
	scope,
}: {
	repo: RepoOverview;
	scope: GitHubQueryScope;
}) {
	const hasMounted = useHasMounted();
	const contributorsQuery = useQuery({
		...githubRepoContributorsQueryOptions(scope, {
			owner: repo.owner,
			repo: repo.name,
		}),
		enabled: hasMounted,
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
