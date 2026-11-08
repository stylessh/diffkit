import {
	ChevronLeftIcon,
	ChevronRightIcon,
	FileIcon,
	FolderIcon,
	SearchIcon,
} from "@diffkit/icons";
import { Skeleton } from "@diffkit/ui/components/skeleton";
import { cn } from "@diffkit/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { splitHighlights } from "#/lib/code-browsing/mappers";
import {
	CODE_SEARCH_PAGE_SIZE,
	type CodeSearchFragment,
	type CodeSearchHit,
	type RepoCodeSearch,
} from "#/lib/code-browsing/types";
import { formatRelativeTime } from "#/lib/format-relative-time";
import { searchFiles } from "#/lib/fuzzy-file-search";
import {
	type GitHubQueryScope,
	githubRepoCodeSearchQueryOptions,
	githubRepoOverviewQueryOptions,
} from "#/lib/github.query";
import { useRegisterTab } from "#/lib/use-register-tab";
import { RepoHeader } from "../repo-header";
import {
	cardRowClassName,
	iconButtonClassName,
	pillButtonClassName,
	RepoCard,
	RepoCardHead,
	RepoEmptyState,
} from "../repo-ui";
import { useTreeIndex } from "./use-directory-listing";

const PATH_MATCH_LIMIT = 6;
/** GitHub stops paging code search results at 1,000. */
const MAX_RESULT_PAGES = 1000 / CODE_SEARCH_PAGE_SIZE;

type SearchPageProps = {
	scope: GitHubQueryScope;
	owner: string;
	repo: string;
	query: string;
	page: number;
};

export function CodeSearchPage(props: SearchPageProps) {
	const { scope, owner, repo, query } = props;
	const overviewQuery = useQuery(
		githubRepoOverviewQueryOptions(scope, { owner, repo }),
	);
	const repoData = overviewQuery.data;

	useRegisterTab(
		repoData
			? {
					type: "repo",
					title: `${owner}/${repoData.name}`,
					url: `/${owner}/${repo}`,
					repo: `${owner}/${repo}`,
					iconColor: "text-muted-foreground",
					avatarUrl: repoData.ownerAvatarUrl,
				}
			: null,
	);

	return (
		<div className="flex h-full min-h-0 flex-col">
			<RepoHeader owner={owner} repo={repo} scope={scope} active="code" />
			<div className="min-h-0 flex-1 overflow-y-auto border-t-[0.5px] border-header-rule">
				<div className="mx-auto flex max-w-[960px] flex-col gap-5 px-3 pt-4 pb-16 md:px-6 md:pt-6">
					<SearchForm owner={owner} repo={repo} query={query} />
					{query ? (
						<>
							{repoData ? (
								<PathMatches
									scope={scope}
									owner={owner}
									repo={repo}
									defaultBranch={repoData.defaultBranch}
									query={query}
								/>
							) : null}
							<CodeMatches {...props} defaultBranch={repoData?.defaultBranch} />
						</>
					) : (
						<RepoCard>
							<RepoEmptyState
								icon={<SearchIcon />}
								title="Search this repository"
							>
								Matches file contents on the default branch. Use{" "}
								<code className="font-mono">path:</code>,{" "}
								<code className="font-mono">language:</code> or{" "}
								<code className="font-mono">extension:</code> to narrow it down.
							</RepoEmptyState>
						</RepoCard>
					)}
				</div>
			</div>
		</div>
	);
}

function SearchForm({
	owner,
	repo,
	query,
}: {
	owner: string;
	repo: string;
	query: string;
}) {
	const navigate = useNavigate();
	const [value, setValue] = useState(query);
	useEffect(() => setValue(query), [query]);

	const submit = (event: FormEvent) => {
		event.preventDefault();
		const next = value.trim();
		void navigate({
			to: "/$owner/$repo/search",
			params: { owner, repo },
			search: next ? { q: next } : {},
		});
	};

	return (
		<form onSubmit={submit} className="flex items-center gap-2">
			<label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg bg-card px-3 shadow-field focus-within:outline-1 focus-within:-outline-offset-1 focus-within:outline-ring">
				<SearchIcon size={15} className="shrink-0 text-muted-foreground" />
				<input
					type="search"
					value={value}
					onChange={(event) => setValue(event.target.value)}
					placeholder={`Search code in ${owner}/${repo}`}
					aria-label="Search code"
					// biome-ignore lint/a11y/noAutofocus: the page exists to type a query
					autoFocus={!query}
					className="h-full min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
				/>
			</label>
			<button type="submit" className={cn(pillButtonClassName, "h-9 px-4")}>
				Search
			</button>
		</form>
	);
}

function PathMatches({
	scope,
	owner,
	repo,
	defaultBranch,
	query,
}: {
	scope: GitHubQueryScope;
	owner: string;
	repo: string;
	defaultBranch: string;
	query: string;
}) {
	const indexQuery = useTreeIndex(scope, { owner, repo, ref: defaultBranch });
	const matches = useMemo(
		() =>
			indexQuery.data
				? searchFiles(query, indexQuery.data.finderEntries, PATH_MATCH_LIMIT)
				: [],
		[indexQuery.data, query],
	);
	if (matches.length === 0) return null;

	return (
		<section aria-labelledby="path-matches" className="flex flex-col gap-2">
			<h2
				id="path-matches"
				className="text-xs font-medium text-muted-foreground"
			>
				Matching paths
			</h2>
			<RepoCard>
				{matches.map((entry) => (
					<Link
						key={entry.path}
						to={
							entry.type === "dir"
								? "/$owner/$repo/tree/$"
								: "/$owner/$repo/blob/$"
						}
						params={{ owner, repo, _splat: `${defaultBranch}/${entry.path}` }}
						className={cardRowClassName}
					>
						{entry.type === "dir" ? (
							<FolderIcon
								size={15}
								className="shrink-0 text-muted-foreground"
							/>
						) : (
							<FileIcon size={15} className="shrink-0 text-muted-foreground" />
						)}
						<span className="truncate text-[13px] text-text-header">
							{entry.path}
						</span>
					</Link>
				))}
			</RepoCard>
		</section>
	);
}

function CodeMatches({
	scope,
	owner,
	repo,
	query,
	page,
	defaultBranch,
}: SearchPageProps & { defaultBranch: string | undefined }) {
	const searchQuery = useQuery(
		githubRepoCodeSearchQueryOptions(scope, { owner, repo, query, page }),
	);

	return (
		<section aria-labelledby="code-matches" className="flex flex-col gap-2">
			<h2
				id="code-matches"
				className="text-xs font-medium text-muted-foreground"
			>
				Code
				{searchQuery.data?.status === "ok"
					? ` · ${searchQuery.data.totalCount.toLocaleString()} ${searchQuery.data.totalCount === 1 ? "file" : "files"}`
					: null}
			</h2>
			{searchQuery.error ? (
				<RepoCard>
					<RepoEmptyState title="Search failed">
						{searchQuery.error.message}
					</RepoEmptyState>
				</RepoCard>
			) : searchQuery.data && defaultBranch ? (
				<SearchOutcome
					result={searchQuery.data}
					owner={owner}
					repo={repo}
					query={query}
					page={page}
					defaultBranch={defaultBranch}
				/>
			) : (
				<ResultsSkeleton />
			)}
		</section>
	);
}

function SearchOutcome({
	result,
	owner,
	repo,
	query,
	page,
	defaultBranch,
}: {
	result: RepoCodeSearch;
	owner: string;
	repo: string;
	query: string;
	page: number;
	defaultBranch: string;
}) {
	switch (result.status) {
		case "rateLimited":
			return (
				<RepoCard>
					<RepoEmptyState title="Code search is cooling down">
						GitHub allows 10 code searches a minute.
						{result.retryAt
							? ` Try again ${formatRelativeTime(result.retryAt)}.`
							: " Try again shortly."}
					</RepoEmptyState>
				</RepoCard>
			);
		case "invalid":
			return (
				<RepoCard>
					<RepoEmptyState title="GitHub couldn't run this search">
						{result.message}
					</RepoEmptyState>
				</RepoCard>
			);
		case "ok": {
			if (result.hits.length === 0) {
				return (
					<RepoCard>
						<RepoEmptyState icon={<SearchIcon />} title="No code matches">
							Nothing on {defaultBranch} matches “{query}”.
						</RepoEmptyState>
					</RepoCard>
				);
			}
			const pageCount = Math.min(
				Math.ceil(result.totalCount / CODE_SEARCH_PAGE_SIZE),
				MAX_RESULT_PAGES,
			);
			return (
				<div className="flex flex-col gap-3">
					{result.hits.map((hit) => (
						<SearchHitCard
							key={hit.path}
							hit={hit}
							owner={owner}
							repo={repo}
							defaultBranch={defaultBranch}
						/>
					))}
					{result.incomplete ? (
						<p className="text-xs text-muted-foreground">
							GitHub timed out before searching everything; results may be
							incomplete.
						</p>
					) : null}
					<Pagination
						owner={owner}
						repo={repo}
						query={query}
						page={page}
						pageCount={pageCount}
					/>
				</div>
			);
		}
	}
}

function SearchHitCard({
	hit,
	owner,
	repo,
	defaultBranch,
}: {
	hit: CodeSearchHit;
	owner: string;
	repo: string;
	defaultBranch: string;
}) {
	return (
		<RepoCard>
			<RepoCardHead className="h-9">
				<FileIcon size={14} className="shrink-0 text-muted-foreground" />
				<Link
					to="/$owner/$repo/blob/$"
					params={{ owner, repo, _splat: `${defaultBranch}/${hit.path}` }}
					className="min-w-0 truncate font-medium text-text-header hover:text-foreground hover:underline"
				>
					{hit.path}
				</Link>
			</RepoCardHead>
			{hit.fragments.length > 0 ? (
				<div className="flex flex-col divide-y-[0.5px] divide-card-border">
					{hit.fragments.map((fragment, index) => (
						<FragmentView
							// biome-ignore lint/suspicious/noArrayIndexKey: fragments have no identity beyond their order
							key={index}
							fragment={fragment}
						/>
					))}
				</div>
			) : null}
		</RepoCard>
	);
}

function FragmentView({ fragment }: { fragment: CodeSearchFragment }) {
	return (
		<pre className="overflow-x-auto px-4 py-2.5 font-mono text-xs leading-5 text-text-header">
			{splitHighlights(fragment.text, fragment.highlights).map(
				(segment, index) =>
					segment.highlighted ? (
						<mark
							// biome-ignore lint/suspicious/noArrayIndexKey: segments are positional
							key={index}
							className="rounded-[3px] bg-pill-warning px-px text-pill-warning-text"
						>
							{segment.text}
						</mark>
					) : (
						segment.text
					),
			)}
		</pre>
	);
}

function Pagination({
	owner,
	repo,
	query,
	page,
	pageCount,
}: {
	owner: string;
	repo: string;
	query: string;
	page: number;
	pageCount: number;
}) {
	if (pageCount <= 1) return null;
	const link = (target: number, label: string, icon: React.ReactNode) => (
		<Link
			to="/$owner/$repo/search"
			params={{ owner, repo }}
			search={{ q: query, page: target }}
			aria-label={label}
			aria-disabled={target < 1 || target > pageCount}
			className={iconButtonClassName}
		>
			{icon}
		</Link>
	);
	return (
		<nav
			aria-label="Result pages"
			className="flex items-center justify-end gap-1 text-xs text-muted-foreground"
		>
			{link(page - 1, "Previous page", <ChevronLeftIcon size={14} />)}
			<span className="tabular-nums">
				Page {page} of {pageCount}
			</span>
			{link(page + 1, "Next page", <ChevronRightIcon size={14} />)}
		</nav>
	);
}

function ResultsSkeleton() {
	return (
		<div className="flex flex-col gap-3">
			{["a", "b", "c"].map((key) => (
				<RepoCard key={key}>
					<RepoCardHead className="h-9">
						<Skeleton className="h-3.5 w-56 rounded" />
					</RepoCardHead>
					<div className="flex flex-col gap-2 px-4 py-3">
						<Skeleton className="h-3 w-4/5 rounded" />
						<Skeleton className="h-3 w-3/5 rounded" />
					</div>
				</RepoCard>
			))}
		</div>
	);
}
