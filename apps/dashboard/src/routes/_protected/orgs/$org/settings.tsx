import { createFileRoute, Outlet } from "@tanstack/react-router";
import { OrgSettingsFrame } from "#/components/org/settings/org-settings-frame";
import { githubOrgViewerRoleQueryOptions } from "#/lib/github.query";
import { useGitHubQueryScope } from "#/lib/use-github-query-scope";
import { privatePageSeo } from "#/routes/-private-page-seo";

export const Route = createFileRoute("/_protected/orgs/$org/settings")({
	ssr: false,
	loader: ({ context, params }) => {
		const scope = { userId: context.user.id };
		void context.queryClient.prefetchQuery(
			githubOrgViewerRoleQueryOptions(scope, { org: params.org }),
		);
	},
	head: ({ match, params }) =>
		privatePageSeo(match, {
			title: `Settings · ${params.org}`,
			description: `Settings for the ${params.org} organization.`,
		}),
	component: OrgSettingsLayout,
});

function OrgSettingsLayout() {
	const { org } = Route.useParams();
	const scope = useGitHubQueryScope();
	return (
		<OrgSettingsFrame org={org} scope={scope}>
			<Outlet />
		</OrgSettingsFrame>
	);
}
