import { DetailLayout } from "@diffkit/ui/components/detail-layout";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { Skeleton, SkeletonBox } from "skullet/react";
import { SkeletonSample } from "#/components/shared/skeleton-sample";
import {
	type GitHubQueryScope,
	githubRepoOverviewQueryOptions,
} from "#/lib/github.query";
import { useHasMounted } from "#/lib/use-has-mounted";
import { useRegisterTab } from "#/lib/use-register-tab";
import { BranchComparisonBanner } from "./branch-comparison-banner";
import { useDirectoryListing } from "./code/use-directory-listing";
import { CodeExplorerToolbar } from "./code-explorer-toolbar";
import { FileTree } from "./file-tree";
import { LatestCommitBar } from "./latest-commit-bar";
import { RecentPushBanner } from "./recent-push-banner";
import { RepoHeader, RepoHeaderNav } from "./repo-header";
import { RepoMarkdownFiles } from "./repo-markdown-files";
import { SAMPLE_TREE_ENTRIES, sampleRepoOverview } from "./repo-samples";
import { RepoSidebar } from "./repo-sidebar";
import { RepoCard } from "./repo-ui";

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

	const rootListing = useDirectoryListing(
		scope,
		{ owner, repo, ref: activeRef, path: "" },
		hasMounted && !!repoData,
	);
	const rootEntries =
		rootListing.status === "ready" ? rootListing.entries : undefined;

	if (overviewQuery.error) throw overviewQuery.error;

	return (
		<div className="flex h-full min-h-0 flex-col">
			<RepoHeader
				owner={owner}
				repo={repo}
				scope={scope}
				active="code"
				withNav={false}
			/>
			<DetailLayout
				toolbar={
					<RepoHeaderNav
						owner={owner}
						repo={repo}
						scope={scope}
						active="code"
					/>
				}
				panel={
					<Skeleton loading={!repoData}>
						{repoData ? (
							<RepoSidebar repo={repoData} scope={scope} />
						) : (
							<SkeletonSample>
								<RepoSidebar
									repo={sampleRepoOverview(owner, repo)}
									scope={scope}
								/>
							</SkeletonSample>
						)}
					</Skeleton>
				}
				panelLabel="About this repository"
			>
				<Skeleton loading={!repoData} label="Loading repository">
					{repoData ? (
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
								<Skeleton loading={!rootEntries} label="Loading files">
									{rootEntries ? (
										<FileTree
											entries={rootEntries}
											owner={owner}
											repo={repo}
											currentRef={activeRef}
											scope={scope}
										/>
									) : (
										<SkeletonSample>
											<FileTree
												entries={SAMPLE_TREE_ENTRIES}
												owner={owner}
												repo={repo}
												currentRef={activeRef}
												scope={scope}
											/>
										</SkeletonSample>
									)}
								</Skeleton>
							</RepoCard>

							{rootEntries && (
								<div className="mt-6">
									<RepoMarkdownFiles
										entries={rootEntries}
										owner={owner}
										repo={repo}
										currentRef={activeRef}
										scope={scope}
									/>
								</div>
							)}
						</div>
					) : (
						<SkeletonSample>
							<RepoOverviewSample
								owner={owner}
								repo={repo}
								scope={scope}
								currentRef={activeRef}
							/>
						</SkeletonSample>
					)}
				</Skeleton>
			</DetailLayout>
		</div>
	);
}

/**
 * The toolbar's ref picker and file finder register shortcuts and fetch on
 * their own, so the sample draws boxes in their place.
 */
function RepoOverviewSample({
	owner,
	repo,
	scope,
	currentRef,
}: {
	owner: string;
	repo: string;
	scope: GitHubQueryScope;
	currentRef: string;
}) {
	return (
		<div className="flex min-w-0 flex-col">
			<div className="flex min-w-0 items-center gap-1.5">
				<SkeletonBox width={96} height={28} radius={6} />
				<SkeletonBox width={176} height={28} radius={6} className="ml-auto" />
				<SkeletonBox width={80} height={28} radius={6} />
			</div>
			<RepoCard className="-mx-3 mt-4">
				<LatestCommitBar
					owner={owner}
					repoName={repo}
					ref={currentRef}
					scope={scope}
					defaultBranch={currentRef}
					defaultBranchTip={null}
				/>
				<FileTree
					entries={SAMPLE_TREE_ENTRIES}
					owner={owner}
					repo={repo}
					currentRef={currentRef}
					scope={scope}
				/>
			</RepoCard>
		</div>
	);
}
