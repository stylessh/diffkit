import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { DashboardContentLoading } from "#/components/layouts/dashboard-content-loading";
import { RepoReleasesPage } from "#/components/releases/repo-releases-page";
import {
	githubRepoOverviewQueryOptions,
	githubRepoReleasesQueryOptions,
	githubRepoViewerPermissionQueryOptions,
	REPO_RELEASES_PER_PAGE,
} from "#/lib/github.query";
import { buildSeo, formatPageTitle } from "#/lib/seo";

export const Route = createFileRoute("/_protected/$owner/$repo/releases/")({
	ssr: false,
	loader: ({ context, params }) => {
		const scope = { userId: context.user.id };
		const input = { owner: params.owner, repo: params.repo };
		void context.queryClient.prefetchQuery(
			githubRepoReleasesQueryOptions(scope, {
				...input,
				page: 1,
				perPage: REPO_RELEASES_PER_PAGE,
			}),
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
			title: formatPageTitle(`Releases · ${params.owner}/${params.repo}`),
			description: `Releases and changelog for ${params.owner}/${params.repo}.`,
			robots: "noindex",
		}),
	pendingComponent: DashboardContentLoading,
	component: RepoReleasesRoute,
});

function RepoReleasesRoute() {
	const { user } = Route.useRouteContext();
	const { owner, repo } = Route.useParams();
	const scope = useMemo(() => ({ userId: user.id }), [user.id]);
	return <RepoReleasesPage owner={owner} repo={repo} scope={scope} />;
}
