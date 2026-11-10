import { CommentIcon, InboxIcon, IssuesIcon } from "@diffkit/icons";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { type ComponentType, useMemo, useRef } from "react";
import { Skeleton } from "skullet/react";
import {
	applyListView,
	issueFilterDefs,
	issueSortOptions,
	useListFilters,
} from "#/components/filters";
import { IssueBulkSelection } from "#/components/issues/issue-bulk-selection";
import { SAMPLE_ISSUES } from "#/components/issues/issue-list-samples";
import { IssueRow } from "#/components/issues/issue-row";
import { ListEmpty, ListGroup, ListPage } from "#/components/shared/list-page";
import { SkeletonSample } from "#/components/shared/skeleton-sample";
import { githubMyIssuesQueryOptions } from "#/lib/github.query";
import type { IssueSummary } from "#/lib/github.types";
import { useGitHubQueryScope } from "#/lib/use-github-query-scope";
import { useHasMounted } from "#/lib/use-has-mounted";
import { privatePageSeo } from "#/routes/-private-page-seo";

export const Route = createFileRoute("/_protected/issues")({
	ssr: false,
	loader: ({ context }) => {
		const scope = { userId: context.user.id };
		void context.queryClient.prefetchQuery(githubMyIssuesQueryOptions(scope));
	},
	head: ({ match }) =>
		privatePageSeo(match, {
			title: "GitHub issues",
			description:
				"Private issue dashboard for assigned, authored, and mentioned GitHub issues across your repositories.",
		}),
	component: IssuesPage,
});

type IssueGroup = {
	id: "assigned" | "authored" | "mentioned";
	title: string;
	icon: ComponentType<{ size?: number; strokeWidth?: number }>;
};

const ASSIGNED: IssueGroup = {
	id: "assigned",
	title: "Assigned",
	icon: InboxIcon,
};

const ISSUE_GROUPS: IssueGroup[] = [
	ASSIGNED,
	{ id: "authored", title: "Authored", icon: IssuesIcon },
	{ id: "mentioned", title: "Mentioned", icon: CommentIcon },
];

function IssuesPage() {
	const scope = useGitHubQueryScope();
	const hasMounted = useHasMounted();
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const query = useQuery({
		...githubMyIssuesQueryOptions(scope),
		enabled: hasMounted,
	});
	const data = query.data;

	const allIssues = useMemo(
		() => (data ? ISSUE_GROUPS.flatMap((group) => data[group.id]) : []),
		[data],
	);

	const filterState = useListFilters({
		listId: "issues",
		filterDefs: issueFilterDefs,
		sortOptions: issueSortOptions,
		defaultSortId: "updated",
	});

	if (query.error) throw query.error;

	const groups = data
		? ISSUE_GROUPS.map((group) => ({
				...group,
				issues: applyListView(data[group.id], filterState),
			}))
		: [];
	const visibleIssues = groups.flatMap((group) => group.issues);

	return (
		<ListPage
			title="Issues"
			count={data ? visibleIssues.length : undefined}
			scrollRef={scrollContainerRef}
			filters={{
				state: filterState,
				items: allIssues,
				searchPlaceholder: "Search issues…",
			}}
		>
			<Skeleton loading={!data} label="Loading issues">
				{data ? (
					<>
						{visibleIssues.length === 0 ? (
							<ListEmpty>
								{filterState.activeFilters.length > 0 || filterState.searchQuery
									? "No issues match your filters."
									: "No issues right now."}
							</ListEmpty>
						) : null}
						<IssueBulkSelection issues={visibleIssues} scope={scope}>
							{groups.map((group) => (
								<ListGroup
									key={group.id}
									id={group.id}
									icon={group.icon}
									title={group.title}
									count={group.issues.length}
								>
									<IssueRows issues={group.issues} />
								</ListGroup>
							))}
						</IssueBulkSelection>
					</>
				) : (
					<SkeletonSample>
						<ListGroup
							icon={ASSIGNED.icon}
							title={ASSIGNED.title}
							count={SAMPLE_ISSUES.length}
						>
							<IssueRows issues={SAMPLE_ISSUES} />
						</ListGroup>
					</SkeletonSample>
				)}
			</Skeleton>
		</ListPage>
	);
}

function IssueRows({ issues }: { issues: IssueSummary[] }) {
	return issues.map((issue) => <IssueRow key={issue.id} issue={issue} />);
}
