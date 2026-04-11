import { createFileRoute } from "@tanstack/react-router";
import { IssueDetailPage } from "#/components/issues/detail/issue-detail-page";
import { githubIssuePageQueryOptions } from "#/lib/github.query";
import { buildSeo, formatPageTitle, summarizeText } from "#/lib/seo";

export const Route = createFileRoute(
	"/_protected/$owner/$repo/issues/$issueId",
)({
	loader: async ({ context, params }) => {
		const issueNumber = Number(params.issueId);
		const scope = { userId: context.user.id };
		const pageOptions = githubIssuePageQueryOptions(scope, {
			owner: params.owner,
			repo: params.repo,
			issueNumber,
		});

		const cachedData = context.queryClient.getQueryData(pageOptions.queryKey);
		if (cachedData !== null && cachedData !== undefined) {
			return cachedData;
		}
		if (cachedData === null) {
			context.queryClient.removeQueries({
				queryKey: pageOptions.queryKey,
				exact: true,
			});
		}

		return context.queryClient.ensureQueryData(pageOptions);
	},
	head: ({ loaderData, match, params }) => {
		const issue = loaderData?.detail;
		const issueTitle = issue
			? formatPageTitle(`Issue #${issue.number}: ${issue.title}`)
			: formatPageTitle(`Issue #${params.issueId}`);

		return buildSeo({
			path: match.pathname,
			title: issueTitle,
			description: issue
				? summarizeText(
						issue.body,
						`Private GitHub issue #${issue.number} in ${params.owner}/${params.repo}.`,
					)
				: `Private GitHub issue #${params.issueId} in ${params.owner}/${params.repo}.`,
			robots: "noindex",
		});
	},
	component: IssueDetailPage,
});
