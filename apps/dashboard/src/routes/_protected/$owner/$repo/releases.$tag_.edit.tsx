import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { DashboardContentLoading } from "#/components/layouts/dashboard-content-loading";
import { ReleaseFormPage } from "#/components/releases/release-form-page";
import {
	githubRepoOverviewQueryOptions,
	githubRepoReleaseQueryOptions,
	githubRepoViewerPermissionQueryOptions,
} from "#/lib/github.query";
import { buildSeo, formatPageTitle } from "#/lib/seo";

export const Route = createFileRoute(
	"/_protected/$owner/$repo/releases/$tag_/edit",
)({
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
				`Edit release ${params.tag} · ${params.owner}/${params.repo}`,
			),
			description: `Edit release ${params.tag} of ${params.owner}/${params.repo}.`,
			robots: "noindex",
		}),
	pendingComponent: DashboardContentLoading,
	component: EditReleaseRoute,
});

function EditReleaseRoute() {
	const { user } = Route.useRouteContext();
	const { owner, repo, tag } = Route.useParams();
	const scope = useMemo(() => ({ userId: user.id }), [user.id]);
	return (
		<ReleaseFormPage owner={owner} repo={repo} scope={scope} editTag={tag} />
	);
}
