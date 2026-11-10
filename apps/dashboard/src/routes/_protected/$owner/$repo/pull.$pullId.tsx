import { createFileRoute } from "@tanstack/react-router";
import { GenericRoutePending } from "#/components/layouts/dashboard-content-loading";
import { PullDetailPage } from "#/components/pulls/detail/pull-detail-page";
import {
	githubPullPageQueryOptions,
	githubViewerQueryOptions,
} from "#/lib/github.query";
import { findPullSummaryInLists } from "#/lib/github-query-updates";
import { privatePageSeo } from "#/routes/-private-page-seo";

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
		const isBrokenEntry = cachedData !== undefined && !cachedData?.detail;
		if (isBrokenEntry) {
			context.queryClient.removeQueries({
				queryKey: pageOptions.queryKey,
				exact: true,
			});
		}

		// Never block navigation — fire prefetches and let the component
		// show cached data instantly or a skeleton while loading.
		void context.queryClient.prefetchQuery(pageOptions);
		void context.queryClient.prefetchQuery(githubViewerQueryOptions(scope));

		return {
			prTitle:
				(isBrokenEntry ? null : cachedData?.detail?.title) ??
				findPullSummaryInLists(context.queryClient, scope, {
					owner: params.owner,
					repo: params.repo,
					pullNumber,
				})?.title ??
				null,
		};
	},
	head: ({ match, params }) =>
		privatePageSeo(match, {
			title: match.loaderData?.prTitle ?? `PR #${params.pullId}`,
			description: `Private pull request #${params.pullId} in ${params.owner}/${params.repo}.`,
		}),
	pendingComponent: GenericRoutePending,
	component: PullDetailPage,
});
