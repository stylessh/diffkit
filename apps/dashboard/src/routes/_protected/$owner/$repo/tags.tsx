import { createFileRoute } from "@tanstack/react-router";
import { RepoTagsPage } from "#/components/repo/tags/repo-tags-page";
import {
	githubRepoOverviewQueryOptions,
	githubRepoTagsListInfiniteQueryOptions,
} from "#/lib/github.query";
import { useGitHubQueryScope } from "#/lib/use-github-query-scope";
import { privatePageSeo } from "#/routes/-private-page-seo";

export const Route = createFileRoute("/_protected/$owner/$repo/tags")({
	ssr: false,
	loader: ({ context, params }) => {
		const scope = { userId: context.user.id };
		const input = { owner: params.owner, repo: params.repo };
		void context.queryClient.prefetchQuery(
			githubRepoOverviewQueryOptions(scope, input),
		);
		void context.queryClient.prefetchInfiniteQuery(
			githubRepoTagsListInfiniteQueryOptions(scope, {
				...input,
				query: undefined,
			}),
		);
	},
	head: ({ match, params }) =>
		privatePageSeo(match, {
			title: `Tags · ${params.owner}/${params.repo}`,
			description: `Tags in ${params.owner}/${params.repo}.`,
		}),
	component: RepoTagsRoute,
});

function RepoTagsRoute() {
	const { owner, repo } = Route.useParams();
	const scope = useGitHubQueryScope();
	return <RepoTagsPage owner={owner} repo={repo} scope={scope} />;
}
