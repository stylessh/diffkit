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

export const Route = createFileRoute("/_protected/pulls")({
	ssr: false,
	loader: ({ context }) => {
		const scope = { userId: context.user.id };
		void context.queryClient.prefetchQuery(githubMyPullsQueryOptions(scope));
	},
	head: ({ match }) =>
		privatePageSeo(match, {
			title: "GitHub pull requests",
			description:
				"Private pull request dashboard for review requests, assigned work, authored PRs, mentions, and active branches.",
		}),
	component: PullRequestsPage,
});

type PullGroup = {
	id: string;
	source:
		| "reviewRequested"
		| "assigned"
		| "authored"
		| "mentioned"
		| "involved";
	title: string;
	icon: ComponentType<{ size?: number; strokeWidth?: number }>;
};

const REVIEW_REQUESTED: PullGroup = {
	id: "review-requested",
	source: "reviewRequested",
	title: "Review requested",
	icon: ReviewsIcon,
};

const PULL_GROUPS: PullGroup[] = [
	REVIEW_REQUESTED,
	{ id: "assigned", source: "assigned", title: "Assigned", icon: InboxIcon },
	{
		id: "authored",
		source: "authored",
		title: "Authored",
		icon: GitPullRequestIcon,
	},
	{
		id: "mentioned",
		source: "mentioned",
		title: "Mentioned",
		icon: CommentIcon,
	},
	{
		id: "involved",
		source: "involved",
		title: "Involved",
		icon: GitBranchIcon,
	},
];

function PullRequestsPage() {
	const scope = useGitHubQueryScope();
	const hasMounted = useHasMounted();
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const query = useQuery({
		...githubMyPullsQueryOptions(scope),
		enabled: hasMounted,
	});
	const data = query.data;

	const allPulls = useMemo(
		() => (data ? PULL_GROUPS.flatMap((group) => data[group.source]) : []),
		[data],
	);

	const filterState = useListFilters({
		listId: "pulls",
		filterDefs: pullFilterDefs,
		sortOptions: pullSortOptions,
		defaultSortId: "updated",
	});

	if (query.error) throw query.error;

	const groups = data
		? PULL_GROUPS.map((group) => ({
				...group,
				pulls: applyListView(data[group.source], filterState),
			}))
		: [];
	const visiblePulls = groups.flatMap((group) => group.pulls);

	return (
		<ListPage
			title="Pull Requests"
			count={data ? visiblePulls.length : undefined}
			scrollRef={scrollContainerRef}
			filters={{
				state: filterState,
				items: allPulls,
				searchPlaceholder: "Search pull requests…",
			}}
		>
			<Skeleton loading={!data} label="Loading pull requests">
				{data ? (
					<>
						{visiblePulls.length === 0 ? (
							<ListEmpty>
								{filterState.activeFilters.length > 0 || filterState.searchQuery
									? "No pull requests match your filters."
									: "No pull requests right now."}
							</ListEmpty>
						) : null}
						<PullBulkSelection pulls={visiblePulls} scope={scope}>
							{groups.map((group) => (
								<ListGroup
									key={group.id}
									id={group.id}
									icon={group.icon}
									title={group.title}
									count={group.pulls.length}
								>
									<PullRows pulls={group.pulls} />
								</ListGroup>
							))}
						</PullBulkSelection>
					</>
				) : (
					<SkeletonSample>
						<ListGroup
							icon={REVIEW_REQUESTED.icon}
							title={REVIEW_REQUESTED.title}
							count={SAMPLE_PULLS.length}
						>
							<PullRows pulls={SAMPLE_PULLS} />
						</ListGroup>
					</SkeletonSample>
				)}
			</Skeleton>
		</ListPage>
	);
}

function PullRows({ pulls }: { pulls: PullSummary[] }) {
	return pulls.map((pull) => <PullRequestRow key={pull.id} pr={pull} />);
}
