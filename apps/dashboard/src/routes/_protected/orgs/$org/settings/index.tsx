import { createFileRoute } from "@tanstack/react-router";
import { OrgGeneralSettings } from "#/components/org/settings/org-general-settings";
import { githubOrgSettingsQueryOptions } from "#/lib/github.query";
import { useGitHubQueryScope } from "#/lib/use-github-query-scope";

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
	const { org } = Route.useParams();
	const scope = useGitHubQueryScope();
	return <OrgGeneralSettings org={org} scope={scope} />;
}
