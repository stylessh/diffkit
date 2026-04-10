import { createFileRoute } from "@tanstack/react-router";
import { PullDetailPage } from "#/components/pulls/detail/pull-detail-page";
import {
	githubPullPageQueryOptions,
	githubViewerQueryOptions,
} from "#/lib/github.query";
import { buildSeo, formatPageTitle, summarizeText } from "#/lib/seo";

export const Route = createFileRoute("/_protected/$owner/$repo/pull/$pullId")({
	loader: async ({ context, params }) => {
		const pullNumber = Number(params.pullId);
		const scope = { userId: context.user.id };
		const pageOptions = githubPullPageQueryOptions(scope, {
			owner: params.owner,
			repo: params.repo,
			pullNumber,
		});

		const cachedData = context.queryClient.getQueryData(pageOptions.queryKey);
		if (cachedData !== undefined) {
			void context.queryClient.ensureQueryData(githubViewerQueryOptions(scope));
			return cachedData;
		}

		const [pageData] = await Promise.all([
			context.queryClient.ensureQueryData(pageOptions),
			context.queryClient.ensureQueryData(githubViewerQueryOptions(scope)),
		]);
		return pageData;
	},
	head: ({ loaderData, match, params }) => {
		const pull = loaderData?.detail;
		const title = pull
			? formatPageTitle(`PR #${pull.number}: ${pull.title}`)
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
	component: PullDetailPage,
});
