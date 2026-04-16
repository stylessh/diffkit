import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { RepoExplorerLayout } from "#/components/repo/repo-explorer-layout";
import {
	githubRepoBranchesQueryOptions,
	githubRepoOverviewQueryOptions,
	githubRepoTreeQueryOptions,
} from "#/lib/github.query";
import { parseRepoRef } from "#/lib/parse-repo-ref";
import { buildSeo, formatPageTitle } from "#/lib/seo";

export const Route = createFileRoute("/_protected/$owner/$repo/tree/$")({
	ssr: false,
	loader: ({ context, params }) => {
		const scope = { userId: context.user.id };
		const splat = params._splat ?? "";

		const overviewOptions = githubRepoOverviewQueryOptions(scope, {
			owner: params.owner,
			repo: params.repo,
		});

		// Prefetch overview and branches in parallel
		void context.queryClient.prefetchQuery(overviewOptions);
		void context.queryClient.prefetchQuery(
			githubRepoBranchesQueryOptions(scope, {
				owner: params.owner,
				repo: params.repo,
			}),
		);

		// Parse ref from splat using cached data if available
		const cachedOverview = context.queryClient.getQueryData(
			overviewOptions.queryKey,
		);
		const cachedBranches = context.queryClient.getQueryData(
			githubRepoBranchesQueryOptions(scope, {
				owner: params.owner,
				repo: params.repo,
			}).queryKey,
		);

		const { ref, path } = parseRepoRef(splat, {
			branches: cachedBranches ?? undefined,
			defaultBranch: cachedOverview?.defaultBranch,
		});

		// Prefetch the tree for this path
		void context.queryClient.prefetchQuery(
			githubRepoTreeQueryOptions(scope, {
				owner: params.owner,
				repo: params.repo,
				ref,
				path,
			}),
		);

		// Also prefetch root tree for the sidebar
		if (path !== "") {
			void context.queryClient.prefetchQuery(
				githubRepoTreeQueryOptions(scope, {
					owner: params.owner,
					repo: params.repo,
					ref,
					path: "",
				}),
			);
		}

		return { ref, path };
	},
	head: ({ match, params }) =>
		buildSeo({
			path: match.pathname,
			title: formatPageTitle(
				match.loaderData?.path
					? `${match.loaderData.path} - ${params.owner}/${params.repo}`
					: `${params.owner}/${params.repo}`,
			),
			description: `Browse files in ${params.owner}/${params.repo}.`,
			robots: "noindex",
		}),
	component: TreePage,
});

function TreePage() {
	const { user } = Route.useRouteContext();
	const { owner, repo } = Route.useParams();
	const { ref, path } = Route.useLoaderData();
	const scope = useMemo(() => ({ userId: user.id }), [user.id]);

	return (
		<RepoExplorerLayout
			owner={owner}
			repo={repo}
			scope={scope}
			currentRef={ref}
			currentPath={path}
			viewMode="tree"
		/>
	);
}
