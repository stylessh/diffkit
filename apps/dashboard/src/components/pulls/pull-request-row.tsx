import { CommentIcon, ViewIcon } from "@diffkit/icons";
import { Spinner } from "@diffkit/ui/components/spinner";
import { cn } from "@diffkit/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { lazy, memo, Suspense, useState } from "react";
import {
	listRowClassName,
	RepoChip,
	RowAvatar,
	RowLabels,
	RowNumber,
	RowStateIcon,
	RowTime,
} from "#/components/shared/list-row";
import { formatRelativeTime } from "#/lib/format-relative-time";
import {
	type GitHubQueryScope,
	githubPullCommentsQueryOptions,
} from "#/lib/github.query";
import type { PullSummary } from "#/lib/github.types";
import { getPrStateConfig } from "#/lib/pr-state";
import { preloadRouteOnce } from "#/lib/route-preload";

const Markdown = lazy(() =>
	import("@diffkit/ui/components/markdown").then((mod) => ({
		default: mod.Markdown,
	})),
);

export const PullRequestRow = memo(function PullRequestRow({
	pr,
	scope,
	showRepository = true,
}: {
	pr: PullSummary;
	scope: GitHubQueryScope;
	/** Hide the repository chip in lists scoped to one repository. */
	showRepository?: boolean;
}) {
	const { icon: Icon, color } = getPrStateConfig(pr);
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

	const time = formatRelativeTime(pr.updatedAt, undefined, { compact: true });

	return (
		<div>
			<Link
				to={href}
				preload={false}
				onMouseEnter={preloadDetail}
				onFocus={preloadDetail}
				onTouchStart={preloadDetail}
				className={cn(
					listRowClassName,
					"hover:[&:not(:has([data-action]:hover))]:before:bg-row-hover",
					expanded && "before:bg-row-selected",
				)}
			>
				<RowStateIcon className={color}>
					<Icon size={14} strokeWidth={2} />
				</RowStateIcon>
				<RowNumber number={pr.number} />
				<div className="flex min-w-0 flex-1 flex-col gap-1 md:flex-row md:items-center md:gap-2">
					<p
						title={pr.title}
						className="text-[13px] font-medium text-foreground md:truncate"
					>
						{pr.title}
					</p>
					{pr.comments > 0 && (
						<span
							className="hidden shrink-0 items-center gap-1 text-xs tabular-nums text-muted-foreground md:flex"
							title={`${pr.comments} comments`}
						>
							<CommentIcon size={12} strokeWidth={2} />
							{pr.comments}
						</span>
					)}
					<p className="flex min-w-0 items-center gap-1 truncate text-xs text-muted-foreground md:hidden">
						<span className="truncate">{pr.repository.fullName}</span>
						<span className="tabular-nums">#{pr.number}</span>
						<span aria-hidden>·</span>
						<span className="tabular-nums">{time}</span>
					</p>
				</div>
				<div className="hidden min-w-0 shrink items-center gap-1 md:flex">
					<button
						type="button"
						data-action
						aria-expanded={expanded}
						onClick={(e) => {
							e.preventDefault();
							setExpanded((v) => !v);
						}}
						className="mr-1 flex h-6 shrink-0 items-center gap-1 rounded-full bg-button px-2 text-xs font-medium text-text-header opacity-0 shadow-button transition-[opacity,background-color] hover:bg-button-hover hover:text-foreground group-hover/row:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100"
					>
						{expanded && commentsQuery.isPending ? (
							<Spinner size={12} />
						) : (
							<ViewIcon size={12} strokeWidth={2} />
						)}
						Preview
					</button>
					<RowLabels labels={pr.labels} />
					{showRepository ? (
						<RepoChip fullName={pr.repository.fullName} />
					) : null}
				</div>
				<span className="hidden shrink-0 items-center gap-2 md:flex">
					<RowAvatar actor={pr.author} />
					<RowTime>{time}</RowTime>
				</span>
			</Link>

			{expanded && commentsQuery.data && (
				<div className="relative ml-[19px] pt-3 pr-3 pb-2 pl-[18px] md:ml-[42px] before:absolute before:top-0 before:left-0 before:h-full before:w-px before:bg-[linear-gradient(to_bottom,var(--color-border)_80%,transparent)]">
					{commentsQuery.data.length === 0 && (
						<p className="text-xs text-muted-foreground">No comments yet.</p>
					)}
					{commentsQuery.data.length > 0 && (
						<div className="flex flex-col gap-6">
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
												className="size-4 rounded-full ring-[0.5px] ring-chip-border"
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
										<Suspense
											fallback={
												<p className="text-xs text-muted-foreground">
													{comment.body.slice(0, 200)}
												</p>
											}
										>
											<Markdown className="text-muted-foreground">
												{comment.body}
											</Markdown>
										</Suspense>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			)}
		</div>
	);
});
