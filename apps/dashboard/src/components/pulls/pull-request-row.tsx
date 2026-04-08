import {
	CommentIcon,
	GitMergeIcon,
	GitPullRequestClosedIcon,
	GitPullRequestDraftIcon,
	GitPullRequestIcon,
	ViewIcon,
} from "@quickhub/icons";
import { Markdown } from "@quickhub/ui/components/markdown";
import { cn } from "@quickhub/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
	type GitHubQueryScope,
	githubPullCommentsQueryOptions,
} from "#/lib/github.query";
import type { PullSummary } from "#/lib/github.types";
import { preloadRouteOnce } from "#/lib/route-preload";

export function formatRelativeTime(dateStr: string): string {
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

export function PullRequestRow({
	pr,
	scope,
}: {
	pr: PullSummary;
	scope: GitHubQueryScope;
}) {
	const { icon: Icon, color } = getPrStateProps(pr);
	const href = `/${pr.repository.owner}/${pr.repository.name}/pull/${pr.number}`;
	const [expanded, setExpanded] = useState(false);
	const router = useRouter();
	const preloadDetail = () => {
		void preloadRouteOnce(router, href);
	};

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
				preload={false}
				onMouseEnter={preloadDetail}
				onFocus={preloadDetail}
				onTouchStart={preloadDetail}
				className={cn(
					"group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:[&:not(:has([data-action]:hover))]:bg-surface-1",
					expanded && "bg-surface-1",
				)}
			>
				<div className={cn("mt-[3px] shrink-0", color)}>
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
					{commentsQuery.data.length === 0 && (
						<p className="text-xs text-muted-foreground">No comments yet.</p>
					)}
					{commentsQuery.data.length > 0 && (
						<div className="flex flex-col gap-8">
							{commentsQuery.data.map((comment, i) => (
								<div
									key={comment.id}
									className={cn(
										"flex flex-col gap-1",
										i === commentsQuery.data.length - 1 && "pb-4",
									)}
								>
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
