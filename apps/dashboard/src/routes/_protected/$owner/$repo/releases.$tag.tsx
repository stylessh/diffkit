import { createFileRoute } from "@tanstack/react-router";
import { RepoReleaseDetailPage } from "#/components/releases/repo-release-detail-page";
import {
	githubRepoOverviewQueryOptions,
	githubRepoReleaseQueryOptions,
	githubRepoViewerPermissionQueryOptions,
} from "#/lib/github.query";
import { useGitHubQueryScope } from "#/lib/use-github-query-scope";
import { privatePageSeo } from "#/routes/-private-page-seo";

export const Route = createFileRoute("/_protected/$owner/$repo/releases/$tag")({
	ssr: false,
	loader: ({ context, params }) => {
		const scope = { userId: context.user.id };
		const input = { owner: params.owner, repo: params.repo };
		void context.queryClient.prefetchQuery(
			githubRepoReleaseQueryOptions(scope, { ...input, tag: params.tag }),
		);
		void context.queryClient.prefetchQuery(
			githubRepoOverviewQueryOptions(scope, input),
		);
		void context.queryClient.prefetchQuery(
			githubRepoViewerPermissionQueryOptions(scope, input),
		);
	},
	head: ({ match, params }) =>
		privatePageSeo(match, {
			title: `Release ${params.tag} · ${params.owner}/${params.repo}`,
			description: `Release ${params.tag} of ${params.owner}/${params.repo}.`,
		}),
	component: RepoReleaseRoute,
});

function RepoReleaseRoute() {
	const { owner, repo, tag } = Route.useParams();
	const scope = useGitHubQueryScope();
	return (
		<RepoReleaseDetailPage owner={owner} repo={repo} tag={tag} scope={scope} />
	);
}
