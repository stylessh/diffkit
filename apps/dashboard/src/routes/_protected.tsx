import { createFileRoute, redirect } from "@tanstack/react-router";
import { DashboardLayout } from "#/components/layouts/dashboard-layout";
import { ErrorScreen } from "#/components/layouts/error-screen";
import { getSession } from "#/lib/auth.functions";

export const Route = createFileRoute("/_protected")({
	beforeLoad: async ({ location }) => {
		const session = await getSession();
		if (!session) {
			throw redirect({
				to: "/login",
				search: { redirect: location.href },
			});
		}
		return { user: session.user, session: session.session };
	},
	component: DashboardLayout,
	errorComponent: ErrorScreen,
});
