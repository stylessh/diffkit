import {
	CommentIcon,
	GitBranchIcon,
	GitPullRequestIcon,
	InboxIcon,
	ReviewsIcon,
} from "@diffkit/icons";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { type ComponentType, useMemo, useRef } from "react";
import {
	applyListView,
	ListToolbar,
	pullFilterDefs,
	pullSortOptions,
	useListFilters,
} from "#/components/filters";
import { DashboardContentLoading } from "#/components/layouts/dashboard-content-loading";
import { PullRequestRow } from "#/components/pulls/pull-request-row";
import { ListGroup, ListPage } from "#/components/shared/list-page";
import { githubMyPullsQueryOptions } from "#/lib/github.query";
import type { PullSummary } from "#/lib/github.types";
import { buildSeo, formatPageTitle } from "#/lib/seo";
import { useHasMounted } from "#/lib/use-has-mounted";

export const Route = createFileRoute("/_protected/pulls")({
	ssr: false,
	loader: ({ context }) => {
		const scope = { userId: context.user.id };
		void context.queryClient.prefetchQuery(githubMyPullsQueryOptions(scope));
	},
	pendingComponent: DashboardContentLoading,
	head: ({ match }) =>
		buildSeo({
			path: match.pathname,
			title: formatPageTitle("GitHub pull requests"),
			description:
				"Private pull request dashboard for review requests, assigned work, authored PRs, mentions, and active branches.",
			robots: "noindex",
		}),
	component: PullRequestsPage,
});

function PullRequestsPage() {
	const { user } = Route.useRouteContext();
	const scope = useMemo(() => ({ userId: user.id }), [user.id]);
	const hasMounted = useHasMounted();
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const query = useQuery({
		...githubMyPullsQueryOptions(scope),
		enabled: hasMounted,
	});

	const allPulls = useMemo(() => {
		if (!query.data) return [];
		const d = query.data;
		return [
			...d.reviewRequested,
			...d.assigned,
			...d.authored,
			...d.mentioned,
			...d.involved,
		];
	}, [query.data]);

	const filterState = useListFilters({
		listId: "pulls",
		filterDefs: pullFilterDefs,
		sortOptions: pullSortOptions,
		defaultSortId: "updated",
	});

	if (query.error) throw query.error;
	if (query.data) {
		const data = query.data;
		const groups: PullGroupData[] = [
			{
				id: "review-requested",
				title: "Review requested",
				icon: ReviewsIcon,
				pulls: applyListView(data.reviewRequested, filterState),
			},
			{
				id: "assigned",
				title: "Assigned",
				icon: InboxIcon,
				pulls: applyListView(data.assigned, filterState),
			},
			{
				id: "authored",
				title: "Authored",
				icon: GitPullRequestIcon,
				pulls: applyListView(data.authored, filterState),
			},
			{
				id: "mentioned",
				title: "Mentioned",
				icon: CommentIcon,
				pulls: applyListView(data.mentioned, filterState),
			},
			{
				id: "involved",
				title: "Involved",
				icon: GitBranchIcon,
				pulls: applyListView(data.involved, filterState),
			},
		];
		const totalPulls = groups.reduce(
			(sum, group) => sum + group.pulls.length,
			0,
		);

		return (
			<ListPage
				title="Pull Requests"
				count={totalPulls}
				scrollRef={scrollContainerRef}
				searchQuery={filterState.searchQuery}
				toolbar={
					<ListToolbar
						state={filterState}
						items={allPulls}
						searchPlaceholder="Search pull requests…"
					/>
				}
			>
				{groups.map((group) => (
					<ListGroup
						key={group.id}
						id={group.id}
						icon={group.icon}
						title={group.title}
						count={group.pulls.length}
					>
						{group.pulls.map((pull) => (
							<PullRequestRow key={pull.id} pr={pull} scope={scope} />
						))}
					</ListGroup>
				))}
			</ListPage>
		);
	}
	return <DashboardContentLoading />;
}

type PullGroupData = {
	id: string;
	title: string;
	icon: ComponentType<{ size?: number; strokeWidth?: number }>;
	pulls: PullSummary[];
};
