import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { RepoCommitsPage } from "#/components/repo/repo-commits-list";
import {
	githubRepoBranchesQueryOptions,
	githubRepoCommitsQueryOptions,
	githubRepoOverviewQueryOptions,
} from "#/lib/github.query";
import { parseRepoRef } from "#/lib/parse-repo-ref";
import { buildSeo, formatPageTitle } from "#/lib/seo";

export const Route = createFileRoute("/_protected/$owner/$repo/commits/$")({
	ssr: false,
	loader: async ({ context, params }) => {
		const scope = { userId: context.user.id };
		const splat = params._splat ?? "";
		const overviewOptions = githubRepoOverviewQueryOptions(scope, {
			owner: params.owner,
			repo: params.repo,
		});
		const branchesOptions = githubRepoBranchesQueryOptions(scope, {
			owner: params.owner,
			repo: params.repo,
		});

		const [overview, branches] = await Promise.all([
			context.queryClient.ensureQueryData(overviewOptions),
			context.queryClient.ensureQueryData(branchesOptions),
		]);
		const { ref, path } = parseRepoRef(splat, {
			branches: branches ?? undefined,
			defaultBranch: overview?.defaultBranch,
		});

		void context.queryClient.prefetchInfiniteQuery(
			githubRepoCommitsQueryOptions(scope, {
				owner: params.owner,
				repo: params.repo,
				ref,
				...(path ? { path } : {}),
				perPage: 30,
			}),
		);

		return { ref, path };
	},
	head: ({ match, params }) =>
		buildSeo({
			path: match.pathname,
			title: formatPageTitle(`Commits · ${params.owner}/${params.repo}`),
			description: `View commit history for ${params.owner}/${params.repo}.`,
			robots: "noindex",
		}),
	component: CommitsRoute,
});

function CommitsRoute() {
	const { user } = Route.useRouteContext();
	const { owner, repo } = Route.useParams();
	const { ref, path } = Route.useLoaderData();
	const scope = useMemo(() => ({ userId: user.id }), [user.id]);

	return (
		<RepoCommitsPage
			owner={owner}
			repo={repo}
			currentRef={ref}
			currentPath={path}
			scope={scope}
		/>
	);
}
