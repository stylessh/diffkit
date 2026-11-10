import { createFileRoute } from "@tanstack/react-router";
import { GenericRoutePending } from "#/components/layouts/dashboard-content-loading";
import { ReviewPage } from "#/components/pulls/review/review-page";
import {
	githubPullFileSummariesQueryOptions,
	githubPullFilesInfiniteQueryOptions,
	githubPullPageQueryOptions,
} from "#/lib/github.query";
import { privatePageSeo } from "#/routes/-private-page-seo";

export const Route = createFileRoute("/_protected/$owner/$repo/review/$pullId")(
	{
		ssr: false,
		loader: ({ context, params }) => {
			const pullNumber = Number(params.pullId);
			const scope = { userId: context.user.id };
			const input = { owner: params.owner, repo: params.repo, pullNumber };
			const pageOptions = githubPullPageQueryOptions(scope, input);
			const fileSummariesOptions = githubPullFileSummariesQueryOptions(
				scope,
				input,
			);
			const filesOptions = githubPullFilesInfiniteQueryOptions(scope, input);

			// Never block navigation — fire prefetches and let the component
			// show cached data instantly or a skeleton while loading.
			void context.queryClient.prefetchQuery(pageOptions);
			void context.queryClient.prefetchInfiniteQuery(fileSummariesOptions);
			void context.queryClient.prefetchInfiniteQuery(filesOptions);

			const cachedPageData = context.queryClient.getQueryData(
				pageOptions.queryKey,
			);
			return {
				prTitle: cachedPageData?.detail?.title ?? null,
			};
		},
		head: ({ match, params }) =>
			privatePageSeo(match, {
				title: match.loaderData?.prTitle
					? `Review: ${match.loaderData.prTitle}`
					: `Review PR #${params.pullId}`,
				description: `Private code review workspace for pull request #${params.pullId} in ${params.owner}/${params.repo}.`,
			}),
		pendingComponent: GenericRoutePending,
		component: ReviewPage,
	},
);
