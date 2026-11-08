import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { BranchRulesSettings } from "#/components/repo/settings/branch-rules-settings";
import { RepoSettingsGate } from "#/components/repo/settings/repo-settings-frame";
import {
	githubRepoBranchProtectionsQueryOptions,
	githubRepoRulesetsQueryOptions,
} from "#/lib/github.query";

export const Route = createFileRoute(
	"/_protected/$owner/$repo/settings/branches",
)({
	loader: ({ context, params }) => {
		const scope = { userId: context.user.id };
		const input = { owner: params.owner, repo: params.repo };
		void context.queryClient.prefetchQuery(
			githubRepoRulesetsQueryOptions(scope, input),
		);
		void context.queryClient.prefetchQuery(
			githubRepoBranchProtectionsQueryOptions(scope, input),
		);
	},
	component: BranchRulesRoute,
});

function BranchRulesRoute() {
	const { user } = Route.useRouteContext();
	const { owner, repo } = Route.useParams();
	const scope = useMemo(() => ({ userId: user.id }), [user.id]);
	return (
		<RepoSettingsGate owner={owner} repo={repo} scope={scope} need="administer">
			<BranchRulesSettings owner={owner} repo={repo} scope={scope} />
		</RepoSettingsGate>
	);
}
