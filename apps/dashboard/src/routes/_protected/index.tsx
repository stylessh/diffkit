import {
	GitPullRequestDraftIcon,
	GitPullRequestIcon,
	IssuesIcon,
	ReviewsIcon,
} from "@diffkit/icons";
import { cn } from "@diffkit/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { type ComponentType, Fragment, useMemo } from "react";
import { DashboardContentLoading } from "#/components/layouts/dashboard-content-loading";
import { PullRequestRow } from "#/components/pulls/pull-request-row";
import { ListEmpty, ListGroup } from "#/components/shared/list-page";
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

		const recentPulls = [...pulls.authored]
			.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
			.slice(0, 10);

		const firstName = user.name?.split(" ")[0] ?? user.email.split("@")[0];
		const drafts = pulls.authored.filter((pr) => pr.isDraft).length;
		const summary = [
			{
				icon: ReviewsIcon,
				color: "text-warning",
				count: pulls.reviewRequested.length,
				noun: ["pull request", "pull requests"],
				rest: "waiting on your review",
				to: "/reviews",
			},
			{
				icon: GitPullRequestIcon,
				color: "text-state-open",
				count: pulls.authored.length - drafts,
				noun: ["open pull request", "open pull requests"],
				rest: "of yours",
				to: "/pulls",
				filters: "status:open",
			},
			{
				icon: GitPullRequestDraftIcon,
				color: "text-state-draft",
				count: drafts,
				noun: ["draft", "drafts"],
				rest: "in progress",
				to: "/pulls",
				filters: "status:draft",
			},
			{
				icon: IssuesIcon,
				color: "text-state-open",
				count: issues.assigned.length,
				noun: ["issue", "issues"],
				rest: "assigned to you",
				to: "/issues",
			},
		] satisfies SummaryPart[];
		const parts = summary.filter((part) => part.count > 0);

		return (
			<div className="overflow-stable h-full min-h-0 overflow-y-auto pb-10">
				<section
					aria-labelledby="overview-welcome"
					className="mx-auto flex w-full max-w-[820px] flex-col gap-3 px-6 pt-16 pb-20 max-md:px-4 max-md:pt-10 max-md:pb-12"
				>
					<h1
						id="overview-welcome"
						className="text-2xl font-semibold tracking-tight text-balance text-text-strong"
					>
						Welcome back, {firstName}
					</h1>
					<p className="text-[15px] leading-7 text-pretty text-muted-foreground">
						{parts.length === 0 ? (
							"Nothing needs you right now."
						) : (
							<>
								You have{" "}
								{parts.map((part, index) => (
									<Fragment key={part.to + part.noun[1]}>
										{index > 0
											? index === parts.length - 1
												? ", and "
												: ", "
											: null}
										<SummaryLink {...part} /> {part.rest}
									</Fragment>
								))}
								.
							</>
						)}
					</p>
				</section>
				<div className="px-2">
					<ListGroup
						icon={GitPullRequestIcon}
						title="Recent pull requests"
						count={recentPulls.length}
					>
						{recentPulls.map((pr) => (
							<PullRequestRow key={pr.id} pr={pr} />
						))}
					</ListGroup>
					{recentPulls.length === 0 ? (
						<ListEmpty>No pull requests yet.</ListEmpty>
					) : null}
				</div>
			</div>
		);
	}

	return <DashboardContentLoading />;
}

type SummaryPart = {
	icon: ComponentType<{ size?: number; strokeWidth?: number }>;
	color: string;
	count: number;
	noun: [one: string, many: string];
	rest: string;
	to: "/reviews" | "/pulls" | "/issues";
	filters?: string;
};

function SummaryLink({
	icon: Icon,
	color,
	count,
	noun,
	to,
	filters,
}: SummaryPart) {
	return (
		<Link
			to={to}
			search={filters ? { filters } : undefined}
			aria-label={`${count} ${count === 1 ? noun[0] : noun[1]}`}
			className="-mx-0.5 inline-flex items-baseline gap-1 rounded-md px-1.5 leading-[22px] font-medium text-foreground transition-colors hover:bg-ghost-hover"
		>
			<span
				className={cn(
					"flex size-[15px] items-center justify-center self-center",
					color,
				)}
			>
				<Icon size={13} strokeWidth={2} />
			</span>
			<span className="tabular-nums">{count}</span>
			{count === 1 ? noun[0] : noun[1]}
		</Link>
	);
}
