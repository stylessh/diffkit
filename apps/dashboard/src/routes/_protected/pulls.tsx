import {
	CommentIcon,
	GitBranchIcon,
	GitPullRequestIcon,
	InboxIcon,
	ReviewsIcon,
} from "@diffkit/icons";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	type ComponentType,
	memo,
	type RefObject,
	useMemo,
	useRef,
} from "react";
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
	StickyGroupHeader,
} from "#/components/shared/list-page";
import { githubMyPullsQueryOptions } from "#/lib/github.query";
import type { PullSummary } from "#/lib/github.types";
import { buildSeo, formatPageTitle } from "#/lib/seo";
import { useHasMounted } from "#/lib/use-has-mounted";

export const Route = createFileRoute("/_protected/pulls")({
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
			title: formatPageTitle("GitHub pull requests"),
			description:
				"Private pull request dashboard for review requests, assigned work, authored PRs, mentions, and active branches.",
			robots: "noindex",
		}),
	component: PullRequestsPage,
});

function PullRequestsPage() {
	const { filterStore } = Route.useLoaderData();
	const { user } = Route.useRouteContext();
	const scope = useMemo(() => ({ userId: user.id }), [user.id]);
	const hasMounted = useHasMounted();
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const query = useQuery({
		...githubMyPullsQueryOptions(scope),
		enabled: hasMounted,
	});

	// Flatten all pulls for filter option extraction
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
		pageId: "pulls",
		items: allPulls,
		filterDefs: pullFilterDefs,
		sortOptions: pullSortOptions,
		defaultSortId: "updated",
		initialStore: filterStore,
	});

	if (query.error) throw query.error;
	if (query.data) {
		const data = query.data;
		const groups: PullGroupData[] = [
			{
				id: "review-requested",
				title: "Review requested",
				icon: ReviewsIcon,
				pulls: applyFilters(data.reviewRequested, filterState),
			},
			{
				id: "assigned",
				title: "Assigned",
				icon: InboxIcon,
				pulls: applyFilters(data.assigned, filterState),
			},
			{
				id: "authored",
				title: "Authored",
				icon: GitPullRequestIcon,
				pulls: applyFilters(data.authored, filterState),
			},
			{
				id: "mentioned",
				title: "Mentioned",
				icon: CommentIcon,
				pulls: applyFilters(data.mentioned, filterState),
			},
			{
				id: "involved",
				title: "Involved",
				icon: GitBranchIcon,
				pulls: applyFilters(data.involved, filterState),
			},
		];
		const totalPulls = groups.reduce(
			(sum, group) => sum + group.pulls.length,
			0,
		);

		return (
			<div ref={scrollContainerRef} className={listPageScrollClassName}>
				<div className={listPageGridClassName}>
					<aside className="flex h-fit flex-col gap-4 xl:sticky xl:top-0">
						<ListPageHeading title="Pull Requests">
							<span className="tabular-nums">{totalPulls}</span> open pulls
							across your queues
						</ListPageHeading>

						<ListGroupNav label="Pull request groups">
							{groups.map((group) => (
								<ListGroupNavItem
									key={group.id}
									href={`#${group.id}`}
									icon={group.icon}
									label={group.title}
									value={group.pulls.length}
								/>
							))}
						</ListGroupNav>
					</aside>

					<div className="flex flex-col gap-2">
						<FilterBar state={filterState} />
						{groups.map((group) => (
							<PullGroup
								key={group.id}
								id={group.id}
								title={group.title}
								icon={group.icon}
								pulls={group.pulls}
								scope={scope}
								scrollContainerRef={scrollContainerRef}
							/>
						))}
					</div>
				</div>
			</div>
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

const PULL_GROUP_STICKY_TOP = -32;

const PullGroup = memo(function PullGroup({
	id,
	title,
	icon,
	pulls,
	scope,
	scrollContainerRef,
}: {
	id: string;
	title: string;
	icon: ComponentType<{ size?: number; strokeWidth?: number }>;
	pulls: PullSummary[];
	scope: { userId: string };
	scrollContainerRef: RefObject<HTMLDivElement | null>;
}) {
	const sectionRef = useRef<HTMLElement>(null);

	return (
		<section
			ref={sectionRef}
			id={id}
			style={{ contentVisibility: "auto", containIntrinsicSize: "auto 200px" }}
		>
			<StickyGroupHeader
				sectionRef={sectionRef}
				scrollContainerRef={scrollContainerRef}
				stickyTop={PULL_GROUP_STICKY_TOP}
				icon={icon}
				title={title}
				count={pulls.length}
				isEmpty={pulls.length === 0}
			/>
			{pulls.length > 0 && (
				<div className="mt-1 flex flex-col">
					{pulls.map((pull) => (
						<PullRequestRow key={pull.id} pr={pull} scope={scope} />
					))}
				</div>
			)}
		</section>
	);
});
