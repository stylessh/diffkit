import type { QueryClient } from "@tanstack/react-query";
import {
	type CodeView,
	resolveCodeLocation,
} from "#/lib/code-browsing/code-location";
import {
	type GitHubQueryScope,
	githubFileLastCommitQueryOptions,
	githubRepoBlameQueryOptions,
	githubRepoBlobQueryOptions,
	githubRepoGitTreeQueryOptions,
	githubRepoOverviewQueryOptions,
} from "#/lib/github.query";
import { ExplorerSkeleton, RepoExplorerLayout } from "../repo-explorer-layout";
import { RepoHeader } from "../repo-header";
import { RepoOverviewPage } from "../repo-overview-page";
import { cachedRefNames, useCodeLocation } from "./use-code-location";

type CodeRouteInput = {
	owner: string;
	repo: string;
	splat: string | undefined;
	view: CodeView;
};

export function prefetchCodeRoute(
	queryClient: QueryClient,
	scope: GitHubQueryScope,
	{ owner, repo, splat, view }: CodeRouteInput,
) {
	const repoInput = { owner, repo };
	const overviewOptions = githubRepoOverviewQueryOptions(scope, repoInput);
	void queryClient.prefetchQuery(overviewOptions);
	const overview = queryClient.getQueryData(overviewOptions.queryKey);
	if (!overview) return;

	const resolution = resolveCodeLocation(splat, {
		defaultBranch: overview.defaultBranch,
		known: cachedRefNames(queryClient, scope, repoInput),
	});
	if (resolution.status !== "resolved") return;
	const { ref, path } = resolution.location;

	void queryClient.prefetchQuery(
		githubRepoGitTreeQueryOptions(scope, { ...repoInput, ref }),
	);
	if (view === "tree" || !path) return;
	const fileInput = { ...repoInput, ref, path };
	void queryClient.prefetchQuery(githubRepoBlobQueryOptions(scope, fileInput));
	void queryClient.prefetchQuery(
		githubFileLastCommitQueryOptions(scope, fileInput),
	);
	if (view === "blame") {
		void queryClient.prefetchQuery(
			githubRepoBlameQueryOptions(scope, fileInput),
		);
	}
}

export function CodeRoutePage({
	scope,
	owner,
	repo,
	splat,
	view,
}: CodeRouteInput & { scope: GitHubQueryScope }) {
	const state = useCodeLocation(scope, { owner, repo, splat });

	if (state.status === "pending") {
		return (
			<div className="flex h-full min-h-0 flex-col">
				<RepoHeader owner={owner} repo={repo} scope={scope} active="code" />
				<ExplorerSkeleton />
			</div>
		);
	}

	const location = { owner, repo, ...state.location };
	if (view === "tree" && !location.path) {
		return (
			<RepoOverviewPage
				owner={owner}
				repo={repo}
				scope={scope}
				currentRef={location.ref}
			/>
		);
	}
	return (
		<RepoExplorerLayout
			scope={scope}
			repo={state.repo}
			location={location}
			view={view}
		/>
	);
}
