import {
	ActionsIcon,
	ChevronRightIcon,
	CommentIcon,
	GitPullRequestIcon,
	IssuesIcon,
	PlusSignIcon,
} from "@diffkit/icons";
import { cn } from "@diffkit/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	CheckStateIcon,
	getCheckState,
} from "#/components/checks/check-state-icon";
import { formatRelativeTime } from "#/lib/format-relative-time";
import {
	type GitHubQueryScope,
	githubIssuesFromRepoQueryOptions,
	githubPullsFromRepoQueryOptions,
	githubRepoDiscussionsQueryOptions,
	githubWorkflowRunsFromRepoQueryOptions,
} from "#/lib/github.query";
import type {
	DiscussionSummary,
	IssueSummary,
	PullSummary,
	RepoOverview,
	WorkflowRun,
} from "#/lib/github.types";
import { getPrStateConfig } from "#/lib/pr-state";
import { useHasMounted } from "#/lib/use-has-mounted";

export function RepoActivityCards({
	owner,
	repo,
	scope,
	repoData,
}: {
	owner: string;
	repo: string;
	scope: GitHubQueryScope;
	repoData: RepoOverview;
}) {
	const hasMounted = useHasMounted();

	const pullsQuery = useQuery({
		...githubPullsFromRepoQueryOptions(scope, {
			owner,
			repo,
			state: "open",
			perPage: 5,
			sort: "updated",
			direction: "desc",
		}),
		enabled: hasMounted,
	});

	const issuesQuery = useQuery({
		...githubIssuesFromRepoQueryOptions(scope, {
			owner,
			repo,
			state: "open",
			perPage: 5,
			sort: "updated",
			direction: "desc",
		}),
		enabled: hasMounted,
	});

	const runsQuery = useQuery({
		...githubWorkflowRunsFromRepoQueryOptions(scope, {
			owner,
			repo,
			perPage: 5,
		}),
		enabled: hasMounted,
	});

	const discussionsQuery = useQuery({
		...githubRepoDiscussionsQueryOptions(scope, { owner, repo }),
		enabled: hasMounted && !!repoData.hasDiscussions,
	});

	const discussionsData = discussionsQuery.data;
	// Handle both old (array) and new (object) cache formats
	const discussions = discussionsData
		? Array.isArray(discussionsData)
			? discussionsData
			: discussionsData.discussions
		: undefined;
	const discussionCount =
		discussionsData && !Array.isArray(discussionsData)
			? discussionsData.totalCount
			: undefined;

	return (
		<div className="flex w-72 flex-col gap-3">
			<ActivityCard
				title="Pull Requests"
				icon={GitPullRequestIcon}
				items={pullsQuery.data}
				count={repoData.openPullCount}
				viewAllHref={`/${owner}/${repo}/pulls`}
				renderItem={(pr) => <PullItem key={pr.id} pr={pr} />}
			/>
			<ActivityCard
				title="Issues"
				icon={IssuesIcon}
				items={issuesQuery.data}
				count={repoData.openIssueCount}
				viewAllHref={`/${owner}/${repo}/issues`}
				actionHref={`/${owner}/${repo}/issues/new`}
				renderItem={(issue) => <IssueItem key={issue.id} issue={issue} />}
			/>
			<ActivityCard
				title="Actions"
				icon={ActionsIcon}
				items={runsQuery.data}
				viewAllHref={`/${owner}/${repo}/actions`}
				renderItem={(run) => (
					<RunItem key={run.id} run={run} owner={owner} repo={repo} />
				)}
			/>
			{repoData.hasDiscussions && (
				<ActivityCard
					title="Discussions"
					icon={CommentIcon}
					items={discussions}
					count={discussionCount}
					viewAllHref={`${repoData.url}/discussions`}
					renderItem={(d) => (
						<DiscussionItem key={d.number} discussion={d} repo={repoData} />
					)}
				/>
			)}
		</div>
	);
}

function ActivityCard<T>({
	title,
	icon: Icon,
	items,
	count,
	viewAllHref,
	actionHref,
	renderItem,
}: {
	title: string;
	icon: React.ComponentType<{
		size?: number;
		strokeWidth?: number;
		className?: string;
	}>;
	items: T[] | undefined;
	count?: number;
	viewAllHref: string;
	actionHref?: string;
	renderItem: (item: T) => React.ReactNode;
}) {
	return (
		<div className="rounded-xl border bg-card">
			<div className="flex items-center gap-2 px-4 py-3">
				<Icon size={14} strokeWidth={2} className="text-muted-foreground" />
				<h3 className="flex-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
					{title}
				</h3>
				{count != null && (
					<span className="text-xs tabular-nums text-muted-foreground">
						{count}
					</span>
				)}
				{actionHref && (
					<Link
						to={actionHref}
						className="flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-surface-1 hover:text-foreground"
					>
						<PlusSignIcon size={14} strokeWidth={2} />
					</Link>
				)}
			</div>
			<div className="flex flex-col">
				{!items ? (
					<ActivityCardSkeleton />
				) : (
					<>
						{items.length === 0 ? (
							<p className="px-4 pb-8 pt-6 text-center text-xs text-muted-foreground">
								No open {title.toLowerCase()}
							</p>
						) : (
							items.map(renderItem)
						)}
						<Link
							to={viewAllHref}
							className="border-t px-4 py-2.5 text-center text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
						>
							View all
						</Link>
					</>
				)}
			</div>
		</div>
	);
}

function PullItem({ pr }: { pr: PullSummary }) {
	const { icon: StateIcon, color } = getPrStateConfig(pr);
	const href = `/${pr.repository.owner}/${pr.repository.name}/pull/${pr.number}`;

	return (
		<Link
			to={href}
			className="flex items-start gap-2.5 px-4 py-2 transition-colors hover:bg-surface-1"
		>
			<div className={cn("mt-0.5 shrink-0", color)}>
				<StateIcon size={14} strokeWidth={2} />
			</div>
			<div className="min-w-0 flex-1">
				<p className="truncate text-sm">{pr.title}</p>
				<p className="text-xs text-muted-foreground">
					#{pr.number} · {formatRelativeTime(pr.updatedAt)}
				</p>
			</div>
		</Link>
	);
}

function IssueItem({ issue }: { issue: IssueSummary }) {
	const color =
		issue.state === "closed"
			? issue.stateReason === "not_planned"
				? "text-muted-foreground"
				: "text-purple-500"
			: "text-green-500";
	const href = `/${issue.repository.owner}/${issue.repository.name}/issues/${issue.number}`;

	return (
		<Link
			to={href}
			className="flex items-start gap-2.5 px-4 py-2 transition-colors hover:bg-surface-1"
		>
			<div className={cn("mt-0.5 shrink-0", color)}>
				<IssuesIcon size={14} strokeWidth={2} />
			</div>
			<div className="min-w-0 flex-1">
				<p className="truncate text-sm">{issue.title}</p>
				<p className="text-xs text-muted-foreground">
					#{issue.number} · {formatRelativeTime(issue.updatedAt)}
				</p>
			</div>
		</Link>
	);
}

function RunItem({
	run,
	owner,
	repo,
}: {
	run: WorkflowRun;
	owner: string;
	repo: string;
}) {
	const state = getCheckState(run);
	return (
		<Link
			to="/$owner/$repo/actions/runs/$runId"
			params={{ owner, repo, runId: String(run.id) }}
			className="flex items-start gap-2.5 px-4 py-2 transition-colors hover:bg-surface-1"
		>
			<div className="mt-0.5 shrink-0">
				<CheckStateIcon state={state} />
			</div>
			<div className="min-w-0 flex-1">
				<p className="truncate text-sm">{run.displayTitle}</p>
				<p className="truncate text-xs text-muted-foreground">
					#{run.runNumber} · {formatRelativeTime(run.updatedAt)}
				</p>
			</div>
		</Link>
	);
}

function DiscussionItem({
	discussion,
}: {
	discussion: DiscussionSummary;
	repo: RepoOverview;
}) {
	return (
		<a
			href={discussion.url}
			target="_blank"
			rel="noopener noreferrer"
			className="flex items-start gap-2.5 px-4 py-2 transition-colors hover:bg-surface-1"
		>
			<div className="mt-0.5 shrink-0 text-muted-foreground">
				<ChevronRightIcon size={14} strokeWidth={2} />
			</div>
			<div className="min-w-0 flex-1">
				<p className="truncate text-sm">{discussion.title}</p>
				<p className="flex items-center gap-1 text-xs text-muted-foreground">
					{discussion.category && (
						<>
							<span>{discussion.category}</span>
							<span>·</span>
						</>
					)}
					{discussion.isAnswered && (
						<>
							<span className="text-green-500">Answered</span>
							<span>·</span>
						</>
					)}
					<span>{formatRelativeTime(discussion.updatedAt)}</span>
				</p>
			</div>
		</a>
	);
}

function ActivityCardSkeleton() {
	return (
		<div className="flex flex-col gap-1 px-4 pb-3">
			{[0, 1, 2].map((i) => (
				<div key={i} className="flex items-start gap-2.5 py-2">
					<div className="mt-0.5 size-3.5 shrink-0 animate-pulse rounded-full bg-surface-1" />
					<div className="flex-1">
						<div className="h-4 w-full animate-pulse rounded bg-surface-1" />
						<div className="mt-1.5 h-3 w-20 animate-pulse rounded bg-surface-1" />
					</div>
				</div>
			))}
		</div>
	);
}
