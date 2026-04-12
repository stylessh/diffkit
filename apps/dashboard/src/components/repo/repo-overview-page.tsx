import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useState } from "react";
import {
	githubRepoOverviewQueryOptions,
	githubRepoTreeQueryOptions,
} from "#/lib/github.query";
import { useHasMounted } from "#/lib/use-has-mounted";
import { useRegisterTab } from "#/lib/use-register-tab";
import { CodeExplorerToolbar } from "./code-explorer-toolbar";
import { FileTree } from "./file-tree";
import { LatestCommitBar } from "./latest-commit-bar";
import { RepoHeader } from "./repo-header";
import { RepoMarkdownFiles } from "./repo-markdown-files";
import { RepoOverviewSkeleton } from "./repo-overview-skeleton";
import { RepoSidebar } from "./repo-sidebar";

const routeApi = getRouteApi("/_protected/$owner/$repo/");

export function RepoOverviewPage() {
	const { user } = routeApi.useRouteContext();
	const { owner, repo } = routeApi.useParams();
	const scope = { userId: user.id };
	const hasMounted = useHasMounted();

	const overviewQuery = useQuery({
		...githubRepoOverviewQueryOptions(scope, { owner, repo }),
		enabled: hasMounted,
	});

	const repoData = overviewQuery.data;
	const [currentRef, setCurrentRef] = useState<string | null>(null);
	const activeRef = currentRef ?? repoData?.defaultBranch ?? "main";

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
		<div className="h-full overflow-auto">
			<div className="mx-auto grid max-w-7xl gap-10 px-3 py-10 md:px-6 xl:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]">
				<div className="flex min-w-0 flex-col gap-6">
					<RepoHeader repo={repoData} />

					<CodeExplorerToolbar
						repo={repoData}
						currentRef={activeRef}
						scope={scope}
						onBranchChange={setCurrentRef}
					/>

					<div>
						<LatestCommitBar repo={repoData} />
						{treeQuery.data ? (
							<FileTree entries={treeQuery.data} />
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
