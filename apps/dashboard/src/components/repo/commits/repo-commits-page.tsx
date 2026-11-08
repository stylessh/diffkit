import { CloseIcon, FileIcon, GitCommitIcon } from "@diffkit/icons";
import { Chip } from "@diffkit/ui/components/chip";
import { Skeleton } from "@diffkit/ui/components/skeleton";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { parseAsInteger, parseAsString, useQueryStates } from "nuqs";
import { useCallback, useMemo } from "react";
import { ToolbarRow, ToolbarSearchField } from "#/components/filters";
import { SidePanelPortal } from "#/components/layouts/dashboard-side-panel";
import { Pagination } from "#/components/pagination";
import { RepoRefPicker } from "#/components/repo/refs/repo-ref-picker";
import { RepoActivityCards } from "#/components/repo/repo-activity-cards";
import { RepoPageHeader } from "#/components/repo/repo-page-header";
import { ListGroup } from "#/components/shared/list-page";
import { filterCommitsByMessage, groupCommitsByDay } from "#/lib/commit-groups";
import { buildCommitsSplat, splitCommitsSplat } from "#/lib/commits-route";
import {
	type GitHubQueryScope,
	githubRepoCommitsQueryOptions,
	githubRepoOverviewQueryOptions,
	githubRepoRefSplatQueryOptions,
	REPO_COMMITS_PER_PAGE,
} from "#/lib/github.query";
import { useHasMounted } from "#/lib/use-has-mounted";
import { useRegisterTab } from "#/lib/use-register-tab";
import { useUrlSearchInput } from "#/lib/use-url-search-input";
import {
	ghostPillClassName,
	pillButtonClassName,
	RepoEmptyState,
} from "../repo-ui";
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
	const defaultBranch = repoData?.defaultBranch;

	// Slashed splats ("feature/x/src", "@scope/pkg@1.0.0") are ambiguous:
	// ask the server which prefix is a real branch or tag.
	const needsResolution = Boolean(splat?.includes("/"));
	const splatQuery = useQuery({
		...githubRepoRefSplatQueryOptions(scope, {
			owner,
			repo,
			splat: splat ?? "",
		}),
		enabled: hasMounted && needsResolution,
	});
	const refsResolved = !needsResolution || !splatQuery.isPending;
	const { ref: splatRef, path } = useMemo(
		() =>
			needsResolution && splatQuery.data
				? { ref: splatQuery.data.ref, path: splatQuery.data.path }
				: splitCommitsSplat(splat, null),
		[needsResolution, splatQuery.data, splat],
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

	const toolbar = (
		<ToolbarRow
			search={
				<ToolbarSearchField
					value={searchInput}
					onChange={setSearchInput}
					placeholder="Search commit messages…"
				/>
			}
		>
			{path ? (
				<Chip className="h-7 max-w-full gap-1 pr-1 pl-2.5">
					<FileIcon size={12} className="shrink-0" />
					<span className="shrink-0">History for</span>
					<span className="flex min-w-0 items-center gap-0.5 truncate font-mono">
						{pathSegments.map((segment, index) => {
							const segmentPath = pathSegments.slice(0, index + 1).join("/");
							const isLast = index === pathSegments.length - 1;
							return (
								<span key={segmentPath} className="flex items-center gap-0.5">
									{index > 0 ? <span aria-hidden>/</span> : null}
									{isLast ? (
										<span className="text-foreground">{segment}</span>
									) : (
										<button
											type="button"
											onClick={() => goToRef(currentRef, segmentPath)}
											className="rounded-sm hover:text-foreground hover:underline"
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
						className="flex size-5 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-ghost-hover hover:text-foreground"
					>
						<CloseIcon size={12} />
					</button>
				</Chip>
			) : null}
			<div className="flex shrink-0 items-center gap-1.5">
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
		</ToolbarRow>
	);

	return (
		<>
			<RepoPageHeader
				owner={owner}
				repo={repo}
				scope={scope}
				active="commits"
				toolbar={toolbar}
			>
				{searchQuery && !useServerSearch ? (
					<p className="px-3 pb-2 text-xs text-muted-foreground">
						GitHub only indexes the default branch for commit search, so this
						filters the commits on the current page.
					</p>
				) : null}

				{showSkeleton ? (
					<CommitsSkeleton />
				) : commitsQuery.isError ? (
					<RepoEmptyState
						icon={<GitCommitIcon />}
						title="Couldn't load commits"
						action={
							<button
								type="button"
								onClick={() => void commitsQuery.refetch()}
								className={pillButtonClassName}
							>
								Try again
							</button>
						}
					/>
				) : groups.length === 0 ? (
					<RepoEmptyState
						icon={<GitCommitIcon />}
						title={
							hasFilters
								? "No commits match these filters"
								: path
									? "No commits touch this path on this ref"
									: "No commits on this ref yet"
						}
						action={
							hasFilters ? (
								<button
									type="button"
									onClick={() => {
										void setParams({ author: null, q: null, page: null });
									}}
									className={pillButtonClassName}
								>
									Clear filters
								</button>
							) : undefined
						}
					/>
				) : (
					<div
						className="flex flex-col transition-opacity"
						style={{ opacity: commitsQuery.isPlaceholderData ? 0.6 : 1 }}
					>
						{groups.map((group) => (
							<ListGroup
								key={group.key}
								title={group.label.replace(/^Commits on /, "")}
								label={group.label}
								count={group.commits.length}
							>
								<ol>
									{group.commits.map((commit) => (
										<li
											key={commit.sha}
											style={{
												contentVisibility: "auto",
												containIntrinsicSize: "auto 44px",
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
							</ListGroup>
						))}
					</div>
				)}

				<div className="mt-6 flex flex-col items-center gap-4">
					<Pagination
						page={params.page}
						hasNextPage={commitsQuery.data?.hasNextPage ?? false}
						onPageChange={setPage}
					/>

					{!showSkeleton && !path && currentRef ? (
						<Link
							to="/$owner/$repo/tree/$"
							params={{ owner, repo, _splat: currentRef }}
							className={ghostPillClassName}
						>
							Browse files on{" "}
							<span className="font-mono font-[450]">{currentRef}</span>
						</Link>
					) : null}
				</div>
			</RepoPageHeader>
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
		<section className="flex flex-col">
			<div className="flex h-9 items-center gap-2 rounded-lg bg-group pl-2.5">
				<Skeleton className="h-3.5 w-48 rounded" />
			</div>
			<div className="flex flex-col py-0.5">
				{SKELETON_WIDTHS.map((width) => (
					<RepoCommitRowSkeleton key={width} width={width} />
				))}
			</div>
		</section>
	);
}
