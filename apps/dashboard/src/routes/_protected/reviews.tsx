import { ReviewsIcon } from "@diffkit/icons";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef } from "react";
import {
	applyListView,
	ListToolbar,
	pullFilterDefs,
	pullSortOptions,
	useListFilters,
} from "#/components/filters";
import { DashboardContentLoading } from "#/components/layouts/dashboard-content-loading";
import { PullRequestRow } from "#/components/pulls/pull-request-row";
import { ListEmpty, ListGroup, ListPage } from "#/components/shared/list-page";
import { githubMyPullsQueryOptions } from "#/lib/github.query";
import { buildSeo, formatPageTitle } from "#/lib/seo";
import { useHasMounted } from "#/lib/use-has-mounted";

export const Route = createFileRoute("/_protected/reviews")({
	ssr: false,
	loader: ({ context }) => {
		const scope = { userId: context.user.id };
		void context.queryClient.prefetchQuery(githubMyPullsQueryOptions(scope));
	},
	pendingComponent: DashboardContentLoading,
	head: ({ match }) =>
		buildSeo({
			path: match.pathname,
			title: formatPageTitle("GitHub code reviews"),
			description:
				"Private review queue for pull requests requesting your feedback, with fast access to diffs and discussion.",
			robots: "noindex",
		}),
	component: ReviewsPage,
});

function ReviewsPage() {
	const { user } = Route.useRouteContext();
	const scope = useMemo(() => ({ userId: user.id }), [user.id]);
	const hasMounted = useHasMounted();
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const query = useQuery({
		...githubMyPullsQueryOptions(scope),
		enabled: hasMounted,
	});

	const rawReviews = useMemo(
		() => query.data?.reviewRequested ?? [],
		[query.data],
	);

	const filterState = useListFilters({
		listId: "reviews",
		filterDefs: pullFilterDefs,
		sortOptions: pullSortOptions,
		defaultSortId: "updated",
	});

	if (query.error) throw query.error;
	if (query.data) {
		const reviews = applyListView(rawReviews, filterState);

		return (
			<ListPage
				title="Reviews"
				count={reviews.length}
				scrollRef={scrollContainerRef}
				searchQuery={filterState.searchQuery}
				toolbar={
					<ListToolbar
						state={filterState}
						items={rawReviews}
						searchPlaceholder="Search reviews…"
					/>
				}
			>
				{reviews.length === 0 ? (
					<ListEmpty>
						{filterState.activeFilters.length > 0 || filterState.searchQuery
							? "No reviews match your filters."
							: "No review requests right now — you're all caught up."}
					</ListEmpty>
				) : (
					<ListGroup
						icon={ReviewsIcon}
						title="Review requested"
						count={reviews.length}
					>
						{reviews.map((pr) => (
							<PullRequestRow key={pr.id} pr={pr} scope={scope} />
						))}
					</ListGroup>
				)}
			</ListPage>
		);
	}
	return <DashboardContentLoading />;
}
