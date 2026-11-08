import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { CodeSearchPage } from "#/components/repo/code/code-search-page";
import {
	githubRepoCodeSearchQueryOptions,
	githubRepoOverviewQueryOptions,
} from "#/lib/github.query";
import { buildSeo, formatPageTitle } from "#/lib/seo";

type CodeSearchParams = { q?: string; page?: number };

export const Route = createFileRoute("/_protected/$owner/$repo/search")({
	ssr: false,
	validateSearch: (raw: Record<string, unknown>): CodeSearchParams => {
		const q = typeof raw.q === "string" ? raw.q.trim() : "";
		const page = Number(raw.page);
		return {
			...(q ? { q } : {}),
			...(Number.isSafeInteger(page) && page > 1 ? { page } : {}),
		};
	},
	loaderDeps: ({ search }) => ({ q: search.q ?? "", page: search.page ?? 1 }),
	loader: ({ context, params, deps }) => {
		const scope = { userId: context.user.id };
		void context.queryClient.prefetchQuery(
			githubRepoOverviewQueryOptions(scope, params),
		);
		if (deps.q) {
			void context.queryClient.prefetchQuery(
				githubRepoCodeSearchQueryOptions(scope, {
					owner: params.owner,
					repo: params.repo,
					query: deps.q,
					page: deps.page,
				}),
			);
		}
	},
	head: ({ match, params }) =>
		buildSeo({
			path: match.pathname,
			title: formatPageTitle(`Search code · ${params.owner}/${params.repo}`),
			description: `Search code in ${params.owner}/${params.repo}.`,
			robots: "noindex",
		}),
	component: CodeSearchRoute,
});

function CodeSearchRoute() {
	const { user } = Route.useRouteContext();
	const { owner, repo } = Route.useParams();
	const { q, page } = Route.useSearch();
	const scope = useMemo(() => ({ userId: user.id }), [user.id]);
	return (
		<CodeSearchPage
			scope={scope}
			owner={owner}
			repo={repo}
			query={q ?? ""}
			page={page ?? 1}
		/>
	);
}
