import { createFileRoute } from "@tanstack/react-router";
import { OrgTeamsSettings } from "#/components/org/settings/org-teams-settings";
import { githubOrgTeamListQueryOptions } from "#/lib/github.query";
import { useGitHubQueryScope } from "#/lib/use-github-query-scope";

export const Route = createFileRoute("/_protected/orgs/$org/settings/teams")({
	loader: ({ context, params }) => {
		const scope = { userId: context.user.id };
		void context.queryClient.prefetchQuery(
			githubOrgTeamListQueryOptions(scope, { org: params.org }),
		);
	},
	component: OrgTeamsRoute,
});

function OrgTeamsRoute() {
	const { org } = Route.useParams();
	const scope = useGitHubQueryScope();
	return <OrgTeamsSettings org={org} scope={scope} />;
}
