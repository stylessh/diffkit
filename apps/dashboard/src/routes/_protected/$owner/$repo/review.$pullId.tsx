import { createFileRoute } from "@tanstack/react-router";
import { ReviewPage } from "#/components/pulls/review/review-page";
import {
	githubPullFileSummariesQueryOptions,
	githubPullPageQueryOptions,
} from "#/lib/github.query";
import { buildSeo, formatPageTitle, summarizeText } from "#/lib/seo";

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

			const pageData =
				context.queryClient.getQueryData(pageOptions.queryKey) ??
				(await context.queryClient.ensureQueryData(pageOptions));

			const fileSummaries =
				context.queryClient.getQueryData(fileSummariesOptions.queryKey) ??
				(await context.queryClient.ensureQueryData(fileSummariesOptions));

			return { pageData, fileSummaries };
		},
		head: ({ loaderData, match, params }) => {
			const pull = loaderData?.pageData?.detail;
			const title = pull
				? formatPageTitle(`Review PR #${pull.number}: ${pull.title}`)
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
