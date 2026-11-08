import { createFileRoute } from "@tanstack/react-router";
import { ReviewDraftsPage } from "#/components/drafts/review-drafts-page";
import { DashboardContentLoading } from "#/components/layouts/dashboard-content-loading";
import { githubReviewDraftsQueryOptions } from "#/lib/github.query";
import { buildSeo, formatPageTitle } from "#/lib/seo";

export const Route = createFileRoute("/_protected/drafts")({
	ssr: false,
	loader: ({ context }) => {
		const scope = { userId: context.user.id };
		void context.queryClient.prefetchQuery(
			githubReviewDraftsQueryOptions(scope),
		);
	},
	pendingComponent: DashboardContentLoading,
	head: ({ match }) =>
		buildSeo({
			path: match.pathname,
			title: formatPageTitle("Review drafts"),
			description:
				"Private list of your pending, unsubmitted pull request review comments across repositories.",
			robots: "noindex",
		}),
	component: DraftsRoute,
});

function DraftsRoute() {
	const { user } = Route.useRouteContext();
	return <ReviewDraftsPage userId={user.id} />;
}
