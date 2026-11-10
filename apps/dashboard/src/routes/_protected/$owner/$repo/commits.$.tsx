import { createFileRoute } from "@tanstack/react-router";
import { RepoCommitsPage } from "#/components/repo/commits/repo-commits-page";
import {
	githubRepoCommitsQueryOptions,
	githubRepoOverviewQueryOptions,
	REPO_COMMITS_PER_PAGE,
} from "#/lib/github.query";
import { useGitHubQueryScope } from "#/lib/use-github-query-scope";
import { privatePageSeo } from "#/routes/-private-page-seo";

export const Route = createFileRoute("/_protected/$owner/$repo/commits/$")({
	ssr: false,
	loader: ({ context, params }) => {
		const scope = { userId: context.user.id };
		const splat = params._splat ?? "";
		void context.queryClient.prefetchQuery(
			githubRepoOverviewQueryOptions(scope, {
				owner: params.owner,
				repo: params.repo,
			}),
		);
		// A single-segment splat is unambiguously a ref; slashed splats need the
		// branch list to split ref from path, so the page resolves those itself.
		if (splat && !splat.includes("/")) {
			void context.queryClient.prefetchQuery(
				githubRepoCommitsQueryOptions(scope, {
					owner: params.owner,
					repo: params.repo,
					ref: splat,
					page: 1,
					perPage: REPO_COMMITS_PER_PAGE,
				}),
			);
		}
	},
	head: ({ match, params }) =>
		privatePageSeo(match, {
			title: `Commits · ${params._splat ? `${params._splat} · ` : ""}${params.owner}/${params.repo}`,
			description: `Commit history for ${params.owner}/${params.repo}.`,
		}),
	component: RepoCommitsSplatRoute,
});

function RepoCommitsSplatRoute() {
	const { owner, repo, _splat } = Route.useParams();
	const scope = useGitHubQueryScope();
	return (
		<RepoCommitsPage owner={owner} repo={repo} scope={scope} splat={_splat} />
	);
}
