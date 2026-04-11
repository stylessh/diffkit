import {
	ChevronDownIcon,
	CircleIcon,
	EditIcon,
	GitPullRequestIcon,
	IssuesIcon,
	ReviewsIcon,
	UserAddIcon,
} from "@diffkit/icons";
import { Markdown } from "@diffkit/ui/components/markdown";
import { cn } from "@diffkit/ui/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import {
	DetailActivityHeader,
	DetailCommentBox,
} from "#/components/details/detail-activity";
import { LabelPill } from "#/components/details/label-pill";
import { formatRelativeTime } from "#/lib/format-relative-time";
import { getCommentPage, getTimelineEventPage } from "#/lib/github.functions";
import type {
	CommentPagination,
	EventPagination,
	IssueComment,
	IssuePageData,
	TimelineEvent,
} from "#/lib/github.types";

const WINDOW_THRESHOLD = 25;
const EDGE_SIZE = 10;
const LOAD_MORE_CHUNK = 20;

type IssueTimelineItem =
	| { type: "comment"; date: string; data: IssueComment }
	| { type: "event"; date: string; data: TimelineEvent };

function useWindowedTimeline<T>(
	items: T[],
	pagination?: {
		commentPagination?: CommentPagination;
		eventPagination?: EventPagination;
		pageQueryKey: readonly unknown[];
		owner: string;
		repo: string;
		issueNumber: number;
	},
) {
	const queryClient = useQueryClient();
	const [revealedCount, setRevealedCount] = useState(0);
	const [isFetchingPage, setIsFetchingPage] = useState(false);
	const loadedCommentPagesRef = useRef<Set<number>>(new Set());
	const loadedEventPagesRef = useRef<Set<number>>(new Set());
	const hasMoreEventsRef = useRef(
		pagination?.eventPagination?.hasMore ?? false,
	);

	const totalCommentPages = pagination?.commentPagination
		? Math.max(
				1,
				Math.ceil(
					pagination.commentPagination.totalCount /
						pagination.commentPagination.perPage,
				),
			)
		: 1;

	// Sync loaded pages from pagination data
	if (pagination?.commentPagination) {
		for (const p of pagination.commentPagination.loadedPages) {
			loadedCommentPagesRef.current.add(p);
		}
	}
	if (pagination?.eventPagination) {
		for (const p of pagination.eventPagination.loadedPages) {
			loadedEventPagesRef.current.add(p);
		}
		hasMoreEventsRef.current = pagination.eventPagination.hasMore;
	}

	const hasUnfetchedCommentPages =
		totalCommentPages > 1 &&
		loadedCommentPagesRef.current.size < totalCommentPages;
	const hasUnfetchedEventPages = hasMoreEventsRef.current;
	const hasUnfetchedPages = hasUnfetchedCommentPages || hasUnfetchedEventPages;

	const needsWindowing = items.length > WINDOW_THRESHOLD || hasUnfetchedPages;

	const clientHiddenCount = needsWindowing
		? Math.max(0, items.length - EDGE_SIZE * 2 - revealedCount)
		: 0;

	const hiddenCount = clientHiddenCount;

	const visibleItems =
		needsWindowing && clientHiddenCount > 0
			? [
					...items.slice(0, EDGE_SIZE + revealedCount),
					...items.slice(items.length - EDGE_SIZE),
				]
			: items;

	const showLoadMore = needsWindowing && (hiddenCount > 0 || hasUnfetchedPages);
	const loadMoreIndex = showLoadMore ? EDGE_SIZE + revealedCount : -1;

	const loadMore = useCallback(() => {
		// If we have client-side hidden items, reveal a chunk first
		if (clientHiddenCount > 0) {
			setRevealedCount((prev) => prev + LOAD_MORE_CHUNK);
			return;
		}

		if (!pagination) return;

		const hasMoreComments = hasUnfetchedCommentPages;
		const hasMoreEvents = hasUnfetchedEventPages;

		if (!hasMoreComments && !hasMoreEvents) return;

		setIsFetchingPage(true);

		const fetches: Promise<void>[] = [];

		// Fetch next comment page
		if (hasMoreComments) {
			let nextPage = -1;
			for (let p = 2; p < totalCommentPages; p++) {
				if (!loadedCommentPagesRef.current.has(p)) {
					nextPage = p;
					break;
				}
			}
			if (nextPage !== -1) {
				fetches.push(
					getCommentPage({
						data: {
							owner: pagination.owner,
							repo: pagination.repo,
							issueNumber: pagination.issueNumber,
							page: nextPage,
						},
					}).then((result) => {
						const newComments = result.comments;
						loadedCommentPagesRef.current.add(nextPage);
						queryClient.setQueryData(
							pagination.pageQueryKey,
							(prev: IssuePageData | undefined) => {
								if (!prev) return prev;
								const existingIds = new Set(prev.comments.map((c) => c.id));
								const uniqueNew = newComments.filter(
									(c) => !existingIds.has(c.id),
								);
								return {
									...prev,
									comments: [...prev.comments, ...uniqueNew],
									commentPagination: {
										...prev.commentPagination,
										loadedPages: [...loadedCommentPagesRef.current],
									},
								};
							},
						);
					}),
				);
			}
		}

		// Fetch next event page
		if (hasMoreEvents) {
			const nextEventPage = Math.max(...loadedEventPagesRef.current, 0) + 1;
			fetches.push(
				getTimelineEventPage({
					data: {
						owner: pagination.owner,
						repo: pagination.repo,
						issueNumber: pagination.issueNumber,
						page: nextEventPage,
					},
				}).then((result) => {
					loadedEventPagesRef.current.add(nextEventPage);
					hasMoreEventsRef.current = result.hasMore;
					queryClient.setQueryData(
						pagination.pageQueryKey,
						(prev: IssuePageData | undefined) => {
							if (!prev) return prev;
							const existingKeys = new Set(
								prev.events.map((e) => `${e.event}-${e.id}-${e.createdAt}`),
							);
							const uniqueNew = result.events.filter(
								(e) => !existingKeys.has(`${e.event}-${e.id}-${e.createdAt}`),
							);
							return {
								...prev,
								events: [...prev.events, ...uniqueNew],
								eventPagination: {
									loadedPages: [...loadedEventPagesRef.current],
									hasMore: result.hasMore,
								},
							};
						},
					);
				}),
			);
		}

		Promise.all(fetches).finally(() => {
			setIsFetchingPage(false);
		});
	}, [
		clientHiddenCount,
		pagination,
		hasUnfetchedCommentPages,
		hasUnfetchedEventPages,
		totalCommentPages,
		queryClient,
	]);

	return {
		visibleItems,
		hiddenCount,
		loadMoreIndex,
		loadMore,
		isFetchingPage,
		hasMorePages: hasUnfetchedPages,
	};
}

export function IssueDetailActivitySection({
	comments,
	events,
	commentPagination,
	eventPagination,
	pageQueryKey,
	isFetching,
	owner,
	repo,
	issueNumber,
}: {
	comments?: IssueComment[];
	events?: TimelineEvent[];
	commentPagination?: CommentPagination;
	eventPagination?: EventPagination;
	pageQueryKey: readonly unknown[];
	isFetching: boolean;
	owner: string;
	repo: string;
	issueNumber: number;
}) {
	const allItems: IssueTimelineItem[] = [
		...(comments ?? []).map((comment) => ({
			type: "comment" as const,
			date: comment.createdAt,
			data: comment,
		})),
		...(events ?? []).map((event) => ({
			type: "event" as const,
			date: event.createdAt,
			data: event,
		})),
	].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

	const totalCount = (comments?.length ?? 0) + (events?.length ?? 0);

	const {
		visibleItems,
		hiddenCount,
		hasMorePages,
		loadMoreIndex,
		loadMore,
		isFetchingPage,
	} = useWindowedTimeline(allItems, {
		commentPagination,
		eventPagination,
		pageQueryKey,
		owner,
		repo,
		issueNumber,
	});

	return (
		<div className="flex flex-col">
			<DetailActivityHeader
				title="Activity"
				count={comments ? totalCount : undefined}
			/>

			{isFetching && !comments && (
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

			{visibleItems.length === 0 && comments && (
				<p className="py-4 text-sm text-muted-foreground">No activity yet.</p>
			)}

			{visibleItems.length > 0 && (
				<div className="relative flex flex-col pl-8 before:absolute before:left-4 before:top-0 before:h-full before:w-px before:bg-[linear-gradient(to_bottom,var(--color-border)_80%,transparent)]">
					{visibleItems.map((item, index) => {
						const previousType =
							index > 0 ? visibleItems[index - 1].type : null;
						const nextType =
							index < visibleItems.length - 1
								? visibleItems[index + 1].type
								: null;
						const isConsecutiveEvent =
							item.type === "event" && previousType === "event";
						const isLastInEventRun =
							item.type === "event" && nextType !== "event";

						const row = (() => {
							if (item.type === "comment") {
								const comment = item.data;
								return (
									<div
										key={`comment-${comment.id}`}
										className={cn(
											"flex flex-col gap-1 py-4",
											index === 0 && "pt-5",
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
											<span className="text-[13px] font-medium">
												{comment.author?.login ?? "Unknown"}
											</span>
											<span className="text-[13px] text-muted-foreground">
												{formatRelativeTime(comment.createdAt)}
											</span>
										</div>
										<Markdown className="text-muted-foreground">
											{comment.body}
										</Markdown>
									</div>
								);
							}

							const event = item.data;
							const icon = getIssueEventIcon(event);
							const description = getIssueEventDescription(event);
							const isCrossRef =
								event.event === "cross-referenced" ||
								event.event === "referenced";
							const hasActorAvatar = !isCrossRef && event.actor?.avatarUrl;

							if (!description) return null;

							return (
								<div
									key={`event-${event.event}-${event.id}-${event.createdAt}`}
									className={cn(
										"flex items-center gap-1.5",
										index === 0 ? "pt-5" : isConsecutiveEvent ? "pt-2" : "pt-5",
										isLastInEventRun ? "pb-5" : "pb-2",
									)}
								>
									{hasActorAvatar ? (
										<img
											src={event.actor?.avatarUrl}
											alt={event.actor?.login}
											className="size-5 shrink-0 rounded-full border border-border"
										/>
									) : (
										<div className="flex size-5 shrink-0 items-center justify-center rounded-full border border-border bg-surface-1">
											{icon}
										</div>
									)}
									<span className="min-w-0 text-[13px] text-muted-foreground">
										{description}
									</span>
									{event.createdAt && (
										<span className="ml-auto shrink-0 text-[13px] text-muted-foreground">
											{formatRelativeTime(event.createdAt)}
										</span>
									)}
								</div>
							);
						})();

						return (
							<>
								{index === loadMoreIndex && (
									<LoadMoreDivider
										key="load-more"
										hiddenCount={hiddenCount}
										hasMorePages={hasMorePages}
										isPending={isFetchingPage}
										onLoadMore={loadMore}
									/>
								)}
								{row}
							</>
						);
					})}
				</div>
			)}

			<div className="mt-6">
				<DetailCommentBox />
			</div>
		</div>
	);
}

// ── Load more divider ───────────────────────────────────────────────

function LoadMoreDivider({
	hiddenCount,
	hasMorePages,
	isPending,
	onLoadMore,
}: {
	hiddenCount: number;
	hasMorePages?: boolean;
	isPending?: boolean;
	onLoadMore: () => void;
}) {
	const label =
		hiddenCount > 0
			? `${hiddenCount}${hasMorePages ? "+" : ""} more ${hiddenCount === 1 && !hasMorePages ? "item" : "items"}`
			: "Load more";

	return (
		<div className="flex items-center gap-3 py-3">
			<div className="h-px flex-1 bg-border" />
			<button
				type="button"
				onClick={onLoadMore}
				disabled={isPending}
				className={cn(
					"flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface-1 px-3 py-1 text-xs text-muted-foreground transition-colors",
					isPending
						? "cursor-not-allowed opacity-60"
						: "hover:bg-surface-2 hover:text-foreground",
				)}
			>
				{isPending ? (
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
					<ChevronDownIcon size={12} strokeWidth={2} />
				)}
				{label}
			</button>
			<div className="h-px flex-1 bg-border" />
		</div>
	);
}

// ── Event rendering helpers ─────────────────────────────────────────

function getIssueEventIcon(event: TimelineEvent) {
	switch (event.event) {
		case "labeled":
		case "unlabeled":
			return (
				<svg
					viewBox="0 0 16 16"
					className="size-3 text-muted-foreground"
					fill="currentColor"
					aria-hidden="true"
				>
					<path d="M2.5 7.775V3a.5.5 0 0 1 .5-.5h4.775a.75.75 0 0 1 .53.22l5.92 5.92a.75.75 0 0 1 0 1.06l-4.775 4.775a.75.75 0 0 1-1.06 0l-5.92-5.92a.75.75 0 0 1-.22-.53zM5 5.5a.5.5 0 1 0 1 0 .5.5 0 0 0-1 0z" />
				</svg>
			);
		case "assigned":
		case "unassigned":
			return (
				<UserAddIcon
					size={12}
					strokeWidth={2}
					className="text-muted-foreground"
				/>
			);
		case "renamed":
			return (
				<EditIcon size={12} strokeWidth={2} className="text-muted-foreground" />
			);
		case "closed":
			return (
				<IssuesIcon size={12} strokeWidth={2} className="text-purple-500" />
			);
		case "reopened":
			return (
				<IssuesIcon
					size={12}
					strokeWidth={2}
					className="text-green-600 dark:text-green-400"
				/>
			);
		case "cross-referenced":
		case "referenced":
			return (
				<GitPullRequestIcon
					size={12}
					strokeWidth={2}
					className="text-muted-foreground"
				/>
			);
		case "milestoned":
		case "demilestoned":
			return (
				<svg
					viewBox="0 0 16 16"
					className="size-3 text-muted-foreground"
					fill="currentColor"
					aria-hidden="true"
				>
					<path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0zm1.5 4.5h-3v7h1.5v-2h1.5a2 2 0 1 0 0-4zm0 1.5a.5.5 0 1 1 0 1H8V6z" />
				</svg>
			);
		case "review_requested":
		case "review_request_removed":
			return (
				<ReviewsIcon
					size={12}
					strokeWidth={2}
					className="text-muted-foreground"
				/>
			);
		default:
			return (
				<CircleIcon
					size={12}
					strokeWidth={2}
					className="text-muted-foreground"
				/>
			);
	}
}

function ActorMention({
	actor,
	hideAvatar,
}: {
	actor: { login: string; avatarUrl?: string } | null | undefined;
	hideAvatar?: boolean;
}) {
	const login = actor?.login ?? "someone";
	return (
		<span className="inline-flex items-center gap-1 font-medium text-foreground">
			{!hideAvatar && actor?.avatarUrl && (
				<img
					src={actor.avatarUrl}
					alt={login}
					className="inline-block size-3.5 rounded-full border border-border align-text-bottom"
				/>
			)}
			{login}
		</span>
	);
}

function getIssueEventDescription(event: TimelineEvent): React.ReactNode {
	const reviewer =
		event.requestedReviewer ??
		(event.requestedTeam ? { login: event.requestedTeam.name } : null);

	switch (event.event) {
		case "labeled":
			return (
				<span className="flex items-center gap-1.5">
					<ActorMention actor={event.actor} hideAvatar />
					{" added "}
					{event.label && (
						<LabelPill
							name={event.label.name}
							color={event.label.color}
							size="sm"
						/>
					)}
				</span>
			);
		case "unlabeled":
			return (
				<span className="flex items-center gap-1.5">
					<ActorMention actor={event.actor} hideAvatar />
					{" removed "}
					{event.label && (
						<LabelPill
							name={event.label.name}
							color={event.label.color}
							size="sm"
						/>
					)}
				</span>
			);
		case "assigned":
			return (
				<span className="inline-flex items-center gap-1">
					<ActorMention actor={event.actor} hideAvatar />
					{" assigned "}
					<ActorMention actor={event.assignee} />
				</span>
			);
		case "unassigned":
			return (
				<span className="inline-flex items-center gap-1">
					<ActorMention actor={event.actor} hideAvatar />
					{" unassigned "}
					<ActorMention actor={event.assignee} />
				</span>
			);
		case "renamed":
			return (
				<span className="inline-flex items-center gap-1">
					<ActorMention actor={event.actor} hideAvatar />
					{" changed the title from "}
					<span className="line-through">{event.rename?.from}</span>
					{" to "}
					<span className="font-medium text-foreground">
						{event.rename?.to}
					</span>
				</span>
			);
		case "closed":
			return (
				<span className="inline-flex items-center gap-1">
					<ActorMention actor={event.actor} hideAvatar />
					{" closed this"}
				</span>
			);
		case "reopened":
			return (
				<span className="inline-flex items-center gap-1">
					<ActorMention actor={event.actor} hideAvatar />
					{" reopened this"}
				</span>
			);
		case "cross-referenced":
		case "referenced": {
			if (!event.source) return null;
			const prefix = event.source.type === "pull_request" ? "PR" : "Issue";
			return (
				<span className="inline-flex flex-wrap items-center gap-1">
					<ActorMention actor={event.actor} />
					{" mentioned this in "}
					<span className="font-medium text-foreground">
						{event.source.repository
							? `${event.source.repository}#${event.source.number}`
							: `${prefix} #${event.source.number}`}
					</span>
					<span className="text-muted-foreground">{event.source.title}</span>
				</span>
			);
		}
		case "milestoned":
			return (
				<span className="inline-flex items-center gap-1">
					<ActorMention actor={event.actor} hideAvatar />
					{" added this to the "}
					<span className="font-medium text-foreground">
						{event.milestone?.title}
					</span>
					{" milestone"}
				</span>
			);
		case "demilestoned":
			return (
				<span className="inline-flex items-center gap-1">
					<ActorMention actor={event.actor} hideAvatar />
					{" removed this from the "}
					<span className="font-medium text-foreground">
						{event.milestone?.title}
					</span>
					{" milestone"}
				</span>
			);
		case "review_requested":
			return (
				<span className="inline-flex items-center gap-1">
					<ActorMention actor={event.actor} hideAvatar />
					{" requested review from "}
					<ActorMention actor={reviewer} />
				</span>
			);
		case "review_request_removed":
			return (
				<span className="inline-flex items-center gap-1">
					<ActorMention actor={event.actor} hideAvatar />
					{" removed review request for "}
					<ActorMention actor={reviewer} />
				</span>
			);
		default:
			return null;
	}
}
