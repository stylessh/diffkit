import { createFileRoute } from "@tanstack/react-router";
import { InboxPage } from "#/components/inbox/inbox-page";
import { DashboardContentLoading } from "#/components/layouts/dashboard-content-loading";
import { githubNotificationsQueryOptions } from "#/lib/github.query";
import { buildSeo, formatPageTitle } from "#/lib/seo";

export const Route = createFileRoute("/_protected/inbox")({
	ssr: false,
	loader: async ({ context }) => {
		const scope = { userId: context.user.id };
		void context.queryClient.prefetchQuery(
			githubNotificationsQueryOptions(scope),
		);
	},
	pendingComponent: DashboardContentLoading,
	head: ({ match }) =>
		buildSeo({
			path: match.pathname,
			title: formatPageTitle("Inbox"),
			description: "GitHub notifications inbox",
			robots: "noindex",
		}),
	component: InboxPage,
});
