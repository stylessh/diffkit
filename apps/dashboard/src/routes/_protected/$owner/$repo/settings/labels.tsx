import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { LabelsSettings } from "#/components/repo/settings/labels-settings";
import { RepoSettingsGate } from "#/components/repo/settings/repo-settings-frame";
import { githubRepoLabelsQueryOptions } from "#/lib/github.query";

export const Route = createFileRoute(
	"/_protected/$owner/$repo/settings/labels",
)({
	loader: ({ context, params }) => {
		const scope = { userId: context.user.id };
		void context.queryClient.prefetchQuery(
			githubRepoLabelsQueryOptions(scope, {
				owner: params.owner,
				repo: params.repo,
			}),
		);
	},
	component: LabelsRoute,
});

function LabelsRoute() {
	const { user } = Route.useRouteContext();
	const { owner, repo } = Route.useParams();
	const scope = useMemo(() => ({ userId: user.id }), [user.id]);
	return (
		<RepoSettingsGate
			owner={owner}
			repo={repo}
			scope={scope}
			need="manageLabels"
		>
			<LabelsSettings owner={owner} repo={repo} scope={scope} />
		</RepoSettingsGate>
	);
}
