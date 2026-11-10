import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Skeleton } from "skullet/react";
import { SAMPLE_ISSUES } from "#/components/issues/issue-list-samples";
import { OverviewContent } from "#/components/overview/overview-content";
import { SAMPLE_PULLS } from "#/components/pulls/pull-list-samples";
import { SkeletonSample } from "#/components/shared/skeleton-sample";
import {
	githubMyIssuesQueryOptions,
	githubMyPullsQueryOptions,
} from "#/lib/github.query";
import type { MyIssuesResult, MyPullsResult } from "#/lib/github.types";
import { useGitHubQueryScope } from "#/lib/use-github-query-scope";
import { useHasMounted } from "#/lib/use-has-mounted";
import { privatePageSeo } from "#/routes/-private-page-seo";

export const Route = createFileRoute("/_protected/")({
	ssr: false,
	loader: ({ context }) => {
		const scope = { userId: context.user.id };
		void context.queryClient.prefetchQuery(githubMyPullsQueryOptions(scope));
		void context.queryClient.prefetchQuery(githubMyIssuesQueryOptions(scope));
	},
	head: ({ match }) =>
		privatePageSeo(match, {
			title: "Dashboard overview",
			description:
				"Private overview of your open pull requests, assigned issues, and pending review requests across GitHub.",
		}),
	component: OverviewPage,
});

const SAMPLE_MY_PULLS: MyPullsResult = {
	reviewRequested: SAMPLE_PULLS.slice(0, 2),
	assigned: [],
	authored: SAMPLE_PULLS.slice(0, 8),
	mentioned: [],
	involved: [],
};

const SAMPLE_MY_ISSUES: MyIssuesResult = {
	assigned: SAMPLE_ISSUES.slice(0, 3),
	authored: [],
	mentioned: [],
};

function OverviewPage() {
	const { user } = Route.useRouteContext();
	const scope = useGitHubQueryScope();
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

	const firstName = user.name?.split(" ")[0] ?? user.email.split("@")[0];
	const loaded =
		pullsQuery.data && issuesQuery.data
			? { pulls: pullsQuery.data, issues: issuesQuery.data }
			: null;

	return (
		<Skeleton
			loading={!loaded}
			label="Loading overview"
			className="h-full min-h-0"
		>
			{loaded ? (
				<OverviewContent
					firstName={firstName}
					pulls={loaded.pulls}
					issues={loaded.issues}
				/>
			) : (
				<SkeletonSample>
					<OverviewContent
						firstName={firstName}
						pulls={SAMPLE_MY_PULLS}
						issues={SAMPLE_MY_ISSUES}
					/>
				</SkeletonSample>
			)}
		</Skeleton>
	);
}
