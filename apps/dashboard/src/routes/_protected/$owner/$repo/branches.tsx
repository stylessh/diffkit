import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { DashboardContentLoading } from "#/components/layouts/dashboard-content-loading";
import { RepoBranchesPage } from "#/components/repo/branches/repo-branches-page";
import {
	githubRepoBranchesListInfiniteQueryOptions,
	githubRepoOverviewQueryOptions,
} from "#/lib/github.query";
import { buildSeo, formatPageTitle } from "#/lib/seo";

export const Route = createFileRoute("/_protected/$owner/$repo/branches")({
	ssr: false,
	loader: ({ context, params }) => {
		const scope = { userId: context.user.id };
		const input = { owner: params.owner, repo: params.repo };
		void context.queryClient.prefetchQuery(
			githubRepoOverviewQueryOptions(scope, input),
		);
		void context.queryClient.prefetchInfiniteQuery(
			githubRepoBranchesListInfiniteQueryOptions(scope, {
				...input,
				query: undefined,
			}),
		);
	},
	head: ({ match, params }) =>
		buildSeo({
			path: match.pathname,
			title: formatPageTitle(`Branches · ${params.owner}/${params.repo}`),
			description: `Branches in ${params.owner}/${params.repo}.`,
			robots: "noindex",
		}),
	pendingComponent: DashboardContentLoading,
	component: RepoBranchesRoute,
});

function RepoBranchesRoute() {
	const { user } = Route.useRouteContext();
	const { owner, repo } = Route.useParams();
	const scope = useMemo(() => ({ userId: user.id }), [user.id]);
	return <RepoBranchesPage owner={owner} repo={repo} scope={scope} />;
}
