import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { GeneralSettings } from "#/components/repo/settings/general-settings";
import { RepoSettingsGate } from "#/components/repo/settings/repo-settings-frame";
import {
	githubRepoGeneralSettingsQueryOptions,
	githubRepoRefNamesQueryOptions,
} from "#/lib/github.query";

export const Route = createFileRoute("/_protected/$owner/$repo/settings/")({
	loader: ({ context, params }) => {
		const scope = { userId: context.user.id };
		const input = { owner: params.owner, repo: params.repo };
		void context.queryClient.prefetchQuery(
			githubRepoGeneralSettingsQueryOptions(scope, input),
		);
		void context.queryClient.prefetchQuery(
			githubRepoRefNamesQueryOptions(scope, { ...input, kind: "branches" }),
		);
	},
	component: GeneralRoute,
});

function GeneralRoute() {
	const { user } = Route.useRouteContext();
	const { owner, repo } = Route.useParams();
	const scope = useMemo(() => ({ userId: user.id }), [user.id]);
	return (
		<RepoSettingsGate owner={owner} repo={repo} scope={scope} need="administer">
			<GeneralSettings owner={owner} repo={repo} scope={scope} />
		</RepoSettingsGate>
	);
}
