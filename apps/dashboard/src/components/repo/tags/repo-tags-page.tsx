import {
	DownloadIcon,
	GitCommitIcon,
	PackageIcon,
	PlusSignIcon,
} from "@diffkit/icons";
import { Chip } from "@diffkit/ui/components/chip";
import { GroupHeader } from "@diffkit/ui/components/group-header";
import { Spinner } from "@diffkit/ui/components/spinner";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@diffkit/ui/components/tooltip";
import { cn } from "@diffkit/ui/lib/utils";
import {
	keepPreviousData,
	useInfiniteQuery,
	useQuery,
} from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { parseAsString, useQueryState } from "nuqs";
import { memo, useCallback, useMemo } from "react";
import { Skeleton } from "skullet/react";
import { ToolbarRow, ToolbarSearchField } from "#/components/filters";
import { SidePanelPortal } from "#/components/layouts/dashboard-side-panel";
import { TagIcon } from "#/components/repo/refs/tag-icon";
import { RepoActivityCards } from "#/components/repo/repo-activity-cards";
import { RepoPageHeader } from "#/components/repo/repo-page-header";
import {
	listRowClassName,
	RowStateIcon,
	RowTime,
} from "#/components/shared/list-row";
import { encodeRefPath } from "#/lib/commits-route";
import { formatRelativeTime } from "#/lib/format-relative-time";
import {
	type GitHubQueryScope,
	githubRepoOverviewQueryOptions,
	githubRepoReleasesQueryOptions,
	githubRepoTagsListInfiniteQueryOptions,
	githubRepoViewerPermissionQueryOptions,
	REPO_RELEASES_PER_PAGE,
} from "#/lib/github.query";
import type { RepoRelease, RepoTagListItem } from "#/lib/github.types";
import { useHasMounted } from "#/lib/use-has-mounted";
import { useUrlSearchInput } from "#/lib/use-url-search-input";
import {
	ghostPillClassName,
	HairlineBadge,
	iconButtonClassName,
	pillButtonClassName,
	RepoEmptyState,
} from "../repo-ui";
import { SAMPLE_TAGS } from "./tag-samples";

/**
 * Tags, newest first (GraphQL orders by tag/commit date), 30 per request.
 * The first releases page (shared with the releases list cache) marks which
 * recent tags already have a release.
 */
export function RepoTagsPage({
	owner,
	repo,
	scope,
}: {
	owner: string;
	repo: string;
	scope: GitHubQueryScope;
}) {
	const hasMounted = useHasMounted();
	const [q, setQ] = useQueryState("q", parseAsString);
	const applySearch = useCallback(
		(next: string | null) => {
			void setQ(next, { history: "replace" });
		},
		[setQ],
	);
	const [searchInput, setSearchInput] = useUrlSearchInput(q, applySearch);

	const overviewQuery = useQuery({
		...githubRepoOverviewQueryOptions(scope, { owner, repo }),
		enabled: hasMounted,
	});
	const repoData = overviewQuery.data;

	const permissionQuery = useQuery({
		...githubRepoViewerPermissionQueryOptions(scope, { owner, repo }),
		enabled: hasMounted,
	});
	const canPush = permissionQuery.data?.canPush ?? false;

	const releasesQuery = useQuery({
		...githubRepoReleasesQueryOptions(scope, {
			owner,
			repo,
			page: 1,
			perPage: REPO_RELEASES_PER_PAGE,
		}),
		enabled: hasMounted,
	});
	const releasesByTag = useMemo(() => {
		const map = new Map<string, RepoRelease>();
		for (const release of releasesQuery.data?.releases ?? []) {
			map.set(release.tagName, release);
		}
		return map;
	}, [releasesQuery.data?.releases]);

	const query = q?.trim() || undefined;
	const tagsQuery = useInfiniteQuery({
		...githubRepoTagsListInfiniteQueryOptions(scope, { owner, repo, query }),
		enabled: hasMounted,
		placeholderData: keepPreviousData,
	});
	const tags = useMemo(
		() => tagsQuery.data?.pages.flatMap((page) => page.tags) ?? [],
		[tagsQuery.data?.pages],
	);
	const totalCount = tagsQuery.data?.pages[0]?.totalCount ?? 0;
	const isLoading = !hasMounted || (tagsQuery.isPending && !tagsQuery.data);

	return (
		<>
			<RepoPageHeader
				owner={owner}
				repo={repo}
				scope={scope}
				active="tags"
				toolbar={
					<ToolbarRow
						search={
							<ToolbarSearchField
								value={searchInput}
								onChange={setSearchInput}
								placeholder="Search tags…"
							/>
						}
					>
						<Link
							to="/$owner/$repo/releases"
							params={{ owner, repo }}
							className={ghostPillClassName}
						>
							<PackageIcon size={14} strokeWidth={2} />
							Releases
						</Link>
					</ToolbarRow>
				}
			>
				<Skeleton loading={isLoading} label="Loading tags">
					{isLoading ? (
						<TagList
							tags={SAMPLE_TAGS}
							totalCount={SAMPLE_TAGS.length}
							owner={owner}
							repo={repo}
							releasesByTag={NO_RELEASES}
							canPush={false}
						/>
					) : tagsQuery.isError ? (
						<RepoEmptyState
							icon={<TagIcon />}
							title="Couldn't load tags"
							action={
								<button
									type="button"
									onClick={() => void tagsQuery.refetch()}
									className={pillButtonClassName}
								>
									Try again
								</button>
							}
						/>
					) : tags.length === 0 ? (
						<RepoEmptyState
							icon={<TagIcon />}
							title={query ? `No tags match “${query}”` : "No tags yet"}
						/>
					) : (
						<TagList
							tags={tags}
							totalCount={totalCount}
							owner={owner}
							repo={repo}
							releasesByTag={releasesByTag}
							canPush={canPush}
							dimmed={tagsQuery.isPlaceholderData}
						/>
					)}
				</Skeleton>

				{tagsQuery.hasNextPage ? (
					<div className="mt-6 flex justify-center">
						<button
							type="button"
							className={pillButtonClassName}
							disabled={tagsQuery.isFetchingNextPage}
							onClick={() => void tagsQuery.fetchNextPage()}
						>
							{tagsQuery.isFetchingNextPage ? <Spinner size={14} /> : null}
							Load more tags
						</button>
					</div>
				) : null}
			</RepoPageHeader>
			<SidePanelPortal>
				<RepoActivityCards
					owner={owner}
					repo={repo}
					scope={scope}
					repoData={repoData}
				/>
			</SidePanelPortal>
		</>
	);
}

const NO_RELEASES: ReadonlyMap<string, RepoRelease> = new Map();

function TagList({
	tags,
	totalCount,
	owner,
	repo,
	releasesByTag,
	canPush,
	dimmed = false,
}: {
	tags: RepoTagListItem[];
	totalCount: number;
	owner: string;
	repo: string;
	releasesByTag: ReadonlyMap<string, RepoRelease>;
	canPush: boolean;
	dimmed?: boolean;
}) {
	return (
		<section aria-label="Tags">
			<GroupHeader
				className="sticky top-0 z-10"
				title="Tags"
				count={totalCount}
			/>
			<ol
				className="flex flex-col py-0.5 transition-opacity"
				style={{ opacity: dimmed ? 0.6 : 1 }}
			>
				{tags.map((tag) => (
					<li
						key={tag.name}
						style={{
							contentVisibility: "auto",
							containIntrinsicSize: "auto 44px",
						}}
					>
						<TagRow
							owner={owner}
							repo={repo}
							tag={tag}
							release={releasesByTag.get(tag.name) ?? null}
							canPush={canPush}
						/>
					</li>
				))}
			</ol>
		</section>
	);
}

const TagRow = memo(function TagRow({
	owner,
	repo,
	tag,
	release,
	canPush,
}: {
	owner: string;
	repo: string;
	tag: RepoTagListItem;
	release: RepoRelease | null;
	canPush: boolean;
}) {
	const archiveBase = `https://github.com/${owner}/${repo}/archive/refs/tags/${encodeRefPath(tag.name)}`;
	const messageLine = tag.message?.split("\n")[0];

	const time = tag.date
		? formatRelativeTime(tag.date, undefined, { compact: true })
		: null;

	return (
		<div
			className={cn(
				listRowClassName,
				"hover:[&:not(:has([data-action]:hover))]:before:bg-row-hover",
			)}
		>
			<RowStateIcon className="text-muted-foreground">
				<TagIcon size={14} strokeWidth={2} />
			</RowStateIcon>
			<div className="flex min-w-0 flex-1 flex-col gap-1 md:flex-row md:items-center md:gap-2">
				<span className="flex min-w-0 items-center gap-2">
					<Link
						to="/$owner/$repo/tree/$"
						params={{ owner, repo, _splat: tag.name }}
						title={tag.name}
						className="min-w-0 truncate rounded-sm font-mono text-[13px] font-medium text-foreground after:absolute after:inset-0 after:content-['']"
					>
						{tag.name}
					</Link>
					{release ? (
						<HairlineBadge className="relative z-[1] transition-colors hover:text-foreground">
							<Link
								to="/$owner/$repo/releases/$tag"
								params={{ owner, repo, tag: tag.name }}
								data-action
							>
								{release.isDraft ? "Draft release" : "Release"}
							</Link>
						</HairlineBadge>
					) : null}
				</span>
				{messageLine ? (
					<span className="min-w-0 truncate text-[13px] font-[450] text-muted-foreground">
						{messageLine}
					</span>
				) : null}
				<p className="flex min-w-0 items-center gap-1 truncate text-xs text-muted-foreground md:hidden">
					{tag.commitSha ? (
						<span className="font-mono">{tag.commitSha.slice(0, 7)}</span>
					) : null}
					{tag.commitSha && time ? <span aria-hidden>·</span> : null}
					{time ? <span className="tabular-nums">{time}</span> : null}
				</p>
			</div>
			<div className="relative z-[1] flex shrink-0 items-center gap-0.5">
				{tag.commitSha ? (
					<Chip
						asChild
						className="mr-1 font-mono transition-colors hover:text-foreground max-md:hidden"
					>
						<Link
							to="/$owner/$repo/commit/$sha"
							params={{ owner, repo, sha: tag.commitSha }}
							data-action
						>
							<GitCommitIcon size={12} />
							{tag.commitSha.slice(0, 7)}
						</Link>
					</Chip>
				) : null}
				{!release && canPush ? (
					<Tooltip>
						<TooltipTrigger asChild>
							<Link
								to="/$owner/$repo/releases/new"
								params={{ owner, repo }}
								search={{ tag: tag.name }}
								data-action
								aria-label={`Create a release from ${tag.name}`}
								className={iconButtonClassName}
							>
								<PlusSignIcon size={14} />
							</Link>
						</TooltipTrigger>
						<TooltipContent>Create release</TooltipContent>
					</Tooltip>
				) : null}
				<Tooltip>
					<TooltipTrigger asChild>
						<Link
							to="/$owner/$repo/commits/$"
							params={{ owner, repo, _splat: tag.name }}
							data-action
							aria-label={`Commits up to ${tag.name}`}
							className={iconButtonClassName}
						>
							<GitCommitIcon size={14} />
						</Link>
					</TooltipTrigger>
					<TooltipContent>Commits</TooltipContent>
				</Tooltip>
				<Tooltip>
					<TooltipTrigger asChild>
						<a
							href={`${archiveBase}.zip`}
							data-action
							aria-label={`Download ${tag.name} source (zip)`}
							className={ghostPillClassName}
						>
							<DownloadIcon size={14} />
							zip
						</a>
					</TooltipTrigger>
					<TooltipContent>Source code (zip)</TooltipContent>
				</Tooltip>
				<Tooltip>
					<TooltipTrigger asChild>
						<a
							href={`${archiveBase}.tar.gz`}
							data-action
							aria-label={`Download ${tag.name} source (tar.gz)`}
							className={cn(ghostPillClassName, "max-sm:hidden")}
						>
							<DownloadIcon size={14} />
							tar.gz
						</a>
					</TooltipTrigger>
					<TooltipContent>Source code (tar.gz)</TooltipContent>
				</Tooltip>
			</div>
			<span className="hidden shrink-0 md:flex">
				{tag.date ? (
					<time dateTime={tag.date}>
						<RowTime>{time}</RowTime>
					</time>
				) : (
					<RowTime>—</RowTime>
				)}
			</span>
		</div>
	);
});
