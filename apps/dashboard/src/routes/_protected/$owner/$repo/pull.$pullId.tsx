import { createFileRoute } from "@tanstack/react-router";
import { PullDetailPage } from "#/components/pulls/detail/pull-detail-page";
import {
	githubPullPageQueryOptions,
	githubViewerQueryOptions,
} from "#/lib/github.query";
import { buildSeo, formatPageTitle } from "#/lib/seo";

export const Route = createFileRoute("/_protected/$owner/$repo/pull/$pullId")({
	ssr: false,
	loader: ({ context, params }) => {
		const pullNumber = Number(params.pullId);
		const scope = { userId: context.user.id };
		const pageOptions = githubPullPageQueryOptions(scope, {
			owner: params.owner,
			repo: params.repo,
			pullNumber,
		});

		// Clean up broken cache entries (no detail)
		const cachedData = context.queryClient.getQueryData(pageOptions.queryKey);
		if (cachedData !== undefined && !cachedData?.detail) {
			context.queryClient.removeQueries({
				queryKey: pageOptions.queryKey,
				exact: true,
			});
		}

		// Never block navigation — fire prefetches and let the component
		// show cached data instantly or a skeleton while loading.
		void context.queryClient.prefetchQuery(pageOptions);
		void context.queryClient.prefetchQuery(githubViewerQueryOptions(scope));
	},
	head: ({ match, params }) =>
		buildSeo({
			path: match.pathname,
			title: formatPageTitle(`PR #${params.pullId}`),
			description: `Private pull request #${params.pullId} in ${params.owner}/${params.repo}.`,
			robots: "noindex",
		}),
	component: PullDetailPage,
});
