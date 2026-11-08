import { CommentIcon, InboxIcon, IssuesIcon } from "@diffkit/icons";
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
	issueFilterDefs,
	issueSortOptions,
	useListFilters,
} from "#/components/filters";
import { IssueRow } from "#/components/issues/issue-row";
import { DashboardContentLoading } from "#/components/layouts/dashboard-content-loading";
import {
	ListGroupNav,
	ListGroupNavItem,
	ListPageHeading,
	listPageGridClassName,
	listPageScrollClassName,
	StickyGroupHeader,
} from "#/components/shared/list-page";
import { githubMyIssuesQueryOptions } from "#/lib/github.query";
import type { IssueSummary } from "#/lib/github.types";
import { buildSeo, formatPageTitle } from "#/lib/seo";
import { useHasMounted } from "#/lib/use-has-mounted";

export const Route = createFileRoute("/_protected/issues")({
	ssr: false,
	loader: async ({ context }) => {
		const scope = { userId: context.user.id };
		void context.queryClient.prefetchQuery(githubMyIssuesQueryOptions(scope));
		const filterStore = await getFilterCookie();
		return { filterStore };
	},
	pendingComponent: DashboardContentLoading,
	head: ({ match }) =>
		buildSeo({
			path: match.pathname,
			title: formatPageTitle("GitHub issues"),
			description:
				"Private issue dashboard for assigned, authored, and mentioned GitHub issues across your repositories.",
			robots: "noindex",
		}),
	component: IssuesPage,
});

function IssuesPage() {
	const { filterStore } = Route.useLoaderData();
	const { user } = Route.useRouteContext();
	const scope = useMemo(() => ({ userId: user.id }), [user.id]);
	const hasMounted = useHasMounted();
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const query = useQuery({
		...githubMyIssuesQueryOptions(scope),
		enabled: hasMounted,
	});

	const allIssues = useMemo(() => {
		if (!query.data) return [];
		const d = query.data;
		return [...d.assigned, ...d.authored, ...d.mentioned];
	}, [query.data]);

	const filterState = useListFilters({
		pageId: "issues",
		items: allIssues,
		filterDefs: issueFilterDefs,
		sortOptions: issueSortOptions,
		defaultSortId: "updated",
		initialStore: filterStore,
	});

	if (query.error) throw query.error;
	if (query.data) {
		const data = query.data;
		const groups: IssueGroupData[] = [
			{
				id: "assigned",
				title: "Assigned",
				icon: InboxIcon,
				issues: applyFilters(data.assigned, filterState),
			},
			{
				id: "authored",
				title: "Authored",
				icon: IssuesIcon,
				issues: applyFilters(data.authored, filterState),
			},
			{
				id: "mentioned",
				title: "Mentioned",
				icon: CommentIcon,
				issues: applyFilters(data.mentioned, filterState),
			},
		];
		const totalIssues = groups.reduce(
			(sum, group) => sum + group.issues.length,
			0,
		);

		return (
			<div ref={scrollContainerRef} className={listPageScrollClassName}>
				<div className={listPageGridClassName}>
					<aside className="flex h-fit flex-col gap-4 xl:sticky xl:top-0">
						<ListPageHeading title="Issues">
							<span className="tabular-nums">{totalIssues}</span> open issues
							across your queues
						</ListPageHeading>

						<ListGroupNav label="Issue groups">
							{groups.map((group) => (
								<ListGroupNavItem
									key={group.id}
									href={`#${group.id}`}
									icon={group.icon}
									label={group.title}
									value={group.issues.length}
								/>
							))}
						</ListGroupNav>
					</aside>

					<div className="flex flex-col gap-2">
						<FilterBar state={filterState} />
						{groups.map((group) => (
							<IssueGroup
								key={group.id}
								id={group.id}
								title={group.title}
								icon={group.icon}
								issues={group.issues}
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

type IssueGroupData = {
	id: string;
	title: string;
	icon: ComponentType<{ size?: number; strokeWidth?: number }>;
	issues: IssueSummary[];
};

const ISSUE_GROUP_STICKY_TOP = -32;

const IssueGroup = memo(function IssueGroup({
	id,
	title,
	icon,
	issues,
	scrollContainerRef,
}: {
	id: string;
	title: string;
	icon: ComponentType<{ size?: number; strokeWidth?: number }>;
	issues: IssueSummary[];
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
				stickyTop={ISSUE_GROUP_STICKY_TOP}
				icon={icon}
				title={title}
				count={issues.length}
				isEmpty={issues.length === 0}
			/>
			{issues.length > 0 && (
				<div className="mt-1 flex flex-col">
					{issues.map((issue) => (
						<IssueRow key={issue.id} issue={issue} />
					))}
				</div>
			)}
		</section>
	);
});
