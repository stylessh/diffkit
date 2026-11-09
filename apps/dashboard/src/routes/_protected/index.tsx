import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { DashboardContentLoading } from "#/components/layouts/dashboard-content-loading";
import { OverviewContent } from "#/components/overview/overview-content";
import {
	githubMyIssuesQueryOptions,
	githubMyPullsQueryOptions,
} from "#/lib/github.query";
import { buildSeo, formatPageTitle } from "#/lib/seo";
import { useHasMounted } from "#/lib/use-has-mounted";

export const Route = createFileRoute("/_protected/")({
	ssr: false,
	loader: ({ context }) => {
		const scope = { userId: context.user.id };
		void context.queryClient.prefetchQuery(githubMyPullsQueryOptions(scope));
		void context.queryClient.prefetchQuery(githubMyIssuesQueryOptions(scope));
	},
	pendingComponent: DashboardContentLoading,
	head: ({ match }) =>
		buildSeo({
			path: match.pathname,
			title: formatPageTitle("Dashboard overview"),
			description:
				"Private overview of your open pull requests, assigned issues, and pending review requests across GitHub.",
			robots: "noindex",
		}),
	component: OverviewPage,
});

function OverviewPage() {
	const { user } = Route.useRouteContext();
	const scope = useMemo(() => ({ userId: user.id }), [user.id]);
	const hasMounted = useHasMounted();
	const pullsQuery = useQuery({
		...githubMyPullsQueryOptions(scope),
		enabled: hasMounted,
	});
	const issuesQuery = useQuery({
		...githubMyIssuesQueryOptions(scope),
		enabled: hasMounted,
	});

	if (pullsQuery.error) throw pullsQuery.error;
	if (issuesQuery.error) throw issuesQuery.error;

	if (pullsQuery.data && issuesQuery.data) {
		const firstName = user.name?.split(" ")[0] ?? user.email.split("@")[0];
		return (
			<OverviewContent
				firstName={firstName}
				pulls={pullsQuery.data}
				issues={issuesQuery.data}
			/>
		);
	}

	return <DashboardContentLoading />;
}
