import { PackageIcon, PlusSignIcon } from "@diffkit/icons";
import { Skeleton } from "@diffkit/ui/components/skeleton";
import { cn } from "@diffkit/ui/lib/utils";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { parseAsInteger, useQueryState } from "nuqs";
import { Pagination } from "#/components/pagination";
import { TagIcon } from "#/components/repo/refs/tag-icon";
import { RepoPageHeader } from "#/components/repo/repo-page-header";
import {
	ghostPillClassName,
	pillButtonClassName,
	RepoEmptyState,
} from "#/components/repo/repo-ui";
import {
	type GitHubQueryScope,
	githubRepoReleasesQueryOptions,
	githubRepoViewerPermissionQueryOptions,
	REPO_RELEASES_PER_PAGE,
} from "#/lib/github.query";
import { useHasMounted } from "#/lib/use-has-mounted";
import { useRegisterTab } from "#/lib/use-register-tab";
import { ReleaseCard } from "./release-card";

/** Changelog of releases, 10 per page (1 list call + 1 cached "latest" lookup). */
export function RepoReleasesPage({
	owner,
	repo,
	scope,
}: {
	owner: string;
	repo: string;
	scope: GitHubQueryScope;
}) {
	const hasMounted = useHasMounted();
	const [page, setPage] = useQueryState(
		"page",
		parseAsInteger.withDefault(1).withOptions({ history: "push" }),
	);

	const permissionQuery = useQuery({
		...githubRepoViewerPermissionQueryOptions(scope, { owner, repo }),
		enabled: hasMounted,
	});
	const canPush = permissionQuery.data?.canPush ?? false;

	const releasesQuery = useQuery({
		...githubRepoReleasesQueryOptions(scope, {
			owner,
			repo,
			page,
			perPage: REPO_RELEASES_PER_PAGE,
		}),
		enabled: hasMounted,
		placeholderData: keepPreviousData,
	});
	const releases = releasesQuery.data?.releases ?? [];
	const isLoading =
		!hasMounted || (releasesQuery.isPending && !releasesQuery.data);

	useRegisterTab({
		type: "releases",
		title: `Releases · ${owner}/${repo}`,
		url: `/${owner}/${repo}/releases`,
		repo: `${owner}/${repo}`,
		iconColor: "text-muted-foreground",
		tabId: `releases:${owner}/${repo}`,
	});

	return (
		<>
			<RepoPageHeader
				owner={owner}
				repo={repo}
				scope={scope}
				active="releases"
				tabActions={
					<>
						<Link
							to="/$owner/$repo/tags"
							params={{ owner, repo }}
							className={cn(ghostPillClassName, "max-lg:hidden")}
						>
							<TagIcon size={14} strokeWidth={2} />
							Tags
						</Link>
						{canPush ? (
							<Link
								to="/$owner/$repo/releases/new"
								params={{ owner, repo }}
								className={cn(pillButtonClassName, "text-foreground")}
							>
								<PlusSignIcon size={14} strokeWidth={2} />
								New release
							</Link>
						) : null}
					</>
				}
				bodyClassName="px-0"
			>
				<div className="mx-auto flex w-full max-w-[940px] flex-col gap-4 px-4 pt-4 md:px-6">
					{isLoading ? (
						<ReleasesSkeleton />
					) : releasesQuery.isError ? (
						<RepoEmptyState
							icon={<PackageIcon />}
							title="Couldn't load releases"
							action={
								<button
									type="button"
									onClick={() => void releasesQuery.refetch()}
									className={pillButtonClassName}
								>
									Try again
								</button>
							}
						/>
					) : releases.length === 0 ? (
						<RepoEmptyState
							icon={<PackageIcon />}
							title={
								page > 1 ? "No more releases" : "There aren't any releases here"
							}
							action={
								canPush && page === 1 ? (
									<Link
										to="/$owner/$repo/releases/new"
										params={{ owner, repo }}
										className={cn(pillButtonClassName, "text-foreground")}
									>
										Create a new release
									</Link>
								) : undefined
							}
						>
							Releases package software with release notes and binaries for
							people to download.
						</RepoEmptyState>
					) : (
						<div
							className="flex flex-col pt-4 transition-opacity"
							style={{ opacity: releasesQuery.isPlaceholderData ? 0.6 : 1 }}
						>
							{releases.map((release, index) => (
								<ReleaseCard
									key={release.id}
									defaultOpen={index === 0 && page === 1}
									owner={owner}
									repo={repo}
									scope={scope}
									release={release}
									canPush={canPush}
								/>
							))}
						</div>
					)}

					<Pagination
						page={page}
						hasNextPage={releasesQuery.data?.hasNextPage ?? false}
						onPageChange={(next) => void setPage(next === 1 ? null : next)}
					/>
				</div>
			</RepoPageHeader>
		</>
	);
}

function ReleasesSkeleton() {
	return (
		<div className="flex flex-col gap-4">
			{["a", "b"].map((key) => (
				<div
					key={key}
					className="grid gap-5 rounded-lg bg-surface-0 p-5 shadow-card lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8"
				>
					<div className="flex flex-col gap-3">
						<Skeleton className="h-5 w-16 rounded-full" />
						<Skeleton className="h-5 w-40 rounded" />
						<Skeleton className="h-3 w-32 rounded" />
					</div>
					<div className="flex flex-col gap-2">
						<Skeleton className="h-3.5 w-3/4 rounded" />
						<Skeleton className="h-3.5 w-full rounded" />
						<Skeleton className="h-3.5 w-5/6 rounded" />
						<Skeleton className="h-3.5 w-2/3 rounded" />
					</div>
				</div>
			))}
		</div>
	);
}
