import { GitCommitIcon, PackageIcon, TagIcon } from "@diffkit/icons";
import { Chip } from "@diffkit/ui/components/chip";
import { GroupHeader } from "@diffkit/ui/components/group-header";
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
import { RepoPageHeader } from "#/components/repo/repo-page-header";
import {
	listRowClassName,
	RowStateIcon,
	RowTime,
} from "#/components/shared/list-row";
import { formatRelativeTime } from "#/lib/format-relative-time";
import {
	type GitHubQueryScope,
	githubRepoReleasesQueryOptions,
	githubRepoTagsListInfiniteQueryOptions,
	REPO_RELEASES_PER_PAGE,
} from "#/lib/github.query";
import type { RepoRelease, RepoTagListItem } from "#/lib/github.types";
import { useHasMounted } from "#/lib/use-has-mounted";
import { useUrlSearchInput } from "#/lib/use-url-search-input";
import {
	ghostPillClassName,
	pillButtonClassName,
	RepoEmptyState,
} from "../repo-ui";
import { SourceDownloadPill } from "./source-download-pill";
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
						dimmed={tagsQuery.isPlaceholderData}
					/>
				)}
			</Skeleton>

			{tagsQuery.isFetchingNextPage ? (
				<Skeleton loading label="Loading more tags">
					<TagRows
						tags={SAMPLE_TAGS}
						owner={owner}
						repo={repo}
						releasesByTag={NO_RELEASES}
					/>
				</Skeleton>
			) : null}

			{tagsQuery.hasNextPage ? (
				<div className="mt-6 flex justify-center">
					<button
						type="button"
						className={pillButtonClassName}
						disabled={tagsQuery.isFetchingNextPage}
						onClick={() => void tagsQuery.fetchNextPage()}
					>
						Load more tags
					</button>
				</div>
			) : null}
		</RepoPageHeader>
	);
}

const NO_RELEASES: ReadonlyMap<string, RepoRelease> = new Map();

function TagList({
	tags,
	totalCount,
	owner,
	repo,
	releasesByTag,
	dimmed = false,
}: {
	tags: RepoTagListItem[];
	totalCount: number;
	owner: string;
	repo: string;
	releasesByTag: ReadonlyMap<string, RepoRelease>;
	dimmed?: boolean;
}) {
	return (
		<section aria-label="Tags">
			<GroupHeader
				className="sticky top-0 z-10"
				title="Tags"
				count={totalCount}
			/>
			<TagRows
				tags={tags}
				owner={owner}
				repo={repo}
				releasesByTag={releasesByTag}
				dimmed={dimmed}
			/>
		</section>
	);
}

function TagRows({
	tags,
	owner,
	repo,
	releasesByTag,
	dimmed = false,
}: {
	tags: RepoTagListItem[];
	owner: string;
	repo: string;
	releasesByTag: ReadonlyMap<string, RepoRelease>;
	dimmed?: boolean;
}) {
	return (
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
					/>
				</li>
			))}
		</ol>
	);
}

const TagRow = memo(function TagRow({
	owner,
	repo,
	tag,
	release,
}: {
	owner: string;
	repo: string;
	tag: RepoTagListItem;
	release: RepoRelease | null;
}) {
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
			<div className="relative z-[1] flex min-w-0 shrink items-center gap-1">
				{release ? (
					<Chip
						asChild
						className="shrink-0 transition-colors hover:text-foreground"
					>
						<Link
							to="/$owner/$repo/releases/$tag"
							params={{ owner, repo, tag: tag.name }}
							data-action
						>
							<PackageIcon size={12} strokeWidth={2} />
							{release.isDraft ? "Draft release" : "Release"}
						</Link>
					</Chip>
				) : null}
				{tag.commitSha ? (
					<Chip
						asChild
						className="shrink-0 font-mono transition-colors hover:text-foreground max-md:hidden"
					>
						<Link
							to="/$owner/$repo/commit/$sha"
							params={{ owner, repo, sha: tag.commitSha }}
							data-action
							title="View the tagged commit"
						>
							<GitCommitIcon size={12} />
							{tag.commitSha.slice(0, 7)}
						</Link>
					</Chip>
				) : null}
				<SourceDownloadPill owner={owner} repo={repo} tag={tag.name} />
			</div>
			<span className="hidden shrink-0 md:ml-3 md:flex">
				<RowTime dateTime={tag.date ?? undefined}>{time ?? "—"}</RowTime>
			</span>
		</div>
	);
});
