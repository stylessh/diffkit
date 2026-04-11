import { createFileRoute } from "@tanstack/react-router";
import { ReviewPage } from "#/components/pulls/review/review-page";
import { getPullFiles } from "#/lib/github.functions";
import {
	githubPullFileSummariesQueryOptions,
	githubPullPageQueryOptions,
	githubQueryKeys,
} from "#/lib/github.query";
import { buildSeo, formatPageTitle, summarizeText } from "#/lib/seo";

const PULL_FILES_PAGE_SIZE = 25;

export const Route = createFileRoute("/_protected/$owner/$repo/review/$pullId")(
	{
		loader: async ({ context, params }) => {
			const pullNumber = Number(params.pullId);
			const scope = { userId: context.user.id };
			const input = { owner: params.owner, repo: params.repo, pullNumber };
			const pageOptions = githubPullPageQueryOptions(scope, input);
			const fileSummariesOptions = githubPullFileSummariesQueryOptions(
				scope,
				input,
			);

			const cachedPageData = context.queryClient.getQueryData(
				pageOptions.queryKey,
			);
			const cachedFileSummaries = context.queryClient.getQueryData(
				fileSummariesOptions.queryKey,
			);

			// Check if infinite query already has data
			const filesQueryKey = githubQueryKeys.pulls.files(scope, input);
			const cachedFilesData = context.queryClient.getQueryData(filesQueryKey);

			const [pageData, fileSummaries, firstFilesPage] = await Promise.all([
				cachedPageData ?? context.queryClient.ensureQueryData(pageOptions),
				cachedFileSummaries ??
					context.queryClient.ensureQueryData(fileSummariesOptions),
				cachedFilesData
					? null
					: getPullFiles({
							data: {
								...input,
								page: 1,
								perPage: PULL_FILES_PAGE_SIZE,
							},
						}),
			]);

			return { pageData, fileSummaries, firstFilesPage };
		},
		head: ({ loaderData, match, params }) => {
			const pull = loaderData?.pageData?.detail;
			const title = pull
				? formatPageTitle(pull.title)
				: formatPageTitle(`Review PR #${params.pullId}`);

			return buildSeo({
				path: match.pathname,
				title,
				description: pull
					? summarizeText(
							pull.body,
							`Private code review workspace for pull request #${pull.number} in ${params.owner}/${params.repo}.`,
						)
					: `Private code review workspace for pull request #${params.pullId} in ${params.owner}/${params.repo}.`,
				robots: "noindex",
			});
		},
		component: ReviewPage,
	},
);
