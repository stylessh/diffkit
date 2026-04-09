import { IssuesIcon } from "@diffkit/icons";
import { Markdown } from "@diffkit/ui/components/markdown";
import { Skeleton } from "@diffkit/ui/components/skeleton";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@diffkit/ui/components/tooltip";
import { cn } from "@diffkit/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { formatRelativeTime } from "#/components/pulls/pull-request-row";
import { githubIssuePageQueryOptions } from "#/lib/github.query";
import type { GitHubActor, IssueDetail } from "#/lib/github.types";
import { buildSeo, formatPageTitle, summarizeText } from "#/lib/seo";
import { useHasMounted } from "#/lib/use-has-mounted";
import { useRegisterTab } from "#/lib/use-register-tab";

export const Route = createFileRoute(
	"/_protected/$owner/$repo/issues/$issueId",
)({
	loader: async ({ context, params }) => {
		const issueNumber = Number(params.issueId);
		const scope = { userId: context.user.id };
		const pageOptions = githubIssuePageQueryOptions(scope, {
			owner: params.owner,
			repo: params.repo,
			issueNumber,
		});

		const cachedData = context.queryClient.getQueryData(pageOptions.queryKey);
		if (cachedData !== undefined) {
			return cachedData;
		}

		return context.queryClient.ensureQueryData(pageOptions);
	},
	head: ({ loaderData, match, params }) => {
		const issue = loaderData?.detail;
		const issueTitle = issue
			? formatPageTitle(`Issue #${issue.number}: ${issue.title}`)
			: formatPageTitle(`Issue #${params.issueId}`);

		return buildSeo({
			path: match.pathname,
			title: issueTitle,
			description: issue
				? summarizeText(
						issue.body,
						`Private GitHub issue #${issue.number} in ${params.owner}/${params.repo}.`,
					)
				: `Private GitHub issue #${params.issueId} in ${params.owner}/${params.repo}.`,
			robots: "noindex",
		});
	},
	component: IssueDetailPage,
});

function getIssueStateConfig(issue: IssueDetail) {
	if (issue.state === "closed") {
		if (issue.stateReason === "not_planned") {
			return {
				color: "text-muted-foreground",
				label: "Closed",
				badgeClass: "bg-muted text-muted-foreground",
			};
		}
		return {
			color: "text-purple-500",
			label: "Closed",
			badgeClass: "bg-purple-500/10 text-purple-500",
		};
	}
	return {
		color: "text-green-500",
		label: "Open",
		badgeClass: "bg-green-500/10 text-green-500",
	};
}

function IssueDetailPage() {
	const { user } = Route.useRouteContext();
	const { owner, repo, issueId } = Route.useParams();
	const issueNumber = Number(issueId);
	const scope = { userId: user.id };
	const hasMounted = useHasMounted();

	const pageQuery = useQuery({
		...githubIssuePageQueryOptions(scope, { owner, repo, issueNumber }),
		enabled: hasMounted,
	});

	const issue = pageQuery.data?.detail;
	const comments = pageQuery.data?.comments;

	useRegisterTab(
		issue
			? {
					type: "issue",
					title: issue.title,
					number: issue.number,
					url: `/${owner}/${repo}/issues/${issueId}`,
					repo: `${owner}/${repo}`,
					iconColor: getIssueStateConfig(issue).color,
				}
			: null,
	);

	if (pageQuery.error) throw pageQuery.error;
	if (!issue) return <IssueDetailPageSkeleton />;

	const stateConfig = getIssueStateConfig(issue);

	return (
		<div className="h-full overflow-auto">
			<div className="mx-auto grid max-w-7xl gap-16 px-6 py-10 xl:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]">
				{/* Left: Issue content */}
				<div className="flex min-w-0 flex-col gap-8">
					{/* Header */}
					<div className="flex flex-col gap-3">
						<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
							<Link
								to="/issues"
								className="transition-colors hover:text-foreground"
							>
								Issues
							</Link>
							<span>/</span>
							<span>
								{owner}/{repo}
							</span>
							<span>/</span>
							<span>#{issue.number}</span>
						</div>

						<div className="flex items-start gap-3">
							<div className={cn("mt-1 shrink-0", stateConfig.color)}>
								<IssuesIcon size={20} strokeWidth={2} />
							</div>
							<div className="flex min-w-0 flex-col gap-2">
								<h1 className="text-xl font-semibold tracking-tight">
									{issue.title}
								</h1>
								<div className="flex flex-wrap items-center gap-2">
									<span
										className={cn(
											"inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
											stateConfig.badgeClass,
										)}
									>
										{stateConfig.label}
									</span>
									{issue.author && (
										<span className="flex items-center gap-1.5 text-sm text-muted-foreground">
											<img
												src={issue.author.avatarUrl}
												alt={issue.author.login}
												className="size-4 rounded-full border border-border"
											/>
											<span className="font-medium text-foreground">
												{issue.author.login}
											</span>
											<span>opened {formatRelativeTime(issue.createdAt)}</span>
										</span>
									)}
								</div>
							</div>
						</div>
					</div>

					{/* Body */}
					{issue.body ? (
						<div className="rounded-lg border bg-surface-0 p-5">
							<Markdown>{issue.body}</Markdown>
						</div>
					) : (
						<div className="rounded-lg border bg-surface-0 p-5">
							<p className="text-sm text-muted-foreground italic">
								No description provided.
							</p>
						</div>
					)}

					{/* Activity / Comments */}
					<div className="flex flex-col">
						<div className="flex items-center justify-between gap-2 rounded-lg bg-surface-1 px-4 py-2.5">
							<h2 className="text-xs font-medium">Activity</h2>
							{comments && (
								<span className="text-xs tabular-nums text-muted-foreground">
									{comments.length}
								</span>
							)}
						</div>

						{pageQuery.isFetching && !comments && (
							<div className="flex items-center justify-center py-8">
								<svg
									className="size-4 animate-spin text-muted-foreground"
									viewBox="0 0 16 16"
									fill="none"
									aria-hidden="true"
								>
									<circle
										cx="8"
										cy="8"
										r="6.5"
										stroke="currentColor"
										strokeWidth="2"
										opacity="0.25"
									/>
									<path
										d="M14.5 8a6.5 6.5 0 0 0-6.5-6.5"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
									/>
								</svg>
							</div>
						)}

						{comments && comments.length === 0 && (
							<p className="py-4 text-sm text-muted-foreground">
								No comments yet.
							</p>
						)}

						{comments && comments.length > 0 && (
							<div className="relative flex flex-col pl-8 before:absolute before:left-4 before:top-0 before:h-full before:w-px before:bg-[linear-gradient(to_bottom,var(--color-border)_80%,transparent)]">
								{comments.map((comment, i) => (
									<div
										key={comment.id}
										className={cn(
											"flex flex-col gap-1 py-4",
											i === 0 && "pt-5",
										)}
									>
										<div className="flex items-center gap-1.5">
											{comment.author ? (
												<img
													src={comment.author.avatarUrl}
													alt={comment.author.login}
													className="size-4 rounded-full border border-border"
												/>
											) : (
												<div className="size-4 rounded-full bg-surface-2" />
											)}
											<span className="text-xs font-medium">
												{comment.author?.login ?? "Unknown"}
											</span>
											<span className="text-xs text-muted-foreground">
												{formatRelativeTime(comment.createdAt)}
											</span>
										</div>
										<Markdown className="text-muted-foreground">
											{comment.body}
										</Markdown>
									</div>
								))}
							</div>
						)}

						{/* Comment input */}
						<div className="mt-6">
							<CommentBox />
						</div>
					</div>
				</div>

				{/* Right sidebar: Metadata */}
				<aside className="flex h-fit flex-col gap-6 xl:sticky xl:top-10">
					{/* Assignees */}
					<SidebarSection title="Assignees">
						{issue.assignees.length > 0 ? (
							<div className="flex flex-col gap-2">
								{issue.assignees.map((assignee) => (
									<div key={assignee.login} className="flex items-center gap-2">
										<img
											src={assignee.avatarUrl}
											alt={assignee.login}
											className="size-5 rounded-full border border-border"
										/>
										<span className="text-sm">{assignee.login}</span>
									</div>
								))}
							</div>
						) : (
							<p className="text-xs text-muted-foreground">No one assigned</p>
						)}
					</SidebarSection>

					{/* Labels */}
					<SidebarSection title="Labels">
						{issue.labels.length > 0 ? (
							<div className="flex flex-wrap gap-1.5">
								{issue.labels.map((label) => (
									<span
										key={label.name}
										className="label-pill rounded-full px-2.5 py-0.5 text-xs font-medium"
										style={
											{
												"--label-color": `#${label.color}`,
											} as React.CSSProperties
										}
									>
										{label.name}
									</span>
								))}
							</div>
						) : (
							<p className="text-xs text-muted-foreground">No labels</p>
						)}
					</SidebarSection>

					{/* Participants */}
					<SidebarSection title="Participants">
						<ParticipantsList issue={issue} comments={comments ?? []} />
					</SidebarSection>

					{/* Milestone */}
					{issue.milestone && (
						<SidebarSection title="Milestone">
							<div className="flex flex-col gap-1 text-xs">
								<span className="font-medium text-foreground">
									{issue.milestone.title}
								</span>
								{issue.milestone.dueOn && (
									<span className="text-muted-foreground">
										Due {formatRelativeTime(issue.milestone.dueOn)}
									</span>
								)}
							</div>
						</SidebarSection>
					)}

					{/* Details */}
					<SidebarSection title="Details">
						<div className="flex flex-col gap-2 text-xs">
							<DetailRow label="Created">
								{formatRelativeTime(issue.createdAt)}
							</DetailRow>
							<DetailRow label="Updated">
								{formatRelativeTime(issue.updatedAt)}
							</DetailRow>
							{issue.closedAt && (
								<DetailRow label="Closed">
									{formatRelativeTime(issue.closedAt)}
								</DetailRow>
							)}
							<DetailRow label="Comments">
								<span className="tabular-nums">{issue.comments}</span>
							</DetailRow>
						</div>
					</SidebarSection>
				</aside>
			</div>
		</div>
	);
}

function SidebarSection({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex flex-col gap-2.5">
			<h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
				{title}
			</h3>
			{children}
		</div>
	);
}

function DetailRow({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex items-center justify-between gap-4">
			<span className="text-muted-foreground">{label}</span>
			<span className="text-foreground">{children}</span>
		</div>
	);
}

function ParticipantsList({
	issue,
	comments,
}: {
	issue: IssueDetail;
	comments: Array<{ author: GitHubActor | null }>;
}) {
	const seen = new Set<string>();
	const participants: GitHubActor[] = [];

	const addActor = (actor: GitHubActor | null) => {
		if (actor && !seen.has(actor.login)) {
			seen.add(actor.login);
			participants.push(actor);
		}
	};

	addActor(issue.author);
	for (const assignee of issue.assignees) {
		addActor(assignee);
	}
	for (const comment of comments) {
		addActor(comment.author);
	}

	if (participants.length === 0) {
		return <p className="text-xs text-muted-foreground">No participants yet</p>;
	}

	return (
		<div className="group/participants flex items-center">
			{participants.map((actor, i) => (
				<Tooltip key={actor.login}>
					<TooltipTrigger asChild>
						<img
							src={actor.avatarUrl}
							alt={actor.login}
							className="size-6 rounded-full border-2 border-card transition-[margin] duration-200 group-hover/participants:ml-0"
							style={i > 0 ? { marginLeft: -6 } : undefined}
						/>
					</TooltipTrigger>
					<TooltipContent>{actor.login}</TooltipContent>
				</Tooltip>
			))}
		</div>
	);
}

function CommentBox() {
	const [value, setValue] = useState("");

	return (
		<div className="flex flex-col gap-2 rounded-lg border bg-surface-0 p-3">
			<textarea
				value={value}
				onChange={(e) => setValue(e.target.value)}
				placeholder="Leave a comment..."
				rows={3}
				className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
			/>
			<div className="flex justify-end">
				<button
					type="button"
					disabled={!value.trim()}
					className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity disabled:opacity-40"
				>
					Send
				</button>
			</div>
		</div>
	);
}

function IssueDetailPageSkeleton() {
	return (
		<div className="h-full overflow-auto">
			<div className="mx-auto grid max-w-7xl gap-16 px-6 py-10 xl:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]">
				<div className="flex min-w-0 flex-col gap-8">
					<div className="flex flex-col gap-3">
						<Skeleton className="h-4 w-48 rounded-md" />
						<div className="flex items-start gap-3">
							<Skeleton className="mt-1 size-5 rounded-full" />
							<div className="flex min-w-0 flex-1 flex-col gap-2">
								<Skeleton className="h-8 w-3/4 rounded-md" />
								<div className="flex gap-2">
									<Skeleton className="h-6 w-16 rounded-full" />
									<Skeleton className="h-6 w-48 rounded-full" />
								</div>
							</div>
						</div>
					</div>

					<div className="flex flex-wrap gap-1.5">
						<Skeleton className="h-6 w-20 rounded-full" />
						<Skeleton className="h-6 w-24 rounded-full" />
					</div>

					<div className="rounded-lg border bg-surface-0 p-5">
						<div className="flex flex-col gap-2">
							<Skeleton className="h-4 w-full rounded-md" />
							<Skeleton className="h-4 w-[92%] rounded-md" />
							<Skeleton className="h-4 w-[78%] rounded-md" />
							<Skeleton className="h-4 w-[66%] rounded-md" />
						</div>
					</div>

					<div className="flex flex-col">
						<div className="flex items-center justify-between gap-2 rounded-lg bg-surface-1 px-4 py-2.5">
							<Skeleton className="h-4 w-14 rounded-md" />
							<Skeleton className="h-4 w-6 rounded-md" />
						</div>
						<div className="relative flex flex-col gap-5 py-5 pl-8 before:absolute before:left-4 before:top-0 before:h-full before:w-px before:bg-[linear-gradient(to_bottom,var(--color-border)_80%,transparent)]">
							{["activity-1", "activity-2", "activity-3"].map((key) => (
								<div key={key} className="flex flex-col gap-2">
									<div className="flex items-center gap-2">
										<Skeleton className="size-4 rounded-full" />
										<Skeleton className="h-4 w-24 rounded-md" />
										<Skeleton className="h-4 w-16 rounded-md" />
									</div>
									<Skeleton className="h-4 w-[88%] rounded-md" />
									<Skeleton className="h-4 w-[72%] rounded-md" />
								</div>
							))}
						</div>
					</div>
				</div>

				<aside className="flex h-fit flex-col gap-6 xl:sticky xl:top-10">
					{["meta-1", "meta-2", "meta-3", "meta-4"].map((key) => (
						<div key={key} className="flex flex-col gap-2.5">
							<Skeleton className="h-4 w-24 rounded-md" />
							<div className="flex flex-col gap-2">
								<Skeleton className="h-4 w-full rounded-md" />
								<Skeleton className="h-4 w-[85%] rounded-md" />
							</div>
						</div>
					))}
				</aside>
			</div>
		</div>
	);
}
