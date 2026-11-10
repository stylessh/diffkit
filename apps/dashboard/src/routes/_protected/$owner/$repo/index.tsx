import { createFileRoute } from "@tanstack/react-router";
import { RepoOverviewPage } from "#/components/repo/repo-overview-page";
import {
	githubRepoBlobQueryOptions,
	githubRepoGitTreeQueryOptions,
	githubRepoOverviewQueryOptions,
	githubViewerQueryOptions,
} from "#/lib/github.query";
import { useGitHubQueryScope } from "#/lib/use-github-query-scope";
import { privatePageSeo } from "#/routes/-private-page-seo";

export const Route = createFileRoute("/_protected/$owner/$repo/")({
	ssr: false,
	loader: ({ context, params }) => {
		const scope = { userId: context.user.id };
		const overviewOptions = githubRepoOverviewQueryOptions(scope, {
			owner: params.owner,
			repo: params.repo,
		});

		const cachedData = context.queryClient.getQueryData(
			overviewOptions.queryKey,
		);
		if (cachedData !== undefined && !cachedData) {
			context.queryClient.removeQueries({
				queryKey: overviewOptions.queryKey,
				exact: true,
			});
		}

		void context.queryClient.prefetchQuery(overviewOptions);
		void context.queryClient.prefetchQuery(githubViewerQueryOptions(scope));

		const cachedOverview = context.queryClient.getQueryData(
			overviewOptions.queryKey,
		);
		if (cachedOverview) {
			const input = {
				owner: params.owner,
				repo: params.repo,
				ref: cachedOverview.defaultBranch,
			};
			void context.queryClient.prefetchQuery(
				githubRepoGitTreeQueryOptions(scope, input),
			);
			const readme = context.queryClient
				.getQueryData(githubRepoGitTreeQueryOptions(scope, input).queryKey)
				?.entries.find((entry) => /^readme(\.md)?$/i.test(entry.path));
			if (readme) {
				void context.queryClient.prefetchQuery(
					githubRepoBlobQueryOptions(scope, { ...input, path: readme.path }),
				);
			}
		}
	},
	head: ({ match, params }) =>
		privatePageSeo(match, {
			title: `${params.owner}/${params.repo}`,
			description: `Repository overview for ${params.owner}/${params.repo}.`,
		}),
	component: RepoOverviewRoute,
});

function RepoOverviewRoute() {
	const { owner, repo } = Route.useParams();
	const scope = useGitHubQueryScope();
	return <RepoOverviewPage owner={owner} repo={repo} scope={scope} />;
}
