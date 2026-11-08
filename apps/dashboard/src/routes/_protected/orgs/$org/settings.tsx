import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useMemo } from "react";
import { DashboardContentLoading } from "#/components/layouts/dashboard-content-loading";
import { OrgSettingsFrame } from "#/components/org/settings/org-settings-frame";
import { githubOrgViewerRoleQueryOptions } from "#/lib/github.query";
import { buildSeo, formatPageTitle } from "#/lib/seo";

export const Route = createFileRoute("/_protected/orgs/$org/settings")({
	ssr: false,
	loader: ({ context, params }) => {
		const scope = { userId: context.user.id };
		void context.queryClient.prefetchQuery(
			githubOrgViewerRoleQueryOptions(scope, { org: params.org }),
		);
	},
	head: ({ match, params }) =>
		buildSeo({
			path: match.pathname,
			title: formatPageTitle(`Settings · ${params.org}`),
			description: `Settings for the ${params.org} organization.`,
			robots: "noindex",
		}),
	pendingComponent: DashboardContentLoading,
	component: OrgSettingsLayout,
});

function OrgSettingsLayout() {
	const { user } = Route.useRouteContext();
	const { org } = Route.useParams();
	const scope = useMemo(() => ({ userId: user.id }), [user.id]);
	return (
		<OrgSettingsFrame org={org} scope={scope}>
			<Outlet />
		</OrgSettingsFrame>
	);
}
