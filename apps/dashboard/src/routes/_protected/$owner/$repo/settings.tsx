import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RepoSettingsFrame } from "#/components/repo/settings/repo-settings-frame";
import {
	githubRepoOverviewQueryOptions,
	githubRepoViewerPermissionQueryOptions,
} from "#/lib/github.query";
import { useGitHubQueryScope } from "#/lib/use-github-query-scope";
import { privatePageSeo } from "#/routes/-private-page-seo";

export const Route = createFileRoute("/_protected/$owner/$repo/settings")({
	ssr: false,
	loader: ({ context, params }) => {
		const scope = { userId: context.user.id };
		const input = { owner: params.owner, repo: params.repo };
		void context.queryClient.prefetchQuery(
			githubRepoOverviewQueryOptions(scope, input),
		);
		void context.queryClient.prefetchQuery(
			githubRepoViewerPermissionQueryOptions(scope, input),
		);
	},
	head: ({ match, params }) =>
		privatePageSeo(match, {
			title: `Settings · ${params.owner}/${params.repo}`,
			description: `Settings for ${params.owner}/${params.repo}.`,
		}),
	component: RepoSettingsLayout,
});

function RepoSettingsLayout() {
	const { owner, repo } = Route.useParams();
	const scope = useGitHubQueryScope();
	return (
		<RepoSettingsFrame owner={owner} repo={repo} scope={scope}>
			<Outlet />
		</RepoSettingsFrame>
	);
}
