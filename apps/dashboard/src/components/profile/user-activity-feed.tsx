import {
	CircleIcon,
	CodeIcon,
	CommentIcon,
	GitBranchIcon,
	GitCommitIcon,
	GitPullRequestIcon,
	IssuesIcon,
	StarIcon,
} from "@diffkit/icons";
import { cn } from "@diffkit/ui/lib/utils";
import { formatRelativeTime } from "#/lib/format-relative-time";
import type { UserActivityEvent } from "#/lib/github.types";
import { getPrStateConfig } from "#/lib/pr-state";

type MonthGroup = {
	label: string;
	items: FeedItem[];
};

type FeedItem =
	| { kind: "event"; event: UserActivityEvent }
	| { kind: "commits"; summary: CommitsSummary }
	| {
			kind: "prs";
			highlighted: UserActivityEvent[];
			summary: PrSummary | null;
	  };

type CommitsSummary = {
	totalCommits: number;
	repos: Array<{ name: string; url: string; commits: number }>;
};

type PrSummary = {
	totalPrs: number;
	repos: Array<{
		name: string;
		url: string;
		open: number;
		merged: number;
		closed: number;
	}>;
};

function buildMonthGroups(events: UserActivityEvent[]): MonthGroup[] {
	const sorted = [...events].sort(
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
	);

	const groupMap = new Map<string, UserActivityEvent[]>();

	for (const event of sorted) {
		const date = new Date(event.createdAt);
		const key = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, "0")}`;

		let group = groupMap.get(key);
		if (!group) {
			group = [];
			groupMap.set(key, group);
		}
		group.push(event);
	}

	return Array.from(groupMap.entries()).map(([, groupEvents]) => {
		const filtered = groupEvents.filter(
			(e) => e.type !== "CreateEvent" && e.type !== "DeleteEvent",
		);
		const pushEvents = filtered.filter((e) => e.type === "PushEvent");
		const prEvents = filtered.filter((e) => e.type === "PullRequestEvent");
		const otherEvents = filtered.filter(
			(e) => e.type !== "PushEvent" && e.type !== "PullRequestEvent",
		);

		const items: FeedItem[] = otherEvents.map((event) => ({
			kind: "event",
			event,
		}));

		if (pushEvents.length > 0) {
			const repoMap = new Map<
				string,
				{ name: string; url: string; commits: number }
			>();
			let totalCommits = 0;

			for (const push of pushEvents) {
				const commitCount = push.commits?.length ?? 1;
				totalCommits += commitCount;
				const existing = repoMap.get(push.repo.name);
				if (existing) {
					existing.commits += commitCount;
				} else {
					repoMap.set(push.repo.name, {
						name: push.repo.name,
						url: push.repo.url,
						commits: commitCount,
					});
				}
			}

			const repos = Array.from(repoMap.values()).sort(
				(a, b) => b.commits - a.commits,
			);

			items.unshift({
				kind: "commits",
				summary: {
					totalCommits,
					repos,
				},
			});
		}

		if (prEvents.length > 0) {
			// Deduplicate PR events by PR number — keep the latest event per PR
			// so we reflect the most recent state (e.g. merged > closed > opened)
			const prByKey = new Map<string, UserActivityEvent>();
			for (const pr of prEvents) {
				const key = `${pr.repo.name}#${pr.prDetail?.number ?? pr.id}`;
				const existing = prByKey.get(key);
				if (
					!existing ||
					new Date(pr.createdAt) > new Date(existing.createdAt)
				) {
					prByKey.set(key, pr);
				}
			}
			const uniquePrs = Array.from(prByKey.values()).sort(
				(a, b) =>
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
			);

			const highlighted = uniquePrs.slice(0, 3);
			const rest = uniquePrs.slice(3);

			let summary: PrSummary | null = null;
			if (rest.length > 0) {
				const repoMap = new Map<
					string,
					{
						name: string;
						url: string;
						open: number;
						merged: number;
						closed: number;
					}
				>();

				for (const pr of rest) {
					const state = pr.prDetail?.state ?? "open";
					const existing = repoMap.get(pr.repo.name);
					if (existing) {
						if (state === "merged") existing.merged++;
						else if (state === "closed") existing.closed++;
						else existing.open++;
					} else {
						repoMap.set(pr.repo.name, {
							name: pr.repo.name,
							url: pr.repo.url,
							open: state === "open" ? 1 : 0,
							merged: state === "merged" ? 1 : 0,
							closed: state === "closed" ? 1 : 0,
						});
					}
				}

				summary = {
					totalPrs: rest.length,
					repos: Array.from(repoMap.values()).sort(
						(a, b) =>
							b.open + b.merged + b.closed - (a.open + a.merged + a.closed),
					),
				};
			}

			items.unshift({
				kind: "prs",
				highlighted,
				summary,
			});
		}

		return {
			label: new Date(groupEvents[0].createdAt).toLocaleDateString("en-US", {
				month: "long",
				year: "numeric",
			}),
			items,
		};
	});
}

export function UserActivityFeed({ events }: { events: UserActivityEvent[] }) {
	if (events.length === 0) {
		return (
			<p className="py-6 text-center text-sm text-muted-foreground">
				No recent activity.
			</p>
		);
	}

	const groups = buildMonthGroups(events);

	return (
		<div
			className={cn(
				"relative flex flex-col px-3",
				"before:absolute before:left-[21px] before:top-0 before:h-full before:w-px",
				"before:bg-gradient-to-b before:from-border before:via-border before:to-transparent",
			)}
		>
			{groups.map((group, groupIdx) => (
				<div key={group.label}>
					<div
						className={cn(
							"relative z-10 pl-5",
							groupIdx === 0 ? "pt-4 pb-2" : "pt-5 pb-2",
						)}
					>
						<span className="inline-block rounded-full border border-border bg-surface-1 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
							{group.label}
						</span>
					</div>
					{group.items.map((item) => {
						if (item.kind === "commits") {
							return (
								<CommitsSummaryRow
									key="commits-summary"
									summary={item.summary}
								/>
							);
						}
						if (item.kind === "prs") {
							return (
								<PrGroupRow
									key="prs-group"
									highlighted={item.highlighted}
									summary={item.summary}
								/>
							);
						}
						return <ActivityEventRow key={item.event.id} event={item.event} />;
					})}
				</div>
			))}
		</div>
	);
}

function CommitsSummaryRow({ summary }: { summary: CommitsSummary }) {
	return (
		<div className="flex items-start gap-3 py-2">
			<div className="relative z-10 flex size-5 shrink-0 items-center justify-center rounded-full border border-border bg-card">
				<GitCommitIcon
					size={12}
					strokeWidth={2}
					className="size-3 text-muted-foreground"
				/>
			</div>
			<div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-px">
				<span className="text-[13px] text-muted-foreground">
					Created{" "}
					<span className="font-medium text-foreground">
						{summary.totalCommits} commit
						{summary.totalCommits !== 1 ? "s" : ""}
					</span>{" "}
					in{" "}
					<span className="font-medium text-foreground">
						{summary.repos.length} repositor
						{summary.repos.length !== 1 ? "ies" : "y"}
					</span>
				</span>
				<div className="flex flex-col gap-0.5">
					{summary.repos.map((repo) => (
						<div key={repo.name} className="flex items-center gap-2 text-xs">
							<a
								href={repo.url}
								target="_blank"
								rel="noopener noreferrer"
								className="text-foreground hover:underline"
							>
								{repo.name}
							</a>
							<span className="text-muted-foreground">
								{repo.commits} commit{repo.commits !== 1 ? "s" : ""}
							</span>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

function PrGroupRow({
	highlighted,
	summary,
}: {
	highlighted: UserActivityEvent[];
	summary: PrSummary | null;
}) {
	return (
		<div className="flex flex-col gap-2 py-2">
			{highlighted.map((event) => (
				<ActivityEventRow key={event.id} event={event} />
			))}
			{summary && (
				<div className="flex items-start gap-3 py-2">
					<div className="relative z-10 flex size-5 shrink-0 items-center justify-center rounded-full border border-border bg-card">
						<GitPullRequestIcon
							size={12}
							strokeWidth={2}
							className="size-3 text-muted-foreground"
						/>
					</div>
					<div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-px">
						<span className="text-[13px] text-muted-foreground">
							Opened{" "}
							<span className="font-medium text-foreground">
								{summary.totalPrs} other pull request
								{summary.totalPrs !== 1 ? "s" : ""}
							</span>{" "}
							in{" "}
							<span className="font-medium text-foreground">
								{summary.repos.length} repositor
								{summary.repos.length !== 1 ? "ies" : "y"}
							</span>
						</span>
						<div className="flex flex-col gap-0.5">
							{summary.repos.map((repo) => (
								<div
									key={repo.name}
									className="flex items-center gap-2 text-xs"
								>
									<a
										href={repo.url}
										target="_blank"
										rel="noopener noreferrer"
										className="text-foreground hover:underline"
									>
										{repo.name}
									</a>
									<div className="flex items-center gap-1.5 text-[11px]">
										{repo.closed > 0 && (
											<span className="text-red-500">{repo.closed} closed</span>
										)}
										{repo.merged > 0 && (
											<span className="text-purple-500">
												{repo.merged} merged
											</span>
										)}
										{repo.open > 0 && (
											<span className="text-green-500">{repo.open} open</span>
										)}
									</div>
								</div>
							))}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

function ActivityEventRow({ event }: { event: UserActivityEvent }) {
	const icon = getEventIcon(event);
	const description = getEventDescription(event);
	const hasCard = event.prDetail || event.issueDetail;

	return (
		<div className="flex items-start gap-3 py-2">
			<div className="relative z-10 flex size-5 shrink-0 items-center justify-center rounded-full border border-border bg-card">
				{icon}
			</div>
			<div className="flex min-w-0 flex-1 flex-col gap-1 pt-px">
				<div className="flex items-baseline justify-between gap-2">
					<span className="text-[13px] text-muted-foreground">
						{description}
					</span>
					<span className="shrink-0 text-xs text-muted-foreground">
						{formatRelativeTime(event.createdAt)}
					</span>
				</div>
				{event.prDetail && (
					<PrCard pr={event.prDetail} title={event.title} repo={event.repo} />
				)}
				{event.issueDetail && (
					<IssueCard
						issue={event.issueDetail}
						title={event.title}
						repo={event.repo}
					/>
				)}
				{!hasCard && event.commentBody && (
					<p className="line-clamp-2 text-xs text-muted-foreground/80">
						{event.commentBody}
					</p>
				)}
			</div>
		</div>
	);
}

function PrCard({
	pr,
	title,
	repo,
}: {
	pr: NonNullable<UserActivityEvent["prDetail"]>;
	title: string | null;
	repo: { name: string; url: string };
}) {
	// Build internal link: repo.name is "owner/repo"
	const [owner, repoName] = repo.name.split("/");
	const href =
		owner && repoName ? `/${owner}/${repoName}/pull/${pr.number}` : pr.url;
	const hasDiff = pr.additions > 0 || pr.deletions > 0;
	const stateConfig = getPrStateConfig(pr);
	const StateIcon = stateConfig.icon;

	return (
		<a
			href={href}
			className="flex flex-col gap-2.5 rounded-lg bg-surface-1 p-3"
		>
			<div className="flex items-center gap-1.5 min-w-0">
				<StateIcon
					size={13}
					strokeWidth={2}
					className={cn("shrink-0", stateConfig.color)}
				/>
				<span className="truncate text-xs font-medium text-foreground">
					{title ?? `#${pr.number}`}
				</span>
				{pr.isDraft && (
					<span className="shrink-0 rounded-full border border-border px-1.5 py-px text-[10px] text-muted-foreground">
						Draft
					</span>
				)}
			</div>
			{pr.body && (
				<p className="line-clamp-2 text-xs text-muted-foreground leading-relaxed">
					{pr.body}
				</p>
			)}
			{pr.labels.length > 0 && (
				<div className="flex flex-wrap gap-1">
					{pr.labels.map((label) => (
						<span
							key={label.name}
							className="rounded-full px-1.5 py-px text-[10px] font-medium"
							style={{
								backgroundColor: `#${label.color}20`,
								color: `#${label.color}`,
							}}
						>
							{label.name}
						</span>
					))}
				</div>
			)}
			<div className="flex items-center gap-3 text-[11px] text-muted-foreground">
				{hasDiff && (
					<>
						<span className="text-green-600 dark:text-green-400">
							+{pr.additions.toLocaleString()}
						</span>
						<span className="text-red-600 dark:text-red-400">
							-{pr.deletions.toLocaleString()}
						</span>
					</>
				)}
				{pr.changedFiles > 0 && (
					<span>
						{pr.changedFiles} file{pr.changedFiles !== 1 ? "s" : ""}
					</span>
				)}
				{pr.comments > 0 && (
					<span className="flex items-center gap-1">
						<CommentIcon size={11} strokeWidth={2} />
						{pr.comments}
					</span>
				)}
			</div>
			{pr.headRef && pr.baseRef && pr.state !== "closed" && (
				<div className="mt-auto flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground">
					<span className="min-w-0 shrink truncate rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] font-[550]">
						{pr.headRef}
					</span>
					<span className="shrink-0">→</span>
					<span className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] font-[550]">
						{pr.baseRef}
					</span>
				</div>
			)}
		</a>
	);
}

function IssueCard({
	issue,
	title,
	repo,
}: {
	issue: NonNullable<UserActivityEvent["issueDetail"]>;
	title: string | null;
	repo: { name: string; url: string };
}) {
	const [owner, repoName] = repo.name.split("/");
	const href =
		owner && repoName
			? `/${owner}/${repoName}/issues/${issue.number}`
			: issue.url;

	return (
		<a
			href={href}
			className="flex flex-col gap-2.5 rounded-lg bg-surface-1 p-3"
		>
			<div className="flex items-center gap-1.5 min-w-0">
				<IssuesIcon
					size={13}
					strokeWidth={2}
					className={cn(
						"shrink-0",
						issue.state === "open"
							? "text-green-600 dark:text-green-400"
							: "text-violet-600 dark:text-violet-400",
					)}
				/>
				<span className="truncate text-xs font-medium text-foreground">
					{title ?? `#${issue.number}`}
				</span>
			</div>
			{issue.body && (
				<p className="line-clamp-2 text-xs text-muted-foreground leading-relaxed">
					{issue.body}
				</p>
			)}
			{issue.comments > 0 && (
				<div className="flex items-center gap-1 text-[11px] text-muted-foreground">
					<CommentIcon size={11} strokeWidth={2} />
					{issue.comments}
				</div>
			)}
		</a>
	);
}

function getEventIcon(event: UserActivityEvent) {
	const cls = "size-3 text-muted-foreground";
	const sw = 2;

	switch (event.type) {
		case "PushEvent":
			return <GitCommitIcon size={12} strokeWidth={sw} className={cls} />;
		case "CreateEvent":
		case "DeleteEvent":
			return <GitBranchIcon size={12} strokeWidth={sw} className={cls} />;
		case "PullRequestEvent":
		case "PullRequestReviewEvent":
			return <GitPullRequestIcon size={12} strokeWidth={sw} className={cls} />;
		case "IssuesEvent":
			return <IssuesIcon size={12} strokeWidth={sw} className={cls} />;
		case "IssueCommentEvent":
			return <CommentIcon size={12} strokeWidth={sw} className={cls} />;
		case "WatchEvent":
			return <StarIcon size={12} strokeWidth={sw} className={cls} />;
		case "ForkEvent":
			return <CodeIcon size={12} strokeWidth={sw} className={cls} />;
		case "ReleaseEvent":
			return <CircleIcon size={12} strokeWidth={sw} className={cls} />;
		default:
			return <CircleIcon size={12} strokeWidth={sw} className={cls} />;
	}
}

function getEventDescription(event: UserActivityEvent) {
	const repo = (
		<a
			href={event.repo.url}
			target="_blank"
			rel="noopener noreferrer"
			className="font-medium text-foreground hover:underline"
		>
			{event.repo.name}
		</a>
	);

	switch (event.type) {
		case "CreateEvent":
			if (event.refType === "repository") {
				return <>Created repository {repo}</>;
			}
			return (
				<>
					Created {event.refType}{" "}
					<span className="font-medium text-foreground">{event.ref}</span> in{" "}
					{repo}
				</>
			);
		case "DeleteEvent":
			return (
				<>
					Deleted {event.refType}{" "}
					<span className="font-medium text-foreground">{event.ref}</span> in{" "}
					{repo}
				</>
			);
		case "PullRequestEvent":
			return (
				<>
					{capitalizeFirst(event.action)} PR{" "}
					<span className="font-medium text-foreground">{event.title}</span> in{" "}
					{repo}
				</>
			);
		case "PullRequestReviewEvent":
			return (
				<>
					Reviewed PR{" "}
					<span className="font-medium text-foreground">{event.title}</span> in{" "}
					{repo}
				</>
			);
		case "IssuesEvent":
			return (
				<>
					{capitalizeFirst(event.action)} issue{" "}
					<span className="font-medium text-foreground">{event.title}</span> in{" "}
					{repo}
				</>
			);
		case "IssueCommentEvent":
			return (
				<>
					Commented on{" "}
					<span className="font-medium text-foreground">{event.title}</span> in{" "}
					{repo}
				</>
			);
		case "WatchEvent":
			return <>Starred {repo}</>;
		case "ForkEvent":
			return <>Forked {repo}</>;
		case "ReleaseEvent":
			return (
				<>
					{capitalizeFirst(event.action)} release{" "}
					<span className="font-medium text-foreground">{event.title}</span> in{" "}
					{repo}
				</>
			);
		default:
			return (
				<>
					{event.type.replace("Event", "")} in {repo}
				</>
			);
	}
}

function capitalizeFirst(str: string | null): string {
	if (!str) return "";
	return str.charAt(0).toUpperCase() + str.slice(1);
}
