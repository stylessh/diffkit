import { createFileRoute } from "@tanstack/react-router";
import { DashboardContentLoading } from "#/components/layouts/dashboard-content-loading";
import { ReviewPage } from "#/components/pulls/review/review-page";
import {
	githubPullFileSummariesQueryOptions,
	githubPullPageQueryOptions,
} from "#/lib/github.query";
import { buildSeo, formatPageTitle, summarizeText } from "#/lib/seo";

export const Route = createFileRoute("/_protected/$owner/$repo/review/$pullId")(
	{
		loader: ({ context, params }) => {
			const pullNumber = Number(params.pullId);
			const scope = { userId: context.user.id };
			const input = { owner: params.owner, repo: params.repo, pullNumber };

			const cachedPageData = context.queryClient.getQueryData(
				githubPullPageQueryOptions(scope, input).queryKey,
			);
			const cachedFileSummaries = context.queryClient.getQueryData(
				githubPullFileSummariesQueryOptions(scope, input).queryKey,
			);

			return {
				pageData: cachedPageData ?? null,
				fileSummaries: cachedFileSummaries ?? null,
				firstFilesPage: null,
			};
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
		pendingComponent: DashboardContentLoading,
		component: ReviewPage,
	},
);
