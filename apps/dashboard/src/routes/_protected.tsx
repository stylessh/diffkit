import { createFileRoute, redirect } from "@tanstack/react-router";
import { DashboardLayout } from "#/components/layouts/dashboard-layout";
import { ErrorScreen } from "#/components/layouts/error-screen";
import { getSession } from "#/lib/auth.functions";
import { checkSetupComplete } from "#/lib/github.functions";
import { buildSeo, formatPageTitle, PRIVATE_ROUTE_HEADERS } from "#/lib/seo";

export const Route = createFileRoute("/_protected")({
	beforeLoad: async ({ location }) => {
		const session = await getSession();
		if (!session) {
			throw redirect({
				to: "/login",
				search: { redirect: location.href },
			});
		}

		const setupComplete = await checkSetupComplete();
		if (!setupComplete) {
			throw redirect({ to: "/setup" });
		}

		return { user: session.user, session: session.session };
	},
	headers: () => PRIVATE_ROUTE_HEADERS,
	head: ({ match }) => {
		return buildSeo({
			path: match.pathname,
			title: formatPageTitle("Dashboard"),
			description:
				"Private GitHub workspace for tracking pull requests, issues, and review requests.",
			robots: "noindex",
		});
	},
	component: DashboardLayout,
	errorComponent: ErrorScreen,
});
