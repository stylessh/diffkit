import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { DashboardContentLoading } from "#/components/layouts/dashboard-content-loading";
import { RepoReleaseDetailPage } from "#/components/releases/repo-release-detail-page";
import {
	githubRepoOverviewQueryOptions,
	githubRepoReleaseQueryOptions,
	githubRepoViewerPermissionQueryOptions,
} from "#/lib/github.query";
import { buildSeo, formatPageTitle } from "#/lib/seo";

export const Route = createFileRoute("/_protected/$owner/$repo/releases/$tag")({
	ssr: false,
	loader: ({ context, params }) => {
		const scope = { userId: context.user.id };
		const input = { owner: params.owner, repo: params.repo };
		void context.queryClient.prefetchQuery(
			githubRepoReleaseQueryOptions(scope, { ...input, tag: params.tag }),
		);
		void context.queryClient.prefetchQuery(
			githubRepoOverviewQueryOptions(scope, input),
		);
		void context.queryClient.prefetchQuery(
			githubRepoViewerPermissionQueryOptions(scope, input),
		);
	},
	head: ({ match, params }) =>
		buildSeo({
			path: match.pathname,
			title: formatPageTitle(
				`Release ${params.tag} · ${params.owner}/${params.repo}`,
			),
			description: `Release ${params.tag} of ${params.owner}/${params.repo}.`,
			robots: "noindex",
		}),
	pendingComponent: DashboardContentLoading,
	component: RepoReleaseRoute,
});

function RepoReleaseRoute() {
	const { user } = Route.useRouteContext();
	const { owner, repo, tag } = Route.useParams();
	const scope = useMemo(() => ({ userId: user.id }), [user.id]);
	return (
		<RepoReleaseDetailPage owner={owner} repo={repo} tag={tag} scope={scope} />
	);
}
