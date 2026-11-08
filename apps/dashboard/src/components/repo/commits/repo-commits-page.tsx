import { CloseIcon, FileIcon, GitCommitIcon } from "@diffkit/icons";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { parseAsInteger, parseAsString, useQueryStates } from "nuqs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SidePanelPortal } from "#/components/layouts/dashboard-side-panel";
import { Pagination } from "#/components/pagination";
import { RepoRefPicker } from "#/components/repo/refs/repo-ref-picker";
import { RepoActivityCards } from "#/components/repo/repo-activity-cards";
import {
	RepoListSearchInput,
	RepoPageHeader,
} from "#/components/repo/repo-page-header";
import { filterCommitsByMessage, groupCommitsByDay } from "#/lib/commit-groups";
import { buildCommitsSplat, parseCommitsSplat } from "#/lib/commits-route";
import {
	type GitHubQueryScope,
	githubRepoCommitsQueryOptions,
	githubRepoOverviewQueryOptions,
	githubRepoRefNamesQueryOptions,
	REPO_COMMITS_PER_PAGE,
} from "#/lib/github.query";
import { useDebouncedValue } from "#/lib/use-debounced-value";
import { useHasMounted } from "#/lib/use-has-mounted";
import { useRegisterTab } from "#/lib/use-register-tab";
import { CommitAuthorFilter } from "./commit-author-filter";
import { RepoCommitRow, RepoCommitRowSkeleton } from "./repo-commit-row";

const commitsSearchParsers = {
	page: parseAsInteger.withDefault(1),
	author: parseAsString,
	q: parseAsString,
};

const SKELETON_WIDTHS = ["72%", "54%", "80%", "46%", "64%", "58%"];

/**
 * Commit history for a ref (defaults to the default branch), optionally scoped
 * to a path. One GitHub request per page; message search uses GitHub's commit
 * search on the default branch and falls back to filtering the loaded page on
 * other refs (the search index only covers the default branch).
 */
export function RepoCommitsPage({
	owner,
	repo,
	scope,
	splat,
}: {
	owner: string;
	repo: string;
	scope: GitHubQueryScope;
	splat?: string;
}) {
	const hasMounted = useHasMounted();
	const navigate = useNavigate();
	const [params, setParams] = useQueryStates(commitsSearchParsers, {
		history: "push",
	});
	const [searchInput, setSearchInput] = useState(params.q ?? "");
	const debouncedSearch = useDebouncedValue(searchInput, 300);

	useEffect(() => {
		const next = debouncedSearch.trim() || null;
		if (next === (params.q ?? null)) return;
		void setParams({ q: next, page: null }, { history: "replace" });
	}, [debouncedSearch, params.q, setParams]);

	const overviewQuery = useQuery({
		...githubRepoOverviewQueryOptions(scope, { owner, repo }),
		enabled: hasMounted,
	});
	const repoData = overviewQuery.data;
	const defaultBranch = repoData?.defaultBranch;

	// Only ambiguous splats ("feature/x/src") need branch names to resolve.
	const needsRefNames = Boolean(splat?.includes("/"));
	const branchNamesQuery = useQuery({
		...githubRepoRefNamesQueryOptions(scope, { owner, repo, kind: "branches" }),
		enabled: hasMounted && needsRefNames,
	});
	const refsResolved = !needsRefNames || !branchNamesQuery.isPending;
	const { ref: splatRef, path } = useMemo(
		() =>
			parseCommitsSplat(splat, {
				refNames: branchNamesQuery.data?.names,
				defaultBranch,
			}),
		[splat, branchNamesQuery.data?.names, defaultBranch],
	);

	const currentRef = splatRef ?? defaultBranch ?? "";
	const isDefaultRef = splatRef == null || splatRef === defaultBranch;
	const searchQuery = params.q?.trim() ?? "";
	const useServerSearch = searchQuery.length > 0 && isDefaultRef && !path;

	const commitsInput = useMemo(
		() => ({
			owner,
			repo,
			ref: splatRef ?? undefined,
			path: path || undefined,
			author: params.author ?? undefined,
			query: useServerSearch ? searchQuery : undefined,
			page: params.page,
			perPage: REPO_COMMITS_PER_PAGE,
		}),
		[
			owner,
			repo,
			splatRef,
			path,
			params.author,
			useServerSearch,
			searchQuery,
			params.page,
		],
	);

	const commitsQuery = useQuery({
		...githubRepoCommitsQueryOptions(scope, commitsInput),
		enabled: hasMounted && refsResolved,
		placeholderData: keepPreviousData,
	});

	const pageCommits = commitsQuery.data?.commits ?? [];
	const visibleCommits = useMemo(
		() =>
			useServerSearch || !searchQuery
				? pageCommits
				: filterCommitsByMessage(pageCommits, searchQuery),
		[pageCommits, searchQuery, useServerSearch],
	);
	const groups = useMemo(
		() => groupCommitsByDay(visibleCommits),
		[visibleCommits],
	);

	useRegisterTab({
		type: "commits",
		title: path ? `History · ${path}` : `Commits · ${owner}/${repo}`,
		url: `/${owner}/${repo}/commits${splat ? `/${splat}` : ""}`,
		repo: `${owner}/${repo}`,
		iconColor: "text-muted-foreground",
		tabId: `commits:${owner}/${repo}`,
	});

	const goToRef = useCallback(
		(ref: string, nextPath = path) => {
			void navigate({
				to: "/$owner/$repo/commits/$",
				params: { owner, repo, _splat: buildCommitsSplat(ref, nextPath) },
				search: (prev: Record<string, unknown>) => ({
					...prev,
					page: undefined,
				}),
			});
		},
		[navigate, owner, repo, path],
	);

	const setPage = useCallback(
		(page: number) => {
			void setParams({ page: page === 1 ? null : page });
		},
		[setParams],
	);

	const setAuthor = useCallback(
		(author: string | null) => {
			void setParams({ author, page: null });
		},
		[setParams],
	);

	const hasFilters = Boolean(params.author || searchQuery);
	const showSkeleton =
		!hasMounted ||
		!refsResolved ||
		(commitsQuery.isPending && !commitsQuery.data);
	const pathSegments = path ? path.split("/") : [];

	return (
		<>
			<div className="h-full overflow-auto py-10">
				<div className="mx-auto flex min-h-full max-w-4xl flex-col gap-6 px-3 md:px-6">
					<RepoPageHeader
						owner={owner}
						repo={repo}
						repoData={repoData}
						active="commits"
						title={path ? "History" : "Commits"}
						subtitle={currentRef || undefined}
					/>

					{path ? (
						<div className="flex min-w-0 items-center gap-2 rounded-lg border border-border/60 bg-surface-1/50 px-3 py-2 text-sm">
							<FileIcon size={14} className="shrink-0 text-muted-foreground" />
							<span className="shrink-0 text-muted-foreground">
								History for
							</span>
							<span className="flex min-w-0 items-center gap-1 truncate font-mono text-xs">
								{pathSegments.map((segment, index) => {
									const segmentPath = pathSegments
										.slice(0, index + 1)
										.join("/");
									const isLast = index === pathSegments.length - 1;
									return (
										<span key={segmentPath} className="flex items-center gap-1">
											{index > 0 ? (
												<span className="text-muted-foreground">/</span>
											) : null}
											{isLast ? (
												<span className="font-medium text-foreground">
													{segment}
												</span>
											) : (
												<button
													type="button"
													onClick={() => goToRef(currentRef, segmentPath)}
													className="text-muted-foreground hover:text-foreground hover:underline"
												>
													{segment}
												</button>
											)}
										</span>
									);
								})}
							</span>
							<button
								type="button"
								onClick={() => goToRef(currentRef, "")}
								aria-label="Show all commits"
								className="ml-auto flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
							>
								<CloseIcon size={12} />
								All files
							</button>
						</div>
					) : null}

					<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
						<RepoListSearchInput
							value={searchInput}
							onChange={setSearchInput}
							placeholder="Search commit messages…"
							className="sm:w-[280px]"
						/>
						<div className="flex items-center gap-2 sm:ml-auto">
							<CommitAuthorFilter
								owner={owner}
								repo={repo}
								scope={scope}
								value={params.author}
								onChange={setAuthor}
								pageCommits={pageCommits}
							/>
							{defaultBranch ? (
								<RepoRefPicker
									owner={owner}
									repo={repo}
									scope={scope}
									currentRef={currentRef}
									defaultBranch={defaultBranch}
									onSelect={(ref) => goToRef(ref)}
									align="end"
								/>
							) : null}
						</div>
					</div>

					{searchQuery && !useServerSearch ? (
						<p className="-mt-3 text-xs text-muted-foreground">
							GitHub only indexes the default branch for commit search, so this
							filters the commits on the current page.
						</p>
					) : null}

					{showSkeleton ? (
						<CommitsSkeleton />
					) : commitsQuery.isError ? (
						<p className="py-12 text-center text-sm text-muted-foreground">
							Couldn't load commits.{" "}
							<button
								type="button"
								onClick={() => void commitsQuery.refetch()}
								className="underline underline-offset-2 hover:text-foreground"
							>
								Try again
							</button>
						</p>
					) : groups.length === 0 ? (
						<div className="flex flex-col items-center gap-2 py-16 text-center">
							<GitCommitIcon size={20} className="text-muted-foreground" />
							<p className="text-sm text-muted-foreground">
								{hasFilters
									? "No commits match these filters."
									: path
										? "No commits touch this path on this ref."
										: "No commits on this ref yet."}
							</p>
							{hasFilters ? (
								<button
									type="button"
									onClick={() => {
										setSearchInput("");
										void setParams({ author: null, q: null, page: null });
									}}
									className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
								>
									Clear filters
								</button>
							) : null}
						</div>
					) : (
						<div
							className="flex flex-col gap-6 transition-opacity"
							style={{ opacity: commitsQuery.isPlaceholderData ? 0.6 : 1 }}
						>
							{groups.map((group) => (
								<section key={group.key} className="flex flex-col gap-2">
									<h2 className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
										<GitCommitIcon size={14} />
										{group.label}
									</h2>
									<ol className="divide-y overflow-hidden rounded-lg border">
										{group.commits.map((commit) => (
											<li
												key={commit.sha}
												style={{
													contentVisibility: "auto",
													containIntrinsicSize: "auto 64px",
												}}
											>
												<RepoCommitRow
													commit={commit}
													owner={owner}
													repo={repo}
												/>
											</li>
										))}
									</ol>
								</section>
							))}
						</div>
					)}

					<Pagination
						page={params.page}
						hasNextPage={commitsQuery.data?.hasNextPage ?? false}
						onPageChange={setPage}
					/>

					{!showSkeleton && !path && currentRef ? (
						<p className="text-center text-xs text-muted-foreground">
							<Link
								to="/$owner/$repo/tree/$"
								params={{ owner, repo, _splat: currentRef }}
								className="hover:text-foreground hover:underline"
							>
								Browse files on {currentRef}
							</Link>
						</p>
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

function CommitsSkeleton() {
	return (
		<section className="flex flex-col gap-2">
			<div className="h-4 w-48 animate-pulse rounded bg-surface-1" />
			<div className="divide-y overflow-hidden rounded-lg border">
				{SKELETON_WIDTHS.map((width) => (
					<RepoCommitRowSkeleton key={width} width={width} />
				))}
			</div>
		</section>
	);
}
