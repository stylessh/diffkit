import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { DashboardContentLoading } from "#/components/layouts/dashboard-content-loading";
import { RepoTagsPage } from "#/components/repo/tags/repo-tags-page";
import {
	githubRepoOverviewQueryOptions,
	githubRepoTagsListInfiniteQueryOptions,
} from "#/lib/github.query";
import { buildSeo, formatPageTitle } from "#/lib/seo";

export const Route = createFileRoute("/_protected/$owner/$repo/tags")({
	ssr: false,
	loader: ({ context, params }) => {
		const scope = { userId: context.user.id };
		const input = { owner: params.owner, repo: params.repo };
		void context.queryClient.prefetchQuery(
			githubRepoOverviewQueryOptions(scope, input),
		);
		void context.queryClient.prefetchInfiniteQuery(
			githubRepoTagsListInfiniteQueryOptions(scope, {
				...input,
				query: undefined,
			}),
		);
	},
	head: ({ match, params }) =>
		buildSeo({
			path: match.pathname,
			title: formatPageTitle(`Tags · ${params.owner}/${params.repo}`),
			description: `Tags in ${params.owner}/${params.repo}.`,
			robots: "noindex",
		}),
	pendingComponent: DashboardContentLoading,
	component: RepoTagsRoute,
});

function RepoTagsRoute() {
	const { user } = Route.useRouteContext();
	const { owner, repo } = Route.useParams();
	const scope = useMemo(() => ({ userId: user.id }), [user.id]);
	return <RepoTagsPage owner={owner} repo={repo} scope={scope} />;
}
