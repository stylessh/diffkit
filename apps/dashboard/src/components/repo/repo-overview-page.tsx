import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { SidePanelPortal } from "#/components/layouts/dashboard-side-panel";
import {
	type GitHubQueryScope,
	githubQueryKeys,
	githubRepoOverviewQueryOptions,
	githubRepoTreeQueryOptions,
} from "#/lib/github.query";
import { githubRevalidationSignalKeys } from "#/lib/github-revalidation";
import { useGitHubSignalStream } from "#/lib/use-github-signal-stream";
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
	const overviewInput = { owner, repo };
	const overviewRefreshTargets = [
		{
			queryKey: githubQueryKeys.repo.overview(scope, overviewInput),
			signalKeys: [
				githubRevalidationSignalKeys.repoMeta(overviewInput),
				githubRevalidationSignalKeys.repoCode(overviewInput),
			],
		},
	];
	useGitHubSignalStream(overviewRefreshTargets);

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
	if (!repoData) return <RepoOverviewSkeleton />;

	return (
		<>
			<div className="h-full overflow-auto">
				<div className="mx-auto grid max-w-7xl gap-10 px-3 py-10 md:px-6 xl:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]">
					<div className="flex min-w-0 flex-col gap-6">
						<RepoHeader repo={repoData} scope={scope} />

						<CodeExplorerToolbar
							repo={repoData}
							currentRef={activeRef}
							scope={scope}
							onBranchChange={handleBranchChange}
						/>

						{!isDefaultBranch && (
							<BranchComparisonBanner
								owner={owner}
								repo={repo}
								scope={scope}
								currentBranch={activeRef}
								defaultBranch={repoData.defaultBranch}
							/>
						)}

						{isDefaultBranch && (
							<RecentPushBanner
								owner={owner}
								repo={repo}
								scope={scope}
								defaultBranch={repoData.defaultBranch}
							/>
						)}

						<div>
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
						</div>

						{treeQuery.data && (
							<RepoMarkdownFiles
								entries={treeQuery.data}
								owner={owner}
								repo={repo}
								currentRef={activeRef}
								scope={scope}
							/>
						)}
					</div>

					<RepoSidebar repo={repoData} scope={scope} />
				</div>
			</div>
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

const skeletonRows = ["s0", "s1", "s2", "s3", "s4", "s5", "s6", "s7"];

function FileTreeSkeleton() {
	return (
		<div className="overflow-hidden rounded-b-lg border">
			{skeletonRows.map((key) => (
				<div
					key={key}
					className="flex items-center gap-4 border-b px-4 py-2.5 last:border-b-0"
				>
					<div className="size-4 shrink-0 animate-pulse rounded bg-surface-1" />
					<div className="h-4 w-32 animate-pulse rounded-md bg-surface-1" />
					<div className="h-4 flex-1 animate-pulse rounded-md bg-surface-1" />
					<div className="h-4 w-12 shrink-0 animate-pulse rounded-md bg-surface-1" />
				</div>
			))}
		</div>
	);
}
