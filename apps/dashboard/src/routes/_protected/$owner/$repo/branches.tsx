import { createFileRoute } from "@tanstack/react-router";
import { RepoBranchesPage } from "#/components/repo/branches/repo-branches-page";
import {
	githubRepoBranchesListInfiniteQueryOptions,
	githubRepoOverviewQueryOptions,
} from "#/lib/github.query";
import { useGitHubQueryScope } from "#/lib/use-github-query-scope";
import { privatePageSeo } from "#/routes/-private-page-seo";

export const Route = createFileRoute("/_protected/$owner/$repo/branches")({
	ssr: false,
	loader: ({ context, params }) => {
		const scope = { userId: context.user.id };
		const input = { owner: params.owner, repo: params.repo };
		void context.queryClient.prefetchQuery(
			githubRepoOverviewQueryOptions(scope, input),
		);
		void context.queryClient.prefetchInfiniteQuery(
			githubRepoBranchesListInfiniteQueryOptions(scope, {
				...input,
				query: undefined,
			}),
		);
	},
	head: ({ match, params }) =>
		privatePageSeo(match, {
			title: `Branches · ${params.owner}/${params.repo}`,
			description: `Branches in ${params.owner}/${params.repo}.`,
		}),
	component: RepoBranchesRoute,
});

function RepoBranchesRoute() {
	const { owner, repo } = Route.useParams();
	const scope = useGitHubQueryScope();
	return <RepoBranchesPage owner={owner} repo={repo} scope={scope} />;
}
