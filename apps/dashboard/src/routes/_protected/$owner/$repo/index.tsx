import type { QueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { RepoOverviewPage } from "#/components/repo/repo-overview-page";
import type { GitHubQueryScope } from "#/lib/github.query";
import {
	githubRepoFileContentQueryOptions,
	githubRepoOverviewQueryOptions,
	githubRepoTreeQueryOptions,
	githubViewerQueryOptions,
} from "#/lib/github.query";
import type { RepoTreeEntry } from "#/lib/github.types";
import { buildSeo, formatPageTitle } from "#/lib/seo";

const KNOWN_MD_FILES = new Set([
	"README.md",
	"readme.md",
	"README",
	"CODE_OF_CONDUCT.md",
	"CONTRIBUTING.md",
	"LICENSE",
	"LICENSE.md",
	"LICENSE.txt",
	"SECURITY.md",
	"CHANGELOG.md",
]);

function prefetchMdFiles(
	queryClient: QueryClient,
	scope: GitHubQueryScope,
	params: { owner: string; repo: string },
	ref: string,
	entries: RepoTreeEntry[],
) {
	for (const entry of entries) {
		if (KNOWN_MD_FILES.has(entry.name)) {
			void queryClient.prefetchQuery(
				githubRepoFileContentQueryOptions(scope, {
					owner: params.owner,
					repo: params.repo,
					ref,
					path: entry.name,
				}),
			);
		}
	}
}

export const Route = createFileRoute("/_protected/$owner/$repo/")({
	ssr: false,
	loader: ({ context, params }) => {
		const scope = { userId: context.user.id };
		const overviewOptions = githubRepoOverviewQueryOptions(scope, {
			owner: params.owner,
			repo: params.repo,
		});

		// Clean up broken cache entries
		const cachedData = context.queryClient.getQueryData(
			overviewOptions.queryKey,
		);
		if (cachedData !== undefined && !cachedData) {
			context.queryClient.removeQueries({
				queryKey: overviewOptions.queryKey,
				exact: true,
			});
		}

		// Never block navigation — fire prefetches and let the component
		// show cached data instantly or a skeleton while loading.
		void context.queryClient.prefetchQuery(overviewOptions);
		void context.queryClient.prefetchQuery(githubViewerQueryOptions(scope));

		// If overview is cached, prefetch tree + MD files immediately
		const cachedOverview = context.queryClient.getQueryData(
			overviewOptions.queryKey,
		);
		if (cachedOverview) {
			const ref = cachedOverview.defaultBranch ?? "main";
			const treeOptions = githubRepoTreeQueryOptions(scope, {
				owner: params.owner,
				repo: params.repo,
				ref,
				path: "",
			});

			void context.queryClient.prefetchQuery(treeOptions);

			// If tree is also cached, prefetch MD file contents
			const cachedTree = context.queryClient.getQueryData(treeOptions.queryKey);
			if (cachedTree) {
				prefetchMdFiles(context.queryClient, scope, params, ref, cachedTree);
			}
		}
	},
	head: ({ match, params }) =>
		buildSeo({
			path: match.pathname,
			title: formatPageTitle(`${params.owner}/${params.repo}`),
			description: `Repository overview for ${params.owner}/${params.repo}.`,
			robots: "noindex",
		}),
	component: RepoOverviewPage,
});
