import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { DashboardContentLoading } from "#/components/layouts/dashboard-content-loading";
import { ReleaseFormPage } from "#/components/releases/release-form-page";
import {
	githubRepoOverviewQueryOptions,
	githubRepoRefNamesQueryOptions,
	githubRepoViewerPermissionQueryOptions,
} from "#/lib/github.query";
import { buildSeo, formatPageTitle } from "#/lib/seo";

type NewReleaseSearch = {
	/** Prefill the tag, e.g. from the tags page "Create release" action. */
	tag?: string;
};

export const Route = createFileRoute("/_protected/$owner/$repo/releases/new")({
	ssr: false,
	validateSearch: (search: Record<string, unknown>): NewReleaseSearch => ({
		tag:
			typeof search.tag === "string" && search.tag.trim()
				? search.tag.trim()
				: undefined,
	}),
	loader: ({ context, params }) => {
		const scope = { userId: context.user.id };
		const input = { owner: params.owner, repo: params.repo };
		void context.queryClient.prefetchQuery(
			githubRepoOverviewQueryOptions(scope, input),
		);
		void context.queryClient.prefetchQuery(
			githubRepoViewerPermissionQueryOptions(scope, input),
		);
		void context.queryClient.prefetchQuery(
			githubRepoRefNamesQueryOptions(scope, { ...input, kind: "tags" }),
		);
	},
	head: ({ match, params }) =>
		buildSeo({
			path: match.pathname,
			title: formatPageTitle(`New release · ${params.owner}/${params.repo}`),
			description: `Draft a new release for ${params.owner}/${params.repo}.`,
			robots: "noindex",
		}),
	pendingComponent: DashboardContentLoading,
	component: NewReleaseRoute,
});

function NewReleaseRoute() {
	const { user } = Route.useRouteContext();
	const { owner, repo } = Route.useParams();
	const { tag } = Route.useSearch();
	const scope = useMemo(() => ({ userId: user.id }), [user.id]);
	return (
		<ReleaseFormPage owner={owner} repo={repo} scope={scope} initialTag={tag} />
	);
}
