import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { getCommentPage, getTimelineEventPage } from "#/lib/github.functions";
import type {
	CommentPagination,
	EventPagination,
	IssueComment,
	TimelineEvent,
} from "#/lib/github.types";

const WINDOW_THRESHOLD = 25;
const EDGE_SIZE = 10;
const LOAD_MORE_CHUNK = 20;

/** The part of a pull or issue page's cached data that "load more" extends. */
type PagedTimelineData = {
	comments: IssueComment[];
	events: TimelineEvent[];
	commentPagination: CommentPagination;
	eventPagination: EventPagination;
};

export type TimelinePagination = {
	commentPagination?: CommentPagination;
	eventPagination?: EventPagination;
	pageQueryKey: readonly unknown[];
	owner: string;
	repo: string;
	issueNumber: number;
};

const eventKey = (event: TimelineEvent) =>
	`${event.event}-${event.id}-${event.createdAt}`;

/** The server loads the first and last comment pages; the ones between load on demand. */
function nextUnloadedCommentPage(pagination: CommentPagination | undefined) {
	if (!pagination) return null;
	const totalPages = Math.max(
		1,
		Math.ceil(pagination.totalCount / pagination.perPage),
	);
	if (totalPages <= 1 || pagination.loadedPages.length >= totalPages) {
		return null;
	}
	for (let page = 2; page < totalPages; page++) {
		if (!pagination.loadedPages.includes(page)) return page;
	}
	return null;
}

/**
 * Shows both ends of a long timeline and reveals the middle in chunks, then
 * fetches the comment and event pages the first load left out.
 */
export function useWindowedTimeline<T>(
	items: T[],
	{
		commentPagination,
		eventPagination,
		pageQueryKey,
		owner,
		repo,
		issueNumber,
	}: TimelinePagination,
) {
	const queryClient = useQueryClient();
	const [revealedCount, setRevealedCount] = useState(0);
	const [isFetchingPage, setIsFetchingPage] = useState(false);

	const nextCommentPage = nextUnloadedCommentPage(commentPagination);
	const nextEventPage = eventPagination?.hasMore
		? Math.max(...eventPagination.loadedPages, 0) + 1
		: null;
	const hasMorePages = nextCommentPage !== null || nextEventPage !== null;

	const needsWindowing = items.length > WINDOW_THRESHOLD || hasMorePages;
	const hiddenCount = needsWindowing
		? Math.max(0, items.length - EDGE_SIZE * 2 - revealedCount)
		: 0;

	const visibleItems =
		hiddenCount > 0
			? [
					...items.slice(0, EDGE_SIZE + revealedCount),
					...items.slice(items.length - EDGE_SIZE),
				]
			: items;

	const showLoadMore = needsWindowing && (hiddenCount > 0 || hasMorePages);
	// Revealing can overshoot what was hidden; unfetched pages still belong before the trailing edge.
	const loadMoreIndex = showLoadMore
		? Math.min(
				EDGE_SIZE + revealedCount,
				Math.max(0, visibleItems.length - EDGE_SIZE),
			)
		: -1;

	const loadMore = useCallback(() => {
		if (hiddenCount > 0) {
			setRevealedCount((prev) => prev + LOAD_MORE_CHUNK);
			return;
		}

		const fetches: Promise<void>[] = [];

		if (nextCommentPage !== null) {
			fetches.push(
				getCommentPage({
					data: { owner, repo, issueNumber, page: nextCommentPage },
				}).then((result) => {
					queryClient.setQueryData(
						pageQueryKey,
						(prev: PagedTimelineData | undefined) => {
							if (!prev) return prev;
							const existingIds = new Set(prev.comments.map((c) => c.id));
							return {
								...prev,
								comments: [
									...prev.comments,
									...result.comments.filter((c) => !existingIds.has(c.id)),
								],
								commentPagination: {
									...prev.commentPagination,
									loadedPages: [
										...new Set([
											...prev.commentPagination.loadedPages,
											nextCommentPage,
										]),
									],
								},
							};
						},
					);
				}),
			);
		}

		if (nextEventPage !== null) {
			fetches.push(
				getTimelineEventPage({
					data: { owner, repo, issueNumber, page: nextEventPage },
				}).then((result) => {
					queryClient.setQueryData(
						pageQueryKey,
						(prev: PagedTimelineData | undefined) => {
							if (!prev) return prev;
							const existingKeys = new Set(prev.events.map(eventKey));
							return {
								...prev,
								events: [
									...prev.events,
									...result.events.filter(
										(e) => !existingKeys.has(eventKey(e)),
									),
								],
								eventPagination: {
									loadedPages: [
										...new Set([
											...prev.eventPagination.loadedPages,
											nextEventPage,
										]),
									],
									hasMore: result.hasMore,
								},
							};
						},
					);
				}),
			);
		}

		if (fetches.length === 0) return;
		setIsFetchingPage(true);
		void Promise.all(fetches).finally(() => setIsFetchingPage(false));
	}, [
		hiddenCount,
		nextCommentPage,
		nextEventPage,
		owner,
		repo,
		issueNumber,
		pageQueryKey,
		queryClient,
	]);

	return {
		visibleItems,
		hiddenCount,
		hasMorePages,
		loadMoreIndex,
		loadMore,
		isFetchingPage,
	};
}
