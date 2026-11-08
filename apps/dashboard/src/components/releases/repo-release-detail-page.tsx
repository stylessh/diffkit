import { PackageIcon } from "@diffkit/icons";
import { PageHeaderTitle } from "@diffkit/ui/components/page-header";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { DashboardContentLoading } from "#/components/layouts/dashboard-content-loading";
import { SidePanelPortal } from "#/components/layouts/dashboard-side-panel";
import { RepoActivityCards } from "#/components/repo/repo-activity-cards";
import { RepoCrumb, RepoPageHeader } from "#/components/repo/repo-page-header";
import { pillButtonClassName, RepoEmptyState } from "#/components/repo/repo-ui";
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
						? "text-warning"
						: "text-muted-foreground",
					tabId: `releases:${owner}/${repo}@${release.tagName}`,
				}
			: null,
	);

	return (
		<>
			<RepoPageHeader
				owner={owner}
				repo={repo}
				scope={scope}
				active="releases"
				trail={
					<>
						<RepoCrumb asChild>
							<Link to="/$owner/$repo/releases" params={{ owner, repo }}>
								Releases
							</Link>
						</RepoCrumb>
						<PageHeaderTitle asChild>
							<span className="font-mono">{tag}</span>
						</PageHeaderTitle>
					</>
				}
				bodyClassName="px-0"
			>
				<div className="mx-auto flex w-full max-w-[780px] flex-col px-4 pt-6 md:px-[46px]">
					{!hasMounted || releaseQuery.isPending ? (
						<div className="flex flex-1 items-center justify-center py-24">
							<DashboardContentLoading />
						</div>
					) : releaseQuery.isError ? (
						<RepoEmptyState
							icon={<PackageIcon />}
							title="Couldn't load this release"
							action={
								<button
									type="button"
									onClick={() => void releaseQuery.refetch()}
									className={pillButtonClassName}
								>
									Try again
								</button>
							}
						/>
					) : !release ? (
						<RepoEmptyState
							icon={<PackageIcon />}
							title={`No release for ${tag}`}
							action={
								<Link
									to="/$owner/$repo/tree/$"
									params={{ owner, repo, _splat: tag }}
									className={pillButtonClassName}
								>
									Browse the tag
								</Link>
							}
						>
							It may have been deleted, or the tag has no release yet.
						</RepoEmptyState>
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
			</RepoPageHeader>
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
