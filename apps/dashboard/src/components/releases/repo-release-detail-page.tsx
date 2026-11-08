import { ChevronLeftIcon } from "@diffkit/icons";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { DashboardContentLoading } from "#/components/layouts/dashboard-content-loading";
import { SidePanelPortal } from "#/components/layouts/dashboard-side-panel";
import { RepoActivityCards } from "#/components/repo/repo-activity-cards";
import { RepoNav } from "#/components/repo/repo-nav";
import {
	type GitHubQueryScope,
	githubRepoOverviewQueryOptions,
	githubRepoReleaseQueryOptions,
	githubRepoViewerPermissionQueryOptions,
} from "#/lib/github.query";
import { useHasMounted } from "#/lib/use-has-mounted";
import { useRegisterTab } from "#/lib/use-register-tab";
import { ReleaseCard } from "./release-card";

export function RepoReleaseDetailPage({
	owner,
	repo,
	tag,
	scope,
}: {
	owner: string;
	repo: string;
	tag: string;
	scope: GitHubQueryScope;
}) {
	const hasMounted = useHasMounted();
	const navigate = useNavigate();
	const overviewQuery = useQuery({
		...githubRepoOverviewQueryOptions(scope, { owner, repo }),
		enabled: hasMounted,
	});
	const repoData = overviewQuery.data;
	const permissionQuery = useQuery({
		...githubRepoViewerPermissionQueryOptions(scope, { owner, repo }),
		enabled: hasMounted,
	});
	const releaseQuery = useQuery({
		...githubRepoReleaseQueryOptions(scope, { owner, repo, tag }),
		enabled: hasMounted,
	});
	const release = releaseQuery.data;

	useRegisterTab(
		release
			? {
					type: "releases",
					title: release.name,
					url: `/${owner}/${repo}/releases/${encodeURIComponent(tag)}`,
					repo: `${owner}/${repo}`,
					iconColor: release.isPrerelease
						? "text-amber-500"
						: "text-muted-foreground",
					tabId: `releases:${owner}/${repo}@${release.tagName}`,
				}
			: null,
	);

	return (
		<>
			<div className="h-full overflow-auto py-10">
				<div className="mx-auto flex min-h-full max-w-4xl flex-col gap-6 px-3 md:px-6">
					<RepoNav
						owner={owner}
						repo={repo}
						active="releases"
						repoData={repoData}
					/>
					<Link
						to="/$owner/$repo/releases"
						params={{ owner, repo }}
						className="flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
					>
						<ChevronLeftIcon size={14} />
						All releases
					</Link>

					{!hasMounted || releaseQuery.isPending ? (
						<div className="flex flex-1 items-center justify-center py-24">
							<DashboardContentLoading />
						</div>
					) : releaseQuery.isError ? (
						<p className="py-12 text-center text-sm text-muted-foreground">
							Couldn't load this release.{" "}
							<button
								type="button"
								onClick={() => void releaseQuery.refetch()}
								className="underline underline-offset-2 hover:text-foreground"
							>
								Try again
							</button>
						</p>
					) : !release ? (
						<div className="rounded-xl border border-dashed px-5 py-12 text-center">
							<p className="text-sm font-medium">No release for {tag}</p>
							<p className="mt-1 text-sm text-muted-foreground">
								It may have been deleted, or the tag has no release yet.{" "}
								<Link
									to="/$owner/$repo/tree/$"
									params={{ owner, repo, _splat: tag }}
									className="underline underline-offset-2 hover:text-foreground"
								>
									Browse the tag
								</Link>
							</p>
						</div>
					) : (
						<ReleaseCard
							owner={owner}
							repo={repo}
							scope={scope}
							release={release}
							variant="detail"
							canPush={permissionQuery.data?.canPush ?? false}
							onDeleted={() =>
								void navigate({
									to: "/$owner/$repo/releases",
									params: { owner, repo },
								})
							}
						/>
					)}
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
