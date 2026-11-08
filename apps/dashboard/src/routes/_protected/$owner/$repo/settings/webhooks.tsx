import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { RepoSettingsGate } from "#/components/repo/settings/repo-settings-frame";
import { WebhooksSettings } from "#/components/repo/settings/webhooks-settings";
import { githubRepoWebhooksQueryOptions } from "#/lib/github.query";

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
	const { user } = Route.useRouteContext();
	const { owner, repo } = Route.useParams();
	const scope = useMemo(() => ({ userId: user.id }), [user.id]);
	return (
		<RepoSettingsGate owner={owner} repo={repo} scope={scope} need="administer">
			<WebhooksSettings owner={owner} repo={repo} scope={scope} />
		</RepoSettingsGate>
	);
}
