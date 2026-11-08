import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { DashboardContentLoading } from "#/components/layouts/dashboard-content-loading";
import { RepoCommitsPage } from "#/components/repo/commits/repo-commits-page";
import {
	githubRepoCommitsQueryOptions,
	githubRepoOverviewQueryOptions,
	REPO_COMMITS_PER_PAGE,
} from "#/lib/github.query";
import { buildSeo, formatPageTitle } from "#/lib/seo";

export const Route = createFileRoute("/_protected/$owner/$repo/commits/")({
	ssr: false,
	loader: ({ context, params }) => {
		const scope = { userId: context.user.id };
		// First page of the default branch; filters in the URL refetch on mount.
		void context.queryClient.prefetchQuery(
			githubRepoCommitsQueryOptions(scope, {
				owner: params.owner,
				repo: params.repo,
				page: 1,
				perPage: REPO_COMMITS_PER_PAGE,
			}),
		);
		void context.queryClient.prefetchQuery(
			githubRepoOverviewQueryOptions(scope, {
				owner: params.owner,
				repo: params.repo,
			}),
		);
	},
	head: ({ match, params }) =>
		buildSeo({
			path: match.pathname,
			title: formatPageTitle(`Commits · ${params.owner}/${params.repo}`),
			description: `Commit history for ${params.owner}/${params.repo}.`,
			robots: "noindex",
		}),
	pendingComponent: DashboardContentLoading,
	component: RepoCommitsIndexRoute,
});

function RepoCommitsIndexRoute() {
	const { user } = Route.useRouteContext();
	const { owner, repo } = Route.useParams();
	const scope = useMemo(() => ({ userId: user.id }), [user.id]);
	return <RepoCommitsPage owner={owner} repo={repo} scope={scope} />;
}
