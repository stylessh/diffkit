import {
	CommentIcon,
	GitBranchIcon,
	GitPullRequestIcon,
	InboxIcon,
	ReviewsIcon,
} from "@diffkit/icons";
import { cn } from "@diffkit/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	type ComponentType,
	memo,
	type RefObject,
	useEffect,
	useMemo,
	useRef,
	useState,
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
import { githubMyPullsQueryOptions, githubQueryKeys } from "#/lib/github.query";
import type { PullSummary } from "#/lib/github.types";
import { githubRevalidationSignalKeys } from "#/lib/github-revalidation";
import { buildSeo, formatPageTitle } from "#/lib/seo";
import { useGitHubSignalStream } from "#/lib/use-github-signal-stream";
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
	const webhookTargets = useMemo(
		() => [
			{
				queryKey: githubQueryKeys.pulls.mine(scope),
				signalKeys: [githubRevalidationSignalKeys.pullsMine],
			},
		],
		[scope],
	);
	useGitHubSignalStream(webhookTargets);

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
			<div ref={scrollContainerRef} className="h-full overflow-auto py-10">
				<div className="mx-auto grid max-w-7xl gap-14 px-3 md:px-6 xl:grid-cols-[minmax(15rem,18rem)_minmax(0,1fr)]">
					<aside className="flex h-fit flex-col gap-5 xl:sticky xl:top-0">
						<div className="flex flex-col gap-2">
							<h1 className="text-2xl font-semibold tracking-tight">
								Pull Requests
							</h1>
							<p className="text-sm text-muted-foreground">
								<span className="tabular-nums">{totalPulls}</span> open pulls
								across your queues
							</p>
						</div>

						<nav
							className="flex flex-col gap-2"
							aria-label="Pull request groups"
						>
							{groups.map((group) => (
								<PullMetricCard
									key={group.id}
									href={`#${group.id}`}
									icon={group.icon}
									label={group.title}
									value={group.pulls.length}
								/>
							))}
						</nav>
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

const PullMetricCard = memo(function PullMetricCard({
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
				<div className="mt-2 flex flex-col gap-1">
					{pulls.map((pull) => (
						<PullRequestRow key={pull.id} pr={pull} scope={scope} />
					))}
				</div>
			)}
		</section>
	);
});

function StickyGroupHeader({
	sectionRef,
	scrollContainerRef,
	stickyTop: stickyTopOffset,
	icon: Icon,
	title,
	count,
	isEmpty,
}: {
	sectionRef: RefObject<HTMLElement | null>;
	scrollContainerRef: RefObject<HTMLDivElement | null>;
	stickyTop: number;
	icon: ComponentType<{ size?: number; strokeWidth?: number }>;
	title: string;
	count: number;
	isEmpty: boolean;
}) {
	const headerRef = useRef<HTMLDivElement>(null);
	const [isStickyActive, setIsStickyActive] = useState(false);

	useEffect(() => {
		const scrollContainer = scrollContainerRef.current;
		const section = sectionRef.current;
		const header = headerRef.current;

		if (!scrollContainer || !section || !header) {
			return;
		}

		const updateStickyState = () => {
			const scrollContainerRect = scrollContainer.getBoundingClientRect();
			const sectionRect = section.getBoundingClientRect();
			const stickyTop = scrollContainerRect.top + stickyTopOffset;
			const headerHeight = header.offsetHeight;
			const isStuck =
				sectionRect.top <= stickyTop &&
				sectionRect.bottom > stickyTop + headerHeight;

			setIsStickyActive((current) => (current === isStuck ? current : isStuck));
		};

		updateStickyState();
		scrollContainer.addEventListener("scroll", updateStickyState, {
			passive: true,
		});
		window.addEventListener("resize", updateStickyState);

		return () => {
			scrollContainer.removeEventListener("scroll", updateStickyState);
			window.removeEventListener("resize", updateStickyState);
		};
	}, [scrollContainerRef, sectionRef, stickyTopOffset]);

	return (
		<div
			ref={headerRef}
			className={cn(
				"sticky -top-8 z-10 flex items-center justify-between gap-3 rounded-lg bg-surface-1 px-3 py-2 transition-shadow",
				isStickyActive && "shadow-lg",
				isEmpty && "opacity-70",
			)}
		>
			<div className="flex min-w-0 items-center gap-2">
				<div className="shrink-0 text-muted-foreground">
					<Icon size={15} strokeWidth={1.9} />
				</div>
				<h2 className="truncate text-sm font-medium">{title}</h2>
			</div>
			<span className="text-sm tabular-nums text-muted-foreground">
				{count}
			</span>
		</div>
	);
}
