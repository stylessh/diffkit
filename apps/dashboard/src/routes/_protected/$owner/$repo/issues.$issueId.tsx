import { createFileRoute } from "@tanstack/react-router";
import { IssueDetailPage } from "#/components/issues/detail/issue-detail-page";
import { DashboardContentLoading } from "#/components/layouts/dashboard-content-loading";
import { githubIssuePageQueryOptions } from "#/lib/github.query";
import { buildSeo, formatPageTitle, summarizeText } from "#/lib/seo";

export const Route = createFileRoute(
	"/_protected/$owner/$repo/issues/$issueId",
)({
	loader: ({ context, params }) => {
		const issueNumber = Number(params.issueId);
		const scope = { userId: context.user.id };

		return context.queryClient.getQueryData(
			githubIssuePageQueryOptions(scope, {
				owner: params.owner,
				repo: params.repo,
				issueNumber,
			}).queryKey,
		);
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
	pendingComponent: DashboardContentLoading,
	component: IssueDetailPage,
});
