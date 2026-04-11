import { createFileRoute } from "@tanstack/react-router";
import { IssueDetailPage } from "#/components/issues/detail/issue-detail-page";
import { githubIssuePageQueryOptions } from "#/lib/github.query";
import { buildSeo, formatPageTitle } from "#/lib/seo";

export const Route = createFileRoute(
	"/_protected/$owner/$repo/issues/$issueId",
)({
	ssr: false,
	loader: ({ context, params }) => {
		const issueNumber = Number(params.issueId);
		const scope = { userId: context.user.id };
		const pageOptions = githubIssuePageQueryOptions(scope, {
			owner: params.owner,
			repo: params.repo,
			issueNumber,
		});

		// Clean up null cache entries (issue not found)
		const cachedData = context.queryClient.getQueryData(pageOptions.queryKey);
		if (cachedData === null) {
			context.queryClient.removeQueries({
				queryKey: pageOptions.queryKey,
				exact: true,
			});
		}

		// Never block navigation — fire prefetch and let the component
		// show cached data instantly or a skeleton while loading.
		void context.queryClient.prefetchQuery(pageOptions);
	},
	head: ({ match, params }) =>
		buildSeo({
			path: match.pathname,
			title: formatPageTitle(`Issue #${params.issueId}`),
			description: `Private GitHub issue #${params.issueId} in ${params.owner}/${params.repo}.`,
			robots: "noindex",
		}),
	component: IssueDetailPage,
});
