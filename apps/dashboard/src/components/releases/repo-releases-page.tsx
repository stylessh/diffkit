import { PlusSignIcon } from "@diffkit/icons";
import { Button } from "@diffkit/ui/components/button";
import { Skeleton } from "@diffkit/ui/components/skeleton";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { parseAsInteger, useQueryState } from "nuqs";
import { SidePanelPortal } from "#/components/layouts/dashboard-side-panel";
import { Pagination } from "#/components/pagination";
import { TagIcon } from "#/components/repo/refs/tag-icon";
import { RepoActivityCards } from "#/components/repo/repo-activity-cards";
import { RepoPageHeader } from "#/components/repo/repo-page-header";
import {
	type GitHubQueryScope,
	githubRepoOverviewQueryOptions,
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
			<div className="h-full overflow-auto py-10">
				<div className="mx-auto flex min-h-full max-w-5xl flex-col gap-6 px-3 md:px-6">
					<RepoPageHeader
						owner={owner}
						repo={repo}
						repoData={repoData}
						active="releases"
						title="Releases"
						actions={
							<>
								<Button variant="ghost" size="sm" asChild>
									<Link to="/$owner/$repo/tags" params={{ owner, repo }}>
										<TagIcon size={14} />
										Tags
									</Link>
								</Button>
								{canPush ? (
									<Button size="sm" asChild>
										<Link
											to="/$owner/$repo/releases/new"
											params={{ owner, repo }}
										>
											<PlusSignIcon size={14} />
											New release
										</Link>
									</Button>
								) : null}
							</>
						}
					/>

					{isLoading ? (
						<ReleasesSkeleton />
					) : releasesQuery.isError ? (
						<p className="py-12 text-center text-sm text-muted-foreground">
							Couldn't load releases.{" "}
							<button
								type="button"
								onClick={() => void releasesQuery.refetch()}
								className="underline underline-offset-2 hover:text-foreground"
							>
								Try again
							</button>
						</p>
					) : releases.length === 0 ? (
						<div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
							<p className="text-sm font-medium">
								{page > 1
									? "No more releases"
									: "There aren't any releases here"}
							</p>
							<p className="max-w-sm text-sm text-muted-foreground">
								Releases package software with release notes and binaries for
								people to download.
							</p>
							{canPush && page === 1 ? (
								<Button size="sm" asChild>
									<Link
										to="/$owner/$repo/releases/new"
										params={{ owner, repo }}
									>
										Create a new release
									</Link>
								</Button>
							) : null}
						</div>
					) : (
						<div
							className="flex flex-col gap-6 transition-opacity"
							style={{ opacity: releasesQuery.isPlaceholderData ? 0.6 : 1 }}
						>
							{releases.map((release) => (
								<ReleaseCard
									key={release.id}
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

function ReleasesSkeleton() {
	return (
		<div className="flex flex-col gap-6">
			{["a", "b"].map((key) => (
				<div
					key={key}
					className="grid gap-5 rounded-xl border p-5 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-8"
				>
					<div className="flex flex-col gap-3">
						<Skeleton className="h-4 w-16 rounded-full" />
						<Skeleton className="h-6 w-40 rounded" />
						<Skeleton className="h-3 w-32 rounded" />
					</div>
					<div className="flex flex-col gap-2">
						<Skeleton className="h-4 w-3/4 rounded" />
						<Skeleton className="h-4 w-full rounded" />
						<Skeleton className="h-4 w-5/6 rounded" />
						<Skeleton className="h-4 w-2/3 rounded" />
					</div>
				</div>
			))}
		</div>
	);
}
