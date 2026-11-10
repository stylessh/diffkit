import { createFileRoute } from "@tanstack/react-router";
import { CommitPage } from "#/components/repo/commit-page";
import { githubRepoCommitQueryOptions } from "#/lib/github.query";
import { privatePageSeo } from "#/routes/-private-page-seo";

export const Route = createFileRoute("/_protected/$owner/$repo/commit/$sha")({
	ssr: false,
	loader: ({ context, params }) => {
		const scope = { userId: context.user.id };
		const input = { owner: params.owner, repo: params.repo, sha: params.sha };
		void context.queryClient.prefetchQuery(
			githubRepoCommitQueryOptions(scope, input),
		);
		return {};
	},
	head: ({ match, params }) =>
		privatePageSeo(match, {
			title: `Commit ${params.sha.slice(0, 7)} · ${params.owner}/${params.repo}`,
			description: `View commit ${params.sha} in ${params.owner}/${params.repo}.`,
		}),
	component: CommitPage,
});
