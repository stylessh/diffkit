import { createFileRoute } from "@tanstack/react-router";
import { InboxPage } from "#/components/inbox/inbox-page";
import { GenericRoutePending } from "#/components/layouts/dashboard-content-loading";
import { githubNotificationsQueryOptions } from "#/lib/github.query";
import { privatePageSeo } from "#/routes/-private-page-seo";

export const Route = createFileRoute("/_protected/inbox")({
	ssr: false,
	loader: ({ context }) => {
		const scope = { userId: context.user.id };
		void context.queryClient.prefetchQuery(
			githubNotificationsQueryOptions(scope),
		);
	},
	head: ({ match }) =>
		privatePageSeo(match, {
			title: "Inbox",
			description: "GitHub notifications inbox",
		}),
	pendingComponent: GenericRoutePending,
	component: InboxPage,
});
