import { createFileRoute } from "@tanstack/react-router";
import { RepoSettingsGate } from "#/components/repo/settings/repo-settings-frame";
import { WebhooksSettings } from "#/components/repo/settings/webhooks-settings";
import { githubRepoWebhooksQueryOptions } from "#/lib/github.query";
import { useGitHubQueryScope } from "#/lib/use-github-query-scope";

export const Route = createFileRoute(
	"/_protected/$owner/$repo/settings/webhooks",
)({
	loader: ({ context, params }) => {
		const scope = { userId: context.user.id };
		void context.queryClient.prefetchQuery(
			githubRepoWebhooksQueryOptions(scope, {
				owner: params.owner,
				repo: params.repo,
			}),
		);
	},
	component: WebhooksRoute,
});

function WebhooksRoute() {
	const { owner, repo } = Route.useParams();
	const scope = useGitHubQueryScope();
	return (
		<RepoSettingsGate owner={owner} repo={repo} scope={scope} need="administer">
			<WebhooksSettings owner={owner} repo={repo} scope={scope} />
		</RepoSettingsGate>
	);
}
