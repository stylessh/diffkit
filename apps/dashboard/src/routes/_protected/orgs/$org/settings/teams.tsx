import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { OrgTeamsSettings } from "#/components/org/settings/org-teams-settings";
import { githubOrgTeamListQueryOptions } from "#/lib/github.query";

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
	const { user } = Route.useRouteContext();
	const { org } = Route.useParams();
	const scope = useMemo(() => ({ userId: user.id }), [user.id]);
	return <OrgTeamsSettings org={org} scope={scope} />;
}
