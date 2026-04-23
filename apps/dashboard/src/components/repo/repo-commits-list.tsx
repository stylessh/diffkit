import { GitBranchIcon, GitCommitIcon } from "@diffkit/icons";
import { Button } from "@diffkit/ui/components/button";
import { Skeleton } from "@diffkit/ui/components/skeleton";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@diffkit/ui/components/tooltip";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { formatRelativeTime } from "#/lib/format-relative-time";
import {
	type GitHubQueryScope,
	githubRepoCommitsQueryOptions,
	githubRepoOverviewQueryOptions,
} from "#/lib/github.query";
import type { RepoCommitSummary } from "#/lib/github.types";
import { useRegisterTab } from "#/lib/use-register-tab";
import { BranchSelector } from "./code-explorer-toolbar";

const COMMITS_PAGE_SIZE = 30;
const skeletonRows = [
	"commit-0",
	"commit-1",
	"commit-2",
	"commit-3",
	"commit-4",
];

const commitDateFormatter = new Intl.DateTimeFormat("en", {
	month: "short",
	day: "numeric",
	year: "numeric",
});

export function RepoCommitsPage({
	owner,
	repo,
	currentRef,
	currentPath,
	scope,
}: {
	owner: string;
	repo: string;
	currentRef: string;
	currentPath: string;
	scope: GitHubQueryScope;
}) {
	const navigate = useNavigate();
	const loadMoreRef = useRef<HTMLDivElement>(null);
	const overviewQuery = useQuery(
		githubRepoOverviewQueryOptions(scope, {
			owner,
			repo,
		}),
	);
	const commitsQuery = useInfiniteQuery(
		githubRepoCommitsQueryOptions(scope, {
			owner,
			repo,
			ref: currentRef,
			...(currentPath ? { path: currentPath } : {}),
			perPage: COMMITS_PAGE_SIZE,
		}),
	);

	const commits = useMemo(
		() => commitsQuery.data?.pages.flatMap((page) => page.commits) ?? [],
		[commitsQuery.data],
	);
	const groups = useMemo(() => groupCommitsByDay(commits), [commits]);
	const repoData = overviewQuery.data;

	const handleBranchChange = useCallback(
		(branch: string) => {
			if (branch === currentRef) return;
			void navigate({
				to: "/$owner/$repo/commits/$",
				params: {
					owner,
					repo,
					_splat: currentPath ? `${branch}/${currentPath}` : branch,
				},
			});
		},
		[currentPath, currentRef, navigate, owner, repo],
	);

	useRegisterTab(
		repoData
			? {
					type: "commits",
					title: currentPath
						? `${currentPath.split("/").pop()} commits`
						: `${repoData.name} commits`,
					url: currentPath
						? `/${owner}/${repo}/commits/${currentRef}/${currentPath}`
						: `/${owner}/${repo}/commits/${currentRef}`,
					repo: `${owner}/${repo}`,
					iconColor: "text-muted-foreground",
					tabId: currentPath
						? `commits:${owner}/${repo}:${currentPath}`
						: `commits:${owner}/${repo}`,
				}
			: null,
	);

	useEffect(() => {
		const target = loadMoreRef.current;
		if (!target) return;

		const observer = new IntersectionObserver(
			([entry]) => {
				if (
					entry?.isIntersecting &&
					commitsQuery.hasNextPage &&
					!commitsQuery.isFetchingNextPage
				) {
					void commitsQuery.fetchNextPage();
				}
			},
			{ rootMargin: "500px 0px" },
		);

		observer.observe(target);
		return () => observer.disconnect();
	}, [
		commitsQuery.hasNextPage,
		commitsQuery.isFetchingNextPage,
		commitsQuery.fetchNextPage,
	]);

	if (overviewQuery.error) throw overviewQuery.error;
	if (commitsQuery.error) throw commitsQuery.error;

	return (
		<div className="h-full overflow-auto">
			<div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-3 py-10 md:px-6">
				<header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
					<div className="min-w-0 space-y-2">
						<Link
							to="/$owner/$repo"
							params={{ owner, repo }}
							className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:underline"
						>
							{owner}/{repo}
						</Link>
						<h1 className="text-2xl font-semibold tracking-tight">Commits</h1>
						{currentPath && (
							<p className="break-all text-sm text-muted-foreground">
								{currentPath}
							</p>
						)}
					</div>
					{repoData ? (
						<BranchSelector
							repo={repoData}
							currentRef={currentRef}
							scope={scope}
							onBranchChange={handleBranchChange}
						/>
					) : (
						<div className="flex min-w-0 items-center gap-2 rounded-lg border bg-surface-0 px-3 py-2 text-sm text-muted-foreground">
							<GitBranchIcon size={15} className="shrink-0" />
							<span className="truncate font-medium text-foreground">
								{currentRef}
							</span>
						</div>
					)}
				</header>

				<section className="overflow-hidden rounded-lg border bg-surface-0">
					{commitsQuery.isPending ? (
						<RepoCommitsListSkeleton />
					) : commits.length === 0 ? (
						<div className="px-4 py-12 text-center text-sm text-muted-foreground">
							No commits found for this ref.
						</div>
					) : (
						<ol className="divide-y">
							{groups.map((group) => (
								<li key={group.label}>
									<div className="border-b bg-surface-1 px-4 py-2 text-xs font-medium text-muted-foreground">
										Commits on {group.label}
									</div>
									<ol className="divide-y">
										{group.commits.map((commit) => (
											<CommitRow
												key={commit.sha}
												commit={commit}
												owner={owner}
												repo={repo}
											/>
										))}
									</ol>
								</li>
							))}
						</ol>
					)}
				</section>

				<div ref={loadMoreRef} className="flex min-h-12 justify-center">
					{commitsQuery.isFetchingNextPage ? (
						<div className="w-full overflow-hidden rounded-lg border bg-surface-0">
							<RepoCommitsRowsSkeleton />
						</div>
					) : commitsQuery.hasNextPage ? (
						<Button
							type="button"
							variant="outline"
							onClick={() => commitsQuery.fetchNextPage()}
						>
							Load more commits
						</Button>
					) : commits.length > 0 ? (
						<span className="py-3 text-xs text-muted-foreground">
							End of commit history
						</span>
					) : null}
				</div>
			</div>
		</div>
	);
}

function CommitRow({
	commit,
	owner,
	repo,
}: {
	commit: RepoCommitSummary;
	owner: string;
	repo: string;
}) {
	const firstLine = commit.message.split("\n")[0] || commit.sha;
	const authorName = commit.author?.login ?? commit.authorName ?? "Unknown";
	const shortSha = commit.sha.slice(0, 7);

	return (
		<li className="grid gap-3 px-4 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
			<div className="flex min-w-0 items-start gap-3">
				{commit.author ? (
					<Link
						to="/$owner"
						params={{ owner: commit.author.login }}
						className="mt-0.5 shrink-0"
					>
						<img
							src={commit.author.avatarUrl}
							alt={commit.author.login}
							className="size-8 rounded-full border border-border transition-opacity hover:opacity-80"
						/>
					</Link>
				) : (
					<div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border bg-surface-1">
						<GitCommitIcon size={14} className="text-muted-foreground" />
					</div>
				)}
				<div className="min-w-0 space-y-1">
					<Link
						to="/$owner/$repo/commit/$sha"
						params={{ owner, repo, sha: commit.sha }}
						className="block truncate font-medium text-foreground transition-colors hover:underline"
					>
						{firstLine}
					</Link>
					<p className="truncate text-xs text-muted-foreground">
						<span className="font-medium text-foreground/80">{authorName}</span>{" "}
						committed{" "}
						{commit.date ? formatRelativeTime(commit.date) : "recently"}
					</p>
				</div>
			</div>
			<div className="flex items-center gap-2 pl-11 sm:pl-0">
				<Tooltip>
					<TooltipTrigger asChild>
						<Link
							to="/$owner/$repo/commit/$sha"
							params={{ owner, repo, sha: commit.sha }}
							className="rounded-md border bg-surface-1 px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
						>
							{shortSha}
						</Link>
					</TooltipTrigger>
					<TooltipContent side="bottom">
						<code>{commit.sha}</code>
					</TooltipContent>
				</Tooltip>
			</div>
		</li>
	);
}

function RepoCommitsListSkeleton() {
	return (
		<>
			<div className="border-b bg-surface-1 px-4 py-2">
				<Skeleton className="h-3.5 w-36 rounded" />
			</div>
			<RepoCommitsRowsSkeleton />
		</>
	);
}

function RepoCommitsRowsSkeleton() {
	return (
		<div className="divide-y">
			{skeletonRows.map((key) => (
				<div
					key={key}
					className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
				>
					<div className="flex items-start gap-3">
						<Skeleton className="size-8 shrink-0 rounded-full" />
						<div className="min-w-0 flex-1 space-y-2">
							<Skeleton className="h-4 w-full max-w-md rounded" />
							<Skeleton className="h-3.5 w-48 rounded" />
						</div>
					</div>
					<Skeleton className="ml-11 h-7 w-20 rounded-md sm:ml-0" />
				</div>
			))}
		</div>
	);
}

function groupCommitsByDay(commits: RepoCommitSummary[]) {
	const groups = new Map<string, RepoCommitSummary[]>();

	for (const commit of commits) {
		const label = formatCommitDay(commit.date);
		const group = groups.get(label) ?? [];
		group.push(commit);
		groups.set(label, group);
	}

	return Array.from(groups.entries()).map(([label, groupedCommits]) => ({
		label,
		commits: groupedCommits,
	}));
}

function formatCommitDay(date: string) {
	const parsed = new Date(date);
	if (Number.isNaN(parsed.getTime())) return "recent history";
	return commitDateFormatter.format(parsed);
}
