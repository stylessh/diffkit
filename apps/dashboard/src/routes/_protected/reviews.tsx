import { ReviewsIcon } from "@diffkit/icons";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useRef } from "react";
import { Skeleton } from "skullet/react";
import {
	applyListView,
	pullFilterDefs,
	pullSortOptions,
	useListFilters,
} from "#/components/filters";
import { PullBulkSelection } from "#/components/pulls/pull-bulk-selection";
import { SAMPLE_PULLS } from "#/components/pulls/pull-list-samples";
import { PullRequestRow } from "#/components/pulls/pull-request-row";
import { ListEmpty, ListGroup, ListPage } from "#/components/shared/list-page";
import { SkeletonSample } from "#/components/shared/skeleton-sample";
import { githubMyPullsQueryOptions } from "#/lib/github.query";
import type { PullSummary } from "#/lib/github.types";
import { useGitHubQueryScope } from "#/lib/use-github-query-scope";
import { useHasMounted } from "#/lib/use-has-mounted";
import { privatePageSeo } from "#/routes/-private-page-seo";

export const Route = createFileRoute("/_protected/reviews")({
	ssr: false,
	loader: ({ context }) => {
		const scope = { userId: context.user.id };
		void context.queryClient.prefetchQuery(githubMyPullsQueryOptions(scope));
	},
	head: ({ match }) =>
		privatePageSeo(match, {
			title: "GitHub code reviews",
			description:
				"Private review queue for pull requests requesting your feedback, with fast access to diffs and discussion.",
		}),
	component: ReviewsPage,
});

const NO_REVIEWS: PullSummary[] = [];

function ReviewsPage() {
	const scope = useGitHubQueryScope();
	const hasMounted = useHasMounted();
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const query = useQuery({
		...githubMyPullsQueryOptions(scope),
		enabled: hasMounted,
	});
	const requested = query.data?.reviewRequested;

	const filterState = useListFilters({
		listId: "reviews",
		filterDefs: pullFilterDefs,
		sortOptions: pullSortOptions,
		defaultSortId: "updated",
	});

	if (query.error) throw query.error;

	const reviews = applyListView(requested ?? NO_REVIEWS, filterState);

	return (
		<ListPage
			title="Reviews"
			count={requested ? reviews.length : undefined}
			scrollRef={scrollContainerRef}
			filters={{
				state: filterState,
				items: requested ?? NO_REVIEWS,
				searchPlaceholder: "Search reviews…",
			}}
		>
			<Skeleton loading={!requested} label="Loading reviews">
				{!requested ? (
					<SkeletonSample>
						<ReviewGroup pulls={SAMPLE_PULLS} />
					</SkeletonSample>
				) : reviews.length === 0 ? (
					<ListEmpty>
						{filterState.activeFilters.length > 0 || filterState.searchQuery
							? "No reviews match your filters."
							: "No review requests right now — you're all caught up."}
					</ListEmpty>
				) : (
					<PullBulkSelection pulls={reviews} scope={scope}>
						<ReviewGroup pulls={reviews} />
					</PullBulkSelection>
				)}
			</Skeleton>
		</ListPage>
	);
}

function ReviewGroup({ pulls }: { pulls: PullSummary[] }) {
	return (
		<ListGroup icon={ReviewsIcon} title="Review requested" count={pulls.length}>
			{pulls.map((pull) => (
				<PullRequestRow key={pull.id} pr={pull} />
			))}
		</ListGroup>
	);
}
