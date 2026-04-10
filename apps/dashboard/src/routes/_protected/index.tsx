import { GitPullRequestIcon, IssuesIcon, ReviewsIcon } from "@diffkit/icons";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { ComponentType } from "react";
import { DashboardContentLoading } from "#/components/layouts/dashboard-content-loading";
import { PullRequestRow } from "#/components/pulls/pull-request-row";
import {
	githubMyIssuesQueryOptions,
	githubMyPullsQueryOptions,
} from "#/lib/github.query";
import { buildSeo, formatPageTitle } from "#/lib/seo";
import { useHasMounted } from "#/lib/use-has-mounted";

export const Route = createFileRoute("/_protected/")({
	loader: async ({ context }) => {
		const scope = { userId: context.user.id };
		await Promise.all([
			context.queryClient.ensureQueryData(githubMyPullsQueryOptions(scope)),
			context.queryClient.ensureQueryData(githubMyIssuesQueryOptions(scope)),
		]);
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
	const scope = { userId: user.id };
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

		const recentPulls = pulls.authored.slice(0, 10);

		return (
			<div className="overflow-stable h-full px-6 py-16">
				<div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
					<section className="flex flex-col gap-3">
						<h1 className="text-2xl font-semibold tracking-tight">
							Welcome back,{" "}
							{user.name?.split(" ")[0] ?? user.email.split("@")[0]}
						</h1>
						<div className="grid grid-cols-3 gap-2">
							{metrics.map((m) => (
								<MetricCard key={m.label} {...m} />
							))}
						</div>
					</section>

					<section className="flex flex-col gap-2">
						<h2 className="text-sm font-medium text-muted-foreground">
							Recent Pull Requests
						</h2>
						{recentPulls.length === 0 ? (
							<p className="py-4 text-center text-sm text-muted-foreground">
								No pull requests yet.
							</p>
						) : (
							<div className="-mx-3 flex flex-col gap-1">
								{recentPulls.map((pr) => (
									<PullRequestRow key={pr.id} pr={pr} scope={scope} />
								))}
							</div>
						)}
					</section>
				</div>
			</div>
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
		<div className="flex items-center gap-3 rounded-xl bg-surface-1 px-3.5 py-3 transition-colors hover:bg-surface-2">
			<div className="flex shrink-0 items-center justify-center text-muted-foreground">
				<Icon size={20} strokeWidth={1.75} />
			</div>
			<div className="min-w-0">
				<p className="font-semibold tabular-nums leading-tight">{value}</p>
				<p className="truncate text-xs text-muted-foreground">{label}</p>
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
