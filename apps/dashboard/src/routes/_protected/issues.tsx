import { CommentIcon, InboxIcon, IssuesIcon } from "@diffkit/icons";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { type ComponentType, useMemo, useRef } from "react";
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
import { ListGroup, ListPage } from "#/components/shared/list-page";
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
			<ListPage
				title="Issues"
				count={totalIssues}
				scrollRef={scrollContainerRef}
				toolbar={<FilterBar state={filterState} />}
			>
				{groups.map((group) => (
					<ListGroup
						key={group.id}
						id={group.id}
						icon={group.icon}
						title={group.title}
						count={group.issues.length}
					>
						{group.issues.map((issue) => (
							<IssueRow key={issue.id} issue={issue} />
						))}
					</ListGroup>
				))}
			</ListPage>
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
