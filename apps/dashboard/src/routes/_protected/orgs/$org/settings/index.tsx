import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { OrgGeneralSettings } from "#/components/org/settings/org-general-settings";
import { githubOrgSettingsQueryOptions } from "#/lib/github.query";

export const Route = createFileRoute("/_protected/orgs/$org/settings/")({
	loader: ({ context, params }) => {
		const scope = { userId: context.user.id };
		void context.queryClient.prefetchQuery(
			githubOrgSettingsQueryOptions(scope, { org: params.org }),
		);
	},
	component: OrgGeneralRoute,
});

function OrgGeneralRoute() {
	const { user } = Route.useRouteContext();
	const { org } = Route.useParams();
	const scope = useMemo(() => ({ userId: user.id }), [user.id]);
	return <OrgGeneralSettings org={org} scope={scope} />;
}
