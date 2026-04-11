import { createFileRoute } from "@tanstack/react-router";
import { DashboardContentLoading } from "#/components/layouts/dashboard-content-loading";
import { PullDetailPage } from "#/components/pulls/detail/pull-detail-page";
import { githubPullPageQueryOptions } from "#/lib/github.query";
import { buildSeo, formatPageTitle, summarizeText } from "#/lib/seo";

export const Route = createFileRoute("/_protected/$owner/$repo/pull/$pullId")({
	loader: ({ context, params }) => {
		const pullNumber = Number(params.pullId);
		const scope = { userId: context.user.id };

		return context.queryClient.getQueryData(
			githubPullPageQueryOptions(scope, {
				owner: params.owner,
				repo: params.repo,
				pullNumber,
			}).queryKey,
		);
	},
	head: ({ loaderData, match, params }) => {
		const pull = loaderData?.detail;
		const title = pull
			? formatPageTitle(pull.title)
			: formatPageTitle(`PR #${params.pullId}`);

		return buildSeo({
			path: match.pathname,
			title,
			description: pull
				? summarizeText(
						pull.body,
						`Private pull request #${pull.number} in ${params.owner}/${params.repo}.`,
					)
				: `Private pull request #${params.pullId} in ${params.owner}/${params.repo}.`,
			robots: "noindex",
		});
	},
	pendingComponent: DashboardContentLoading,
	component: PullDetailPage,
});
