import { createFileRoute } from "@tanstack/react-router";
import { OrgMembersSettings } from "#/components/org/settings/org-members-settings";
import { githubOrgMembersQueryOptions } from "#/lib/github.query";
import { useGitHubQueryScope } from "#/lib/use-github-query-scope";

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
	const { org } = Route.useParams();
	const scope = useGitHubQueryScope();
	return <OrgMembersSettings org={org} scope={scope} />;
}
