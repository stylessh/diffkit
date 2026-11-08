import { GitPullRequestIcon, IssuesIcon, ReviewsIcon } from "@diffkit/icons";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { type ComponentType, useMemo } from "react";
import { DashboardContentLoading } from "#/components/layouts/dashboard-content-loading";
import { PullRequestRow } from "#/components/pulls/pull-request-row";
import { ListEmpty, ListGroup, ListPage } from "#/components/shared/list-page";
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
		const pulls = pullsQuery.data;
		const issues = issuesQuery.data;

		const metrics: MetricCardProps[] = [
			{
				icon: GitPullRequestIcon,
				label: "Open Pull Requests",
				value: pulls.authored.length,
				to: "/pulls",
			},
			{
				icon: IssuesIcon,
				label: "Open Issues",
				value: issues.assigned.length,
				to: "/issues",
			},
			{
				icon: ReviewsIcon,
				label: "Review Requests",
				value: pulls.reviewRequested.length,
				to: "/reviews",
			},
		];

		const recentPulls = [...pulls.authored]
			.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
			.slice(0, 10);

		return (
			<ListPage
				title={`Welcome back, ${user.name?.split(" ")[0] ?? user.email.split("@")[0]}`}
				className="overflow-stable"
			>
				<div className="grid grid-cols-1 gap-2 pb-4 sm:grid-cols-3">
					{metrics.map((m) => (
						<MetricCard key={m.label} {...m} />
					))}
				</div>
				<ListGroup
					icon={GitPullRequestIcon}
					title="Recent pull requests"
					count={recentPulls.length}
				>
					{recentPulls.map((pr) => (
						<PullRequestRow key={pr.id} pr={pr} scope={scope} />
					))}
				</ListGroup>
				{recentPulls.length === 0 ? (
					<ListEmpty>No pull requests yet.</ListEmpty>
				) : null}
			</ListPage>
		);
	}

	return <DashboardContentLoading />;
}

type MetricCardProps = {
	icon: ComponentType<{ size?: number; strokeWidth?: number }>;
	label: string;
	value: number;
	to?: string;
};

function MetricCard({ icon: Icon, label, value, to }: MetricCardProps) {
	const content = (
		<div className="flex h-16 items-center gap-3 rounded-lg bg-card px-3.5 shadow-card transition-colors hover:bg-row-hover">
			<div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-group text-muted-foreground">
				<Icon size={16} strokeWidth={2} />
			</div>
			<div className="min-w-0">
				<p className="text-[15px] leading-5 font-semibold tabular-nums text-foreground">
					{value}
				</p>
				<p className="truncate text-xs font-[450] text-muted-foreground">
					{label}
				</p>
			</div>
		</div>
	);

	if (to) {
		return (
			<Link to={to} className="block">
				{content}
			</Link>
		);
	}

	return content;
}
