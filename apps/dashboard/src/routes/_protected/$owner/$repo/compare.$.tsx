import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { ComparePage } from "#/components/compare/compare-page";
import { parseCompareSplat, pullHeadFilter } from "#/lib/compare-ref";
import {
	githubCompareDetailQueryOptions,
	githubOpenPullForRefsQueryOptions,
	githubRepoBranchesListInfiniteQueryOptions,
	githubRepoOverviewQueryOptions,
	githubRepoViewerPermissionQueryOptions,
	githubViewerQueryOptions,
} from "#/lib/github.query";
import { buildSeo, formatPageTitle } from "#/lib/seo";

type CompareSearch = {
	expand?: 1;
};

export const Route = createFileRoute("/_protected/$owner/$repo/compare/$")({
	ssr: false,
	validateSearch: (search: Record<string, unknown>): CompareSearch => ({
		expand: search.expand === 1 || search.expand === "1" ? 1 : undefined,
	}),
	loader: ({ context, params }) => {
		const refs = parseCompareSplat(params._splat ?? "");
		const scope = { userId: context.user.id };
		const repoInput = { owner: params.owner, repo: params.repo };

		void context.queryClient.prefetchQuery(
			githubRepoOverviewQueryOptions(scope, repoInput),
		);
		void context.queryClient.prefetchQuery(githubViewerQueryOptions(scope));
		void context.queryClient.prefetchInfiniteQuery(
			githubRepoBranchesListInfiniteQueryOptions(scope, repoInput),
		);
		void context.queryClient.prefetchQuery(
			githubRepoViewerPermissionQueryOptions(scope, repoInput),
		);
		if (refs.base && refs.head) {
			void context.queryClient.prefetchQuery(
				githubCompareDetailQueryOptions(scope, {
					...repoInput,
					base: refs.base,
					head: refs.head,
				}),
			);
			void context.queryClient.prefetchQuery(
				githubOpenPullForRefsQueryOptions(scope, {
					...repoInput,
					base: refs.base,
					head: pullHeadFilter(refs.head, params.owner),
				}),
			);
		}

		return refs;
	},
	head: ({ match, params }) => {
		const { base, head } = match.loaderData ?? { base: null, head: null };
		const subject = head
			? `Compare ${base ? `${base}...` : ""}${head}`
			: "Compare changes";
		return buildSeo({
			path: match.pathname,
			title: formatPageTitle(`${subject} — ${params.owner}/${params.repo}`),
			description: `Compare changes and open a pull request in ${params.owner}/${params.repo}.`,
			robots: "noindex",
		});
	},
	component: CompareRoute,
});

function CompareRoute() {
	const { user } = Route.useRouteContext();
	const { owner, repo } = Route.useParams();
	const refs = Route.useLoaderData();
	const { expand } = Route.useSearch();
	const scope = useMemo(() => ({ userId: user.id }), [user.id]);

	return (
		<ComparePage
			owner={owner}
			repo={repo}
			refs={refs}
			scope={scope}
			showForm={expand === 1}
		/>
	);
}
