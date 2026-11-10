import { createFileRoute } from "@tanstack/react-router";
import { AccessSettings } from "#/components/repo/settings/access-settings";
import { RepoSettingsGate } from "#/components/repo/settings/repo-settings-frame";
import { githubRepoAccessQueryOptions } from "#/lib/github.query";
import { useGitHubQueryScope } from "#/lib/use-github-query-scope";

export const Route = createFileRoute(
	"/_protected/$owner/$repo/settings/access",
)({
	loader: ({ context, params }) => {
		const scope = { userId: context.user.id };
		void context.queryClient.prefetchQuery(
			githubRepoAccessQueryOptions(scope, {
				owner: params.owner,
				repo: params.repo,
			}),
		);
	},
	component: AccessRoute,
});

function AccessRoute() {
	const { owner, repo } = Route.useParams();
	const scope = useGitHubQueryScope();
	return (
		<RepoSettingsGate owner={owner} repo={repo} scope={scope} need="administer">
			<AccessSettings owner={owner} repo={repo} scope={scope} />
		</RepoSettingsGate>
	);
}
