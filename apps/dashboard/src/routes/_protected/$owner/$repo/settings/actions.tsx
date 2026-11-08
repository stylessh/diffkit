import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { ActionsSettings } from "#/components/repo/settings/actions-config-settings";
import { RepoSettingsGate } from "#/components/repo/settings/repo-settings-frame";
import {
	githubRepoActionsSecretsQueryOptions,
	githubRepoActionsVariablesQueryOptions,
} from "#/lib/github.query";

export const Route = createFileRoute(
	"/_protected/$owner/$repo/settings/actions",
)({
	loader: ({ context, params }) => {
		const scope = { userId: context.user.id };
		const input = { owner: params.owner, repo: params.repo };
		void context.queryClient.prefetchQuery(
			githubRepoActionsSecretsQueryOptions(scope, input),
		);
		void context.queryClient.prefetchQuery(
			githubRepoActionsVariablesQueryOptions(scope, input),
		);
	},
	component: ActionsRoute,
});

function ActionsRoute() {
	const { user } = Route.useRouteContext();
	const { owner, repo } = Route.useParams();
	const scope = useMemo(() => ({ userId: user.id }), [user.id]);
	return (
		<RepoSettingsGate owner={owner} repo={repo} scope={scope} need="administer">
			<ActionsSettings owner={owner} repo={repo} scope={scope} />
		</RepoSettingsGate>
	);
}
