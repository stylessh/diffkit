import { ReviewsIcon } from "@diffkit/icons";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef } from "react";
import {
	applyFilters,
	FilterBar,
	getFilterCookie,
	pullFilterDefs,
	pullSortOptions,
	useListFilters,
} from "#/components/filters";
import { DashboardContentLoading } from "#/components/layouts/dashboard-content-loading";
import { PullRequestRow } from "#/components/pulls/pull-request-row";
import {
	ListGroupNav,
	ListGroupNavItem,
	ListPageHeading,
	listPageGridClassName,
	listPageScrollClassName,
} from "#/components/shared/list-page";
import { githubMyPullsQueryOptions } from "#/lib/github.query";
import { buildSeo, formatPageTitle } from "#/lib/seo";
import { useHasMounted } from "#/lib/use-has-mounted";

export const Route = createFileRoute("/_protected/reviews")({
	ssr: false,
	loader: async ({ context }) => {
		const scope = { userId: context.user.id };
		void context.queryClient.prefetchQuery(githubMyPullsQueryOptions(scope));
		const filterStore = await getFilterCookie();
		return { filterStore };
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
	const { filterStore } = Route.useLoaderData();
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
		pageId: "reviews",
		items: rawReviews,
		filterDefs: pullFilterDefs,
		sortOptions: pullSortOptions,
		defaultSortId: "updated",
		initialStore: filterStore,
	});

	if (query.error) throw query.error;
	if (query.data) {
		const reviews = applyFilters(rawReviews, filterState);

		return (
			<div ref={scrollContainerRef} className={listPageScrollClassName}>
				<div className={listPageGridClassName}>
					<aside className="flex h-fit flex-col gap-4 xl:sticky xl:top-0">
						<ListPageHeading title="Reviews">
							<span className="tabular-nums">{reviews.length}</span> open pulls
							requesting your review
						</ListPageHeading>

						<ListGroupNav label="Review groups">
							<ListGroupNavItem
								icon={ReviewsIcon}
								label="Review requested"
								value={reviews.length}
							/>
						</ListGroupNav>
					</aside>

					<div className="flex flex-col gap-2">
						<FilterBar state={filterState} />
						{reviews.length === 0 ? (
							<p className="px-3 py-10 text-center text-[13px] text-muted-foreground">
								{filterState.hasActiveFilters
									? "No reviews match your filters."
									: "No review requests right now — you're all caught up."}
							</p>
						) : (
							<div className="flex flex-col">
								{reviews.map((pr) => (
									<PullRequestRow key={pr.id} pr={pr} scope={scope} />
								))}
							</div>
						)}
					</div>
				</div>
			</div>
		);
	}
	return <DashboardContentLoading />;
}
