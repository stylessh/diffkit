import { CommentIcon, InboxIcon, IssuesIcon } from "@diffkit/icons";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
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
import { StickyGroupHeader } from "#/components/shared/sticky-group-header";
import { useCollapsedGroups } from "#/lib/collapsible-groups-storage";
import { countUniqueById } from "#/lib/count-unique";
import {
	githubMyIssuesQueryOptions,
	githubQueryKeys,
} from "#/lib/github.query";
import type { IssueSummary } from "#/lib/github.types";
import { githubRevalidationSignalKeys } from "#/lib/github-revalidation";
import { buildSeo, formatPageTitle } from "#/lib/seo";
import { useGitHubSignalStream } from "#/lib/use-github-signal-stream";
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
	const webhookTargets = useMemo(
		() => [
			{
				queryKey: githubQueryKeys.issues.mine(scope),
				signalKeys: [githubRevalidationSignalKeys.issuesMine],
			},
		],
		[scope],
	);
	useGitHubSignalStream(webhookTargets);

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
	const { collapsedGroups, setGroupCollapsed } = useCollapsedGroups(
		ISSUES_GROUP_COLLAPSED_STORAGE_KEY,
	);

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
		const totalIssues = countUniqueById(
			groups.flatMap((group) => group.issues),
		);

		return (
			<div ref={scrollContainerRef} className="h-full overflow-auto py-10">
				<div className="mx-auto grid max-w-7xl gap-14 px-3 md:px-6 xl:grid-cols-[minmax(15rem,18rem)_minmax(0,1fr)]">
					<aside className="flex h-fit flex-col gap-5 xl:sticky xl:top-0">
						<div className="flex flex-col gap-2">
							<h1 className="text-2xl font-semibold tracking-tight">Issues</h1>
							<p className="text-sm text-muted-foreground">
								<span className="tabular-nums">{totalIssues}</span> open issues
								across your queues
							</p>
						</div>

						<nav className="flex flex-col gap-2" aria-label="Issue groups">
							{groups.map((group) => (
								<IssueMetricCard
									key={group.id}
									href={`#${group.id}`}
									icon={group.icon}
									label={group.title}
									value={group.issues.length}
								/>
							))}
						</nav>
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
								isCollapsed={collapsedGroups[group.id] ?? false}
								onCollapsedChange={(isCollapsed) =>
									setGroupCollapsed(group.id, isCollapsed)
								}
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
const ISSUES_GROUP_COLLAPSED_STORAGE_KEY = "diffkit:issues:collapsed-groups";

const IssueMetricCard = memo(function IssueMetricCard({
	href,
	icon: Icon,
	label,
	value,
}: {
	href: string;
	icon: ComponentType<{ size?: number; strokeWidth?: number }>;
	label: string;
	value: number;
}) {
	const content = (
		<>
			<div className="flex min-w-0 items-center gap-2">
				<div className="shrink-0 text-muted-foreground">
					<Icon size={15} strokeWidth={1.9} />
				</div>
				<p className="truncate text-sm font-medium">{label}</p>
			</div>
			<p className="font-semibold tabular-nums leading-tight">{value}</p>
		</>
	);

	if (value === 0) {
		return (
			<div
				aria-disabled="true"
				className="flex items-center justify-between gap-4 rounded-xl bg-surface-1 px-3.5 py-3 opacity-70"
			>
				{content}
			</div>
		);
	}

	return (
		<a
			href={href}
			className="flex items-center justify-between gap-4 rounded-xl bg-surface-1 px-3.5 py-3 transition-colors hover:bg-surface-2"
		>
			{content}
		</a>
	);
});

const IssueGroup = memo(function IssueGroup({
	id,
	title,
	icon,
	issues,
	isCollapsed,
	onCollapsedChange,
	scrollContainerRef,
}: {
	id: string;
	title: string;
	icon: ComponentType<{ size?: number; strokeWidth?: number }>;
	issues: IssueSummary[];
	isCollapsed: boolean;
	onCollapsedChange: (isCollapsed: boolean) => void;
	scrollContainerRef: RefObject<HTMLDivElement | null>;
}) {
	const sectionRef = useRef<HTMLElement>(null);
	const hasIssues = issues.length > 0;
	const isGroupCollapsed = hasIssues && isCollapsed;

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
				isEmpty={!hasIssues}
				isCollapsed={isGroupCollapsed}
				onCollapsedChange={onCollapsedChange}
			/>
			<AnimatePresence initial={false}>
				{!isGroupCollapsed && hasIssues && (
					<motion.div
						initial={{ height: 0, opacity: 0, y: -6 }}
						animate={{ height: "auto", opacity: 1, y: 0 }}
						exit={{ height: 0, opacity: 0, y: -6 }}
						transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
						className="overflow-hidden"
					>
						<div className="mt-2 flex flex-col gap-1">
							{issues.map((issue) => (
								<IssueRow key={issue.id} issue={issue} />
							))}
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</section>
	);
});
