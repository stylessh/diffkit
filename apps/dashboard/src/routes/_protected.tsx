import { createFileRoute, redirect } from "@tanstack/react-router";
import { DashboardLayout } from "#/components/layouts/dashboard-layout";
import { ErrorScreen } from "#/components/layouts/error-screen";
import { getSession } from "#/lib/auth.functions";
import { checkSetupComplete } from "#/lib/github.functions";
import { buildSeo, formatPageTitle, PRIVATE_ROUTE_HEADERS } from "#/lib/seo";

/**
 * Cache the auth check so navigations within the dashboard are instant.
 * The cache is cleared on full page reloads. If the session expires mid-use,
 * API calls in child routes will 401 and the error boundary handles it.
 */
let cachedAuth: Awaited<ReturnType<typeof getSession>> | null = null;

export const Route = createFileRoute("/_protected")({
	beforeLoad: async ({ location }) => {
		if (cachedAuth) return cachedAuth;

		const [session, setupComplete] = await Promise.all([
			getSession(),
			checkSetupComplete(),
		]);

		if (!session) {
			throw redirect({
				to: "/login",
				search: { redirect: location.href },
			});
		}

		if (!setupComplete) {
			throw redirect({ to: "/setup" });
		}

		cachedAuth = { user: session.user, session: session.session };
		return cachedAuth;
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
