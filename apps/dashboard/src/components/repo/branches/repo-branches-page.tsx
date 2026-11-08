import { GitBranchIcon } from "@diffkit/icons";
import { Button } from "@diffkit/ui/components/button";
import { Spinner } from "@diffkit/ui/components/spinner";
import { cn } from "@diffkit/ui/lib/utils";
import {
	keepPreviousData,
	useInfiniteQuery,
	useQuery,
} from "@tanstack/react-query";
import {
	parseAsInteger,
	parseAsString,
	parseAsStringLiteral,
	useQueryStates,
} from "nuqs";
import { useCallback, useMemo } from "react";
import { SidePanelPortal } from "#/components/layouts/dashboard-side-panel";
import { Pagination } from "#/components/pagination";
import { RepoActivityCards } from "#/components/repo/repo-activity-cards";
import {
	RepoListSearchInput,
	RepoPageHeader,
} from "#/components/repo/repo-page-header";
import {
	groupBranchesIntoSections,
	sortBranchesByRecency,
} from "#/lib/branch-sections";
import {
	type GitHubQueryScope,
	githubRepoBranchesListInfiniteQueryOptions,
	githubRepoOverviewQueryOptions,
} from "#/lib/github.query";
import type { RepoBranchListItem } from "#/lib/github.types";
import { useHasMounted } from "#/lib/use-has-mounted";
import { useUrlSearchInput } from "#/lib/use-url-search-input";
import { BranchRow, BranchRowSkeleton } from "./branch-row";

const VIEWS = ["overview", "active", "stale", "all"] as const;
type BranchView = (typeof VIEWS)[number];

const VIEW_LABELS: Record<BranchView, string> = {
	overview: "Overview",
	active: "Active",
	stale: "Stale",
	all: "All",
};

const branchesSearchParsers = {
	view: parseAsStringLiteral(VIEWS).withDefault("overview"),
	q: parseAsString,
	page: parseAsInteger.withDefault(1),
};

/** Rows per section in the overview, and per page in the full lists. */
const OVERVIEW_SECTION_LIMIT = 5;
const LIST_PAGE_SIZE = 20;

/**
 * GitHub-style branches page. GitHub's API can't sort branches by activity,
 * so we load branches 100 at a time (one GraphQL call each) and sort/bucket
 * what's loaded. Ahead/behind counts are one compare call per rendered row
 * (≤ 20 per view), cached per branch.
 */
export function RepoBranchesPage({
	owner,
	repo,
	scope,
}: {
	owner: string;
	repo: string;
	scope: GitHubQueryScope;
}) {
	const hasMounted = useHasMounted();
	const [params, setParams] = useQueryStates(branchesSearchParsers);
	const applySearch = useCallback(
		(q: string | null) => {
			void setParams({ q, page: null }, { history: "replace" });
		},
		[setParams],
	);
	const [searchInput, setSearchInput] = useUrlSearchInput(
		params.q,
		applySearch,
	);

	const overviewQuery = useQuery({
		...githubRepoOverviewQueryOptions(scope, { owner, repo }),
		enabled: hasMounted,
	});
	const repoData = overviewQuery.data;

	const query = params.q?.trim() || undefined;
	const branchesQuery = useInfiniteQuery({
		...githubRepoBranchesListInfiniteQueryOptions(scope, {
			owner,
			repo,
			query,
		}),
		enabled: hasMounted,
		placeholderData: keepPreviousData,
	});

	const pages = branchesQuery.data?.pages;
	const firstPage = pages?.[0];
	const defaultBranch =
		repoData?.defaultBranch ?? firstPage?.defaultBranch?.name ?? "main";
	const totalCount = firstPage?.totalCount ?? 0;

	const { sections, all } = useMemo(() => {
		const loaded = pages?.flatMap((page) => page.branches) ?? [];
		const tip = pages?.[0]?.defaultBranch ?? null;
		// When filtering, only show the default branch if it matches.
		const defaultTip =
			tip && (!query || tip.name.toLowerCase().includes(query.toLowerCase()))
				? tip
				: null;
		const grouped = groupBranchesIntoSections(
			query ? loaded : loaded.filter((branch) => branch.name !== defaultBranch),
			{ defaultBranch, defaultTip },
		);
		const everything = sortBranchesByRecency(
			grouped.default
				? [grouped.default, ...grouped.active, ...grouped.stale]
				: [...grouped.active, ...grouped.stale],
		);
		return { sections: grouped, all: everything };
	}, [pages, query, defaultBranch]);

	const view = params.view;
	const setView = (next: BranchView) => {
		void setParams({ view: next === "overview" ? null : next, page: null });
	};

	const listForView: RepoBranchListItem[] =
		view === "active"
			? sections.active
			: view === "stale"
				? sections.stale
				: all;
	const pageCount = Math.max(1, Math.ceil(listForView.length / LIST_PAGE_SIZE));
	const page = Math.min(params.page, pageCount);
	const pagedList = listForView.slice(
		(page - 1) * LIST_PAGE_SIZE,
		page * LIST_PAGE_SIZE,
	);

	const loadedCount =
		pages?.reduce((sum, p) => sum + p.branches.length, 0) ?? 0;
	const isLoading =
		!hasMounted || (branchesQuery.isPending && !branchesQuery.data);

	const rowProps = { owner, repo, scope, defaultBranch };

	return (
		<>
			<div className="h-full overflow-auto py-10">
				<div className="mx-auto flex min-h-full max-w-4xl flex-col gap-6 px-3 md:px-6">
					<RepoPageHeader
						owner={owner}
						repo={repo}
						repoData={repoData}
						active="branches"
						title="Branches"
						subtitle={
							totalCount > 0 ? (
								<span className="tabular-nums">
									{totalCount} branch{totalCount === 1 ? "" : "es"}
								</span>
							) : undefined
						}
					/>

					<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
						<div
							role="tablist"
							aria-label="Branch views"
							className="flex items-center gap-0.5 rounded-lg border-[0.5px] border-border/50 p-0.5"
						>
							{VIEWS.map((value) => (
								<button
									key={value}
									type="button"
									role="tab"
									aria-selected={view === value}
									onClick={() => setView(value)}
									className={cn(
										"rounded-md px-2.5 py-1 text-sm transition-colors",
										view === value
											? "bg-surface-1 font-medium text-foreground"
											: "text-muted-foreground hover:text-foreground",
									)}
								>
									{VIEW_LABELS[value]}
								</button>
							))}
						</div>
						<RepoListSearchInput
							value={searchInput}
							onChange={setSearchInput}
							placeholder="Search branches…"
							className="sm:ml-auto sm:w-[260px]"
						/>
					</div>

					{isLoading ? (
						<BranchSection title="Branches">
							<BranchRowSkeleton />
							<BranchRowSkeleton />
							<BranchRowSkeleton />
						</BranchSection>
					) : branchesQuery.isError ? (
						<p className="py-12 text-center text-sm text-muted-foreground">
							Couldn't load branches.{" "}
							<button
								type="button"
								onClick={() => void branchesQuery.refetch()}
								className="underline underline-offset-2 hover:text-foreground"
							>
								Try again
							</button>
						</p>
					) : all.length === 0 ? (
						<div className="flex flex-col items-center gap-2 py-16 text-center">
							<GitBranchIcon size={20} className="text-muted-foreground" />
							<p className="text-sm text-muted-foreground">
								{query ? `No branches match “${query}”.` : "No branches yet."}
							</p>
						</div>
					) : view === "overview" ? (
						<div
							className="flex flex-col gap-8 transition-opacity"
							style={{ opacity: branchesQuery.isPlaceholderData ? 0.6 : 1 }}
						>
							{sections.default ? (
								<BranchSection title="Default">
									<BranchRow branch={sections.default} {...rowProps} />
								</BranchSection>
							) : null}
							{sections.active.length > 0 ? (
								<BranchSection
									title="Active branches"
									count={sections.active.length}
									onViewMore={
										sections.active.length > OVERVIEW_SECTION_LIMIT
											? () => setView("active")
											: undefined
									}
								>
									{sections.active
										.slice(0, OVERVIEW_SECTION_LIMIT)
										.map((branch) => (
											<BranchRow
												key={branch.name}
												branch={branch}
												{...rowProps}
											/>
										))}
								</BranchSection>
							) : null}
							{sections.stale.length > 0 ? (
								<BranchSection
									title="Stale branches"
									count={sections.stale.length}
									onViewMore={
										sections.stale.length > OVERVIEW_SECTION_LIMIT
											? () => setView("stale")
											: undefined
									}
								>
									{sections.stale
										.slice(0, OVERVIEW_SECTION_LIMIT)
										.map((branch) => (
											<BranchRow
												key={branch.name}
												branch={branch}
												{...rowProps}
											/>
										))}
								</BranchSection>
							) : null}
						</div>
					) : pagedList.length === 0 ? (
						<p className="py-12 text-center text-sm text-muted-foreground">
							No {view === "all" ? "" : `${view} `}branches.
						</p>
					) : (
						<BranchSection
							title={
								view === "active"
									? "Active branches"
									: view === "stale"
										? "Stale branches"
										: "All branches"
							}
							count={listForView.length}
						>
							{pagedList.map((branch) => (
								<BranchRow key={branch.name} branch={branch} {...rowProps} />
							))}
						</BranchSection>
					)}

					{view !== "overview" ? (
						<Pagination
							page={page}
							hasNextPage={page < pageCount}
							onPageChange={(next) =>
								void setParams({ page: next === 1 ? null : next })
							}
						/>
					) : null}

					{branchesQuery.hasNextPage ? (
						<div className="flex flex-col items-center gap-2 text-center">
							<p className="text-xs text-muted-foreground">
								Sorted by recent activity across the first{" "}
								<span className="tabular-nums">{loadedCount}</span> of{" "}
								<span className="tabular-nums">{totalCount}</span> branches.
							</p>
							<Button
								variant="secondary"
								size="sm"
								disabled={branchesQuery.isFetchingNextPage}
								onClick={() => void branchesQuery.fetchNextPage()}
							>
								{branchesQuery.isFetchingNextPage ? (
									<Spinner size={14} />
								) : null}
								Load more branches
							</Button>
						</div>
					) : null}
				</div>
			</div>
			{repoData ? (
				<SidePanelPortal>
					<RepoActivityCards
						owner={owner}
						repo={repo}
						scope={scope}
						repoData={repoData}
					/>
				</SidePanelPortal>
			) : null}
		</>
	);
}

function BranchSection({
	title,
	count,
	onViewMore,
	children,
}: {
	title: string;
	count?: number;
	onViewMore?: () => void;
	children: React.ReactNode;
}) {
	return (
		<section className="flex flex-col gap-2">
			<div className="flex items-baseline justify-between gap-2">
				<h2 className="text-xs font-medium text-muted-foreground">
					{title}
					{count != null ? (
						<span className="ml-1.5 font-normal tabular-nums tracking-normal">
							{count}
						</span>
					) : null}
				</h2>
				{onViewMore ? (
					<button
						type="button"
						onClick={onViewMore}
						className="text-xs text-muted-foreground hover:text-foreground hover:underline"
					>
						View all
					</button>
				) : null}
			</div>
			<div className="divide-y-[0.5px] overflow-hidden rounded-lg border-[0.5px]">
				{children}
			</div>
		</section>
	);
}
