import {
	CommentIcon,
	GitMergeIcon,
	GitPullRequestClosedIcon,
	GitPullRequestDraftIcon,
	GitPullRequestIcon,
	IssuesIcon,
	ReviewsIcon,
	ViewIcon,
} from "@quickhub/icons";
import { Markdown } from "@quickhub/ui/components/markdown";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { ComponentType } from "react";
import { useState } from "react";
import { DashboardContentLoading } from "#/components/layouts/dashboard-content-loading";
import {
	type GitHubQueryScope,
	githubMyIssuesQueryOptions,
	githubMyPullsQueryOptions,
	githubPullCommentsQueryOptions,
} from "#/lib/github.query";
import type { PullSummary } from "#/lib/github.types";
import { useHasMounted } from "#/lib/use-has-mounted";

export const Route = createFileRoute("/_protected/")({
	component: OverviewPage,
});

function OverviewPage() {
	const { user } = Route.useRouteContext();
	const scope = { userId: user.id };
	const hasMounted = useHasMounted();
	const pullsQuery = useQuery({
		...githubMyPullsQueryOptions(scope),
		enabled: hasMounted,
	});
	const issuesQuery = useQuery({
		...githubMyIssuesQueryOptions(scope),
		enabled: hasMounted,
	});

	if (pullsQuery.error) throw pullsQuery.error;
	if (issuesQuery.error) throw issuesQuery.error;

	if (pullsQuery.data && issuesQuery.data) {
		const pulls = pullsQuery.data;
		const issues = issuesQuery.data;

		const metrics: MetricCardProps[] = [
			{
				icon: GitPullRequestIcon,
				label: "Open Pull Requests",
				value: pulls.authored.length,
				to: "/pulls",
			},
			{
				icon: IssuesIcon,
				label: "Open Issues",
				value: issues.assigned.length,
				to: "/issues",
			},
			{
				icon: ReviewsIcon,
				label: "Review Requests",
				value: pulls.reviewRequested.length,
				to: "/reviews",
			},
		];

		const recentPulls = pulls.authored.slice(0, 10);

		return (
			<div className="h-full overflow-auto px-6 py-10">
				<div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
					<section>
						<div className="grid grid-cols-3 gap-2">
							{metrics.map((m) => (
								<MetricCard key={m.label} {...m} />
							))}
						</div>
					</section>

					<section className="flex flex-col gap-2">
						<h2 className="text-sm font-medium text-muted-foreground">
							Recent Pull Requests
						</h2>
						{recentPulls.length === 0 ? (
							<p className="py-4 text-center text-sm text-muted-foreground">
								No pull requests yet.
							</p>
						) : (
							<div className="-mx-3 flex flex-col gap-1">
								{recentPulls.map((pr) => (
									<PullRequestRow key={pr.id} pr={pr} scope={scope} />
								))}
							</div>
						)}
					</section>
				</div>
			</div>
		);
	}

	if (hasMounted && (pullsQuery.isPending || issuesQuery.isPending)) {
		return <DashboardContentLoading />;
	}

	return null;
}

type MetricCardProps = {
	icon: ComponentType<{ size?: number; strokeWidth?: number }>;
	label: string;
	value: number;
	to?: string;
};

function MetricCard({ icon: Icon, label, value, to }: MetricCardProps) {
	const content = (
		<div className="flex items-center gap-3 rounded-xl bg-surface-1 px-3.5 py-3 transition-colors hover:bg-surface-2">
			<div className="flex shrink-0 items-center justify-center text-muted-foreground">
				<Icon size={20} strokeWidth={1.75} />
			</div>
			<div className="min-w-0">
				<p className="font-semibold tabular-nums leading-tight">{value}</p>
				<p className="truncate text-xs text-muted-foreground">{label}</p>
			</div>
		</div>
	);

	if (to) {
		return (
			<Link to={to} className="block">
				{content}
			</Link>
		);
	}

	return content;
}

function formatRelativeTime(dateStr: string): string {
	const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
	if (seconds < 60) return "just now";
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	if (days < 30) return `${days}d ago`;
	const months = Math.floor(days / 30);
	if (months < 12) return `${months}mo ago`;
	const years = Math.floor(months / 12);
	return `${years}y ago`;
}

function getPrStateProps(pr: PullSummary) {
	if (pr.isDraft) {
		return { icon: GitPullRequestDraftIcon, color: "text-muted-foreground" };
	}
	if (pr.mergedAt) {
		return { icon: GitMergeIcon, color: "text-purple-500" };
	}
	if (pr.state === "closed") {
		return { icon: GitPullRequestClosedIcon, color: "text-red-500" };
	}
	return { icon: GitPullRequestIcon, color: "text-green-500" };
}

function PullRequestRow({
	pr,
	scope,
}: {
	pr: PullSummary;
	scope: GitHubQueryScope;
}) {
	const { icon: Icon, color } = getPrStateProps(pr);
	const href = `/${pr.repository.owner}/${pr.repository.name}/pull/${pr.number}`;
	const [expanded, setExpanded] = useState(false);

	const commentsQuery = useQuery({
		...githubPullCommentsQueryOptions(scope, {
			owner: pr.repository.owner,
			repo: pr.repository.name,
			pullNumber: pr.number,
		}),
		enabled: expanded,
	});

	return (
		<div className="rounded-lg">
			<Link
				to={href}
				className={`group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:[&:not(:has([data-action]:hover))]:bg-surface-1 ${expanded ? "bg-surface-1" : ""}`}
			>
				<div className={`mt-[3px] shrink-0 ${color}`}>
					<Icon size={16} strokeWidth={2} />
				</div>
				<div className="min-w-0 flex-1 flex flex-col gap-1">
					<p className="truncate text-sm font-medium">{pr.title}</p>
					<p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
						{pr.repository.fullName} #{pr.number}
						{pr.author && (
							<>
								<span>·</span>
								<img
									src={pr.author.avatarUrl}
									alt={pr.author.login}
									className="size-3.5 rounded-full border border-border"
								/>
								<span>{pr.author.login}</span>
							</>
						)}
						<span>·</span>
						<span>{formatRelativeTime(pr.updatedAt)}</span>
					</p>
				</div>
				<div className="mt-[3px] flex shrink-0 items-center gap-4">
					<button
						type="button"
						data-action
						onClick={(e) => {
							e.preventDefault();
							setExpanded((v) => !v);
						}}
						className="flex items-center gap-1 rounded-md border bg-surface-1 px-2 py-0.5 text-xs font-medium text-muted-foreground opacity-0 transition-opacity hover:bg-surface-2 hover:text-foreground group-hover:opacity-100"
					>
						{expanded && commentsQuery.isPending ? (
							<svg
								className="size-3 animate-spin"
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
						) : (
							<ViewIcon size={13} strokeWidth={2} />
						)}
						Preview
					</button>
					{pr.comments > 0 && (
						<span className="flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
							<CommentIcon size={13} strokeWidth={2} />
							{pr.comments}
						</span>
					)}
				</div>
			</Link>

			{expanded && commentsQuery.data && (
				<div className="relative ml-[31px] pb-2 pl-4 pr-3 pt-4 before:absolute before:left-0 before:top-0 before:h-full before:w-px before:bg-[linear-gradient(to_bottom,var(--color-border)_80%,transparent)]">
					{commentsQuery.data && commentsQuery.data.length === 0 && (
						<p className="text-xs text-muted-foreground">No comments yet.</p>
					)}
					{commentsQuery.data && commentsQuery.data.length > 0 && (
						<div className="flex flex-col gap-8">
							{commentsQuery.data.map((comment) => (
								<div key={comment.id} className="flex flex-col gap-1">
									<div className="flex items-center gap-1.5">
										{comment.author && (
											<img
												src={comment.author.avatarUrl}
												alt={comment.author.login}
												className="size-4 rounded-full border border-border"
											/>
										)}
										<span className="text-xs font-medium">
											{comment.author?.login ?? "Unknown"}
										</span>
										<span className="text-xs text-muted-foreground">
											{formatRelativeTime(comment.createdAt)}
										</span>
									</div>
									<div className="line-clamp-3">
										<Markdown className="text-muted-foreground">
											{comment.body}
										</Markdown>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
