import { createFileRoute } from "@tanstack/react-router";
import { ReviewPage } from "#/components/pulls/review/review-page";
import { getPullFiles } from "#/lib/github.functions";
import {
	githubPullFileSummariesQueryOptions,
	githubPullPageQueryOptions,
	githubQueryKeys,
} from "#/lib/github.query";
import { buildSeo, formatPageTitle } from "#/lib/seo";

const PULL_FILES_PAGE_SIZE = 25;

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

			// Clean up broken cache entries (no detail)
			const cachedPageData = context.queryClient.getQueryData(
				pageOptions.queryKey,
			);
			const isBrokenEntry =
				cachedPageData !== undefined && !cachedPageData?.detail;
			if (isBrokenEntry) {
				context.queryClient.removeQueries({
					queryKey: pageOptions.queryKey,
					exact: true,
				});
			}

			// Never block navigation — fire prefetches and let the component
			// show cached data instantly or a skeleton while loading.
			void context.queryClient.prefetchQuery(pageOptions);
			void context.queryClient.prefetchQuery(fileSummariesOptions);

			// Prefetch first page of files if not cached
			const filesQueryKey = githubQueryKeys.pulls.files(scope, input);
			if (!context.queryClient.getQueryData(filesQueryKey)) {
				void getPullFiles({
					data: { ...input, page: 1, perPage: PULL_FILES_PAGE_SIZE },
				});
			}

			return {
				prTitle: isBrokenEntry ? null : (cachedPageData?.detail?.title ?? null),
			};
		},
		head: ({ match, params }) =>
			buildSeo({
				path: match.pathname,
				title: formatPageTitle(
					match.loaderData?.prTitle
						? `Review: ${match.loaderData.prTitle}`
						: `Review PR #${params.pullId}`,
				),
				description: `Private code review workspace for pull request #${params.pullId} in ${params.owner}/${params.repo}.`,
				robots: "noindex",
			}),
		component: ReviewPage,
	},
);
