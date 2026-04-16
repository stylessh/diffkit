import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { RepoExplorerLayout } from "#/components/repo/repo-explorer-layout";
import {
	githubRepoBranchesQueryOptions,
	githubRepoFileContentQueryOptions,
	githubRepoOverviewQueryOptions,
	githubRepoTreeQueryOptions,
} from "#/lib/github.query";
import { parseRepoRef } from "#/lib/parse-repo-ref";
import { buildSeo, formatPageTitle } from "#/lib/seo";

export const Route = createFileRoute("/_protected/$owner/$repo/blob/$")({
	ssr: false,
	loader: ({ context, params }) => {
		const scope = { userId: context.user.id };
		const splat = params._splat ?? "";

		const overviewOptions = githubRepoOverviewQueryOptions(scope, {
			owner: params.owner,
			repo: params.repo,
		});

		void context.queryClient.prefetchQuery(overviewOptions);
		void context.queryClient.prefetchQuery(
			githubRepoBranchesQueryOptions(scope, {
				owner: params.owner,
				repo: params.repo,
			}),
		);

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

		// Prefetch file content
		if (path) {
			void context.queryClient.prefetchQuery(
				githubRepoFileContentQueryOptions(scope, {
					owner: params.owner,
					repo: params.repo,
					ref,
					path,
				}),
			);
		}

		// Prefetch root tree for the sidebar
		void context.queryClient.prefetchQuery(
			githubRepoTreeQueryOptions(scope, {
				owner: params.owner,
				repo: params.repo,
				ref,
				path: "",
			}),
		);

		return { ref, path };
	},
	head: ({ match, params }) => {
		const fileName = match.loaderData?.path?.split("/").pop();
		return buildSeo({
			path: match.pathname,
			title: formatPageTitle(
				fileName
					? `${fileName} - ${params.owner}/${params.repo}`
					: `${params.owner}/${params.repo}`,
			),
			description: `View file in ${params.owner}/${params.repo}.`,
			robots: "noindex",
		});
	},
	component: BlobPage,
});

function BlobPage() {
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
			viewMode="blob"
		/>
	);
}
