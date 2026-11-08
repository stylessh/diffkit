import {
	DownloadIcon,
	GitCommitIcon,
	PackageIcon,
	PlusSignIcon,
} from "@diffkit/icons";
import { Button } from "@diffkit/ui/components/button";
import { Skeleton } from "@diffkit/ui/components/skeleton";
import { Spinner } from "@diffkit/ui/components/spinner";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@diffkit/ui/components/tooltip";
import {
	keepPreviousData,
	useInfiniteQuery,
	useQuery,
} from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { parseAsString, useQueryState } from "nuqs";
import { memo, useCallback, useMemo } from "react";
import { SidePanelPortal } from "#/components/layouts/dashboard-side-panel";
import { TagIcon } from "#/components/repo/refs/tag-icon";
import { RepoActivityCards } from "#/components/repo/repo-activity-cards";
import {
	RepoListSearchInput,
	RepoPageHeader,
} from "#/components/repo/repo-page-header";
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
			<div className="h-full overflow-auto py-10">
				<div className="mx-auto flex min-h-full max-w-4xl flex-col gap-6 px-3 md:px-6">
					<RepoPageHeader
						owner={owner}
						repo={repo}
						repoData={repoData}
						active="tags"
						title="Tags"
						subtitle={
							totalCount > 0 ? (
								<span className="tabular-nums">
									{totalCount} tag{totalCount === 1 ? "" : "s"}
								</span>
							) : undefined
						}
						actions={
							<Button variant="secondary" size="sm" asChild>
								<Link to="/$owner/$repo/releases" params={{ owner, repo }}>
									<PackageIcon size={14} />
									Releases
								</Link>
							</Button>
						}
					/>

					<RepoListSearchInput
						value={searchInput}
						onChange={setSearchInput}
						placeholder="Find a tag…"
						className="sm:w-[280px]"
					/>

					{isLoading ? (
						<div className="divide-y overflow-hidden rounded-lg border">
							{["a", "b", "c", "d"].map((key) => (
								<div key={key} className="flex items-center gap-3 px-4 py-3">
									<Skeleton className="size-4 rounded" />
									<div className="flex flex-1 flex-col gap-1.5">
										<Skeleton className="h-4 w-32 rounded" />
										<Skeleton className="h-3 w-48 rounded" />
									</div>
								</div>
							))}
						</div>
					) : tagsQuery.isError ? (
						<p className="py-12 text-center text-sm text-muted-foreground">
							Couldn't load tags.{" "}
							<button
								type="button"
								onClick={() => void tagsQuery.refetch()}
								className="underline underline-offset-2 hover:text-foreground"
							>
								Try again
							</button>
						</p>
					) : tags.length === 0 ? (
						<div className="flex flex-col items-center gap-2 py-16 text-center">
							<TagIcon size={20} className="text-muted-foreground" />
							<p className="text-sm text-muted-foreground">
								{query ? `No tags match “${query}”.` : "No tags yet."}
							</p>
						</div>
					) : (
						<ol
							className="divide-y overflow-hidden rounded-lg border transition-opacity"
							style={{ opacity: tagsQuery.isPlaceholderData ? 0.6 : 1 }}
						>
							{tags.map((tag) => (
								<li
									key={tag.name}
									style={{
										contentVisibility: "auto",
										containIntrinsicSize: "auto 60px",
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
					)}

					{tagsQuery.hasNextPage ? (
						<div className="flex justify-center">
							<Button
								variant="secondary"
								size="sm"
								disabled={tagsQuery.isFetchingNextPage}
								onClick={() => void tagsQuery.fetchNextPage()}
							>
								{tagsQuery.isFetchingNextPage ? <Spinner size={14} /> : null}
								Load more tags
							</Button>
						</div>
					) : null}
				</div>
			</div>
			{repoData ? (
				<SidePanelPortal>
					<RepoActivityCards
						owner={owner}
						repo={repo}
						scope={scope}
						repoData={repoData}
					/>
				</SidePanelPortal>
			) : null}
		</>
	);
}

const iconLinkClass =
	"flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground";

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

	return (
		<div className="flex items-center gap-3 px-4 py-2.5">
			<TagIcon size={16} className="shrink-0 text-muted-foreground" />
			<div className="flex min-w-0 flex-1 flex-col gap-1">
				<div className="flex min-w-0 items-center gap-2">
					<Link
						to="/$owner/$repo/tree/$"
						params={{ owner, repo, _splat: tag.name }}
						className="min-w-0 truncate font-mono text-sm font-medium text-foreground hover:underline"
					>
						{tag.name}
					</Link>
					{release ? (
						<Link
							to="/$owner/$repo/releases/$tag"
							params={{ owner, repo, tag: tag.name }}
							className="shrink-0 rounded-full border border-border/60 px-1.5 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
						>
							{release.isDraft ? "Draft release" : "Release"}
						</Link>
					) : null}
				</div>
				<div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
					{tag.date ? (
						<time dateTime={tag.date} className="shrink-0">
							{formatRelativeTime(tag.date)}
						</time>
					) : null}
					{tag.commitSha ? (
						<>
							<span aria-hidden>·</span>
							<Link
								to="/$owner/$repo/commit/$sha"
								params={{ owner, repo, sha: tag.commitSha }}
								className="flex shrink-0 items-center gap-1 font-mono hover:text-foreground hover:underline"
							>
								<GitCommitIcon size={12} />
								{tag.commitSha.slice(0, 7)}
							</Link>
						</>
					) : null}
					{messageLine ? (
						<>
							<span aria-hidden>·</span>
							<span className="truncate">{messageLine}</span>
						</>
					) : null}
				</div>
			</div>
			<div className="flex shrink-0 items-center gap-0.5">
				{!release && canPush ? (
					<Tooltip>
						<TooltipTrigger asChild>
							<Link
								to="/$owner/$repo/releases/new"
								params={{ owner, repo }}
								search={{ tag: tag.name }}
								aria-label={`Create a release from ${tag.name}`}
								className={iconLinkClass}
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
							aria-label={`Commits up to ${tag.name}`}
							className={iconLinkClass}
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
							aria-label={`Download ${tag.name} source (zip)`}
							className="flex h-7 items-center gap-1 rounded-md px-1.5 text-xs text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
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
							aria-label={`Download ${tag.name} source (tar.gz)`}
							className="hidden h-7 items-center gap-1 rounded-md px-1.5 text-xs text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground sm:flex"
						>
							<DownloadIcon size={14} />
							tar.gz
						</a>
					</TooltipTrigger>
					<TooltipContent>Source code (tar.gz)</TooltipContent>
				</Tooltip>
			</div>
		</div>
	);
});
