import { DetailLayout } from "@diffkit/ui/components/detail-layout";
import { Skeleton } from "@diffkit/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { SidePanelPortal } from "#/components/layouts/dashboard-side-panel";
import {
	type GitHubQueryScope,
	githubRepoOverviewQueryOptions,
	githubRepoTreeQueryOptions,
} from "#/lib/github.query";
import { useHasMounted } from "#/lib/use-has-mounted";
import { useRegisterTab } from "#/lib/use-register-tab";
import { BranchComparisonBanner } from "./branch-comparison-banner";
import { CodeExplorerToolbar } from "./code-explorer-toolbar";
import { FileTree } from "./file-tree";
import { LatestCommitBar } from "./latest-commit-bar";
import { RecentPushBanner } from "./recent-push-banner";
import { RepoActivityCards } from "./repo-activity-cards";
import { RepoHeader } from "./repo-header";
import { RepoMarkdownFiles } from "./repo-markdown-files";
import { RepoOverviewSkeleton } from "./repo-overview-skeleton";
import { RepoSidebar } from "./repo-sidebar";
import { cardRowClassName, RepoCard } from "./repo-ui";

export function RepoOverviewPage({
	owner,
	repo,
	scope,
	currentRef,
}: {
	owner: string;
	repo: string;
	scope: GitHubQueryScope;
	currentRef?: string;
}) {
	const hasMounted = useHasMounted();
	const navigate = useNavigate();

	const overviewQuery = useQuery({
		...githubRepoOverviewQueryOptions(scope, { owner, repo }),
		enabled: hasMounted,
	});

	const repoData = overviewQuery.data;
	const activeRef = currentRef ?? repoData?.defaultBranch ?? "main";
	const isDefaultBranch = !repoData || activeRef === repoData.defaultBranch;

	const handleBranchChange = useCallback(
		(branch: string) => {
			if (branch === activeRef) return;
			if (branch === repoData?.defaultBranch) {
				void navigate({
					to: "/$owner/$repo",
					params: { owner, repo },
				});
				return;
			}
			void navigate({
				to: "/$owner/$repo/tree/$",
				params: { owner, repo, _splat: branch },
			});
		},
		[activeRef, navigate, owner, repo, repoData?.defaultBranch],
	);

	useRegisterTab(
		repoData
			? {
					type: "repo",
					title: `${owner}/${repoData.name}`,
					url: `/${owner}/${repo}`,
					repo: `${owner}/${repo}`,
					iconColor: "text-muted-foreground",
					avatarUrl: repoData.ownerAvatarUrl,
				}
			: null,
	);

	const treeQuery = useQuery({
		...githubRepoTreeQueryOptions(scope, {
			owner,
			repo,
			ref: activeRef,
			path: "",
		}),
		enabled: hasMounted && !!repoData,
	});

	if (overviewQuery.error) throw overviewQuery.error;

	return (
		<>
			<div className="flex h-full min-h-0 flex-col">
				<RepoHeader owner={owner} repo={repo} scope={scope} active="code" />
				{repoData ? (
					<DetailLayout
						panel={<RepoSidebar repo={repoData} scope={scope} />}
						panelLabel="About this repository"
					>
						<div className="flex min-w-0 flex-col">
							<CodeExplorerToolbar
								repo={repoData}
								currentRef={activeRef}
								scope={scope}
								onBranchChange={handleBranchChange}
							/>

							{!isDefaultBranch && (
								<div className="mt-4">
									<BranchComparisonBanner
										owner={owner}
										repo={repo}
										scope={scope}
										currentBranch={activeRef}
										defaultBranch={repoData.defaultBranch}
									/>
								</div>
							)}

							{isDefaultBranch && (
								<RecentPushBanner
									owner={owner}
									repo={repo}
									scope={scope}
									defaultBranch={repoData.defaultBranch}
									className="mt-4"
								/>
							)}

							<RepoCard className="-mx-3 mt-4">
								<LatestCommitBar
									owner={owner}
									repoName={repo}
									ref={activeRef}
									scope={scope}
									defaultBranch={repoData.defaultBranch}
									defaultBranchTip={repoData.latestCommit}
								/>
								{treeQuery.data ? (
									<FileTree
										entries={treeQuery.data}
										owner={owner}
										repo={repo}
										currentRef={activeRef}
										scope={scope}
									/>
								) : (
									<FileTreeSkeleton />
								)}
							</RepoCard>

							{treeQuery.data && (
								<div className="mt-6">
									<RepoMarkdownFiles
										entries={treeQuery.data}
										owner={owner}
										repo={repo}
										currentRef={activeRef}
										scope={scope}
									/>
								</div>
							)}
						</div>
					</DetailLayout>
				) : (
					<RepoOverviewSkeleton />
				)}
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

const skeletonRows = ["s0", "s1", "s2", "s3", "s4", "s5", "s6", "s7"];

export function FileTreeSkeleton() {
	return (
		<div>
			{skeletonRows.map((key) => (
				<div key={key} className={cardRowClassName}>
					<Skeleton className="size-3.5 shrink-0 rounded" />
					<Skeleton className="h-3.5 w-28 shrink-0 rounded sm:w-40" />
					<Skeleton className="h-3.5 flex-1 rounded" />
					<Skeleton className="h-3.5 w-8 shrink-0 rounded" />
				</div>
			))}
		</div>
	);
}
