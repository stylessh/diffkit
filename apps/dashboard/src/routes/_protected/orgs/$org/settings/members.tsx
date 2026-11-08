import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { OrgMembersSettings } from "#/components/org/settings/org-members-settings";
import { githubOrgMembersQueryOptions } from "#/lib/github.query";

export const Route = createFileRoute("/_protected/orgs/$org/settings/members")({
	loader: ({ context, params }) => {
		const scope = { userId: context.user.id };
		void context.queryClient.prefetchQuery(
			githubOrgMembersQueryOptions(scope, { org: params.org }),
		);
	},
	component: OrgMembersRoute,
});

function OrgMembersRoute() {
	const { user } = Route.useRouteContext();
	const { org } = Route.useParams();
	const scope = useMemo(() => ({ userId: user.id }), [user.id]);
	return <OrgMembersSettings org={org} scope={scope} />;
}
