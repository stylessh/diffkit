import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import {
	type GitHubQueryScope,
	githubPullFileSummariesQueryOptions,
	githubQueryKeys,
} from "#/lib/github.query";
import type { PullFileSummary } from "#/lib/github.types";

export type ReviewFileSummaries =
	| { status: "cold" }
	| { status: "loading-more" | "complete"; files: PullFileSummary[] };

type PullInput = { owner: string; repo: string; pullNumber: number };

/**
 * The pull request's changed files for the side panel. Pages are about 100
 * files each and are fetched one after another without waiting to be asked,
 * so a large pull request fills the tree in as it arrives.
 */
export function useReviewFileSummaries(
	scope: GitHubQueryScope,
	input: PullInput,
	headSha: string | undefined,
): ReviewFileSummaries {
	const queryClient = useQueryClient();
	const query = useInfiniteQuery(
		githubPullFileSummariesQueryOptions(scope, input),
	);
	const { data, hasNextPage, isFetchingNextPage, fetchNextPage } = query;

	useEffect(() => {
		if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
	}, [hasNextPage, isFetchingNextPage, fetchNextPage]);

	// Repos without the GitHub App get no change feed, so a push only shows up
	// when the page query refetches on focus; follow its head commit here.
	const lastHeadShaRef = useRef(headSha);
	useEffect(() => {
		if (!headSha) return;
		const previousHeadSha = lastHeadShaRef.current;
		lastHeadShaRef.current = headSha;
		if (previousHeadSha && previousHeadSha !== headSha) {
			void queryClient.invalidateQueries({
				queryKey: githubQueryKeys.pulls.fileSummaries(scope, input),
			});
		}
	}, [headSha, queryClient, scope, input]);

	const files = useMemo(
		() => data?.pages.flatMap((page) => page.items),
		[data],
	);

	if (query.error) throw query.error;
	if (!files) return { status: "cold" };
	return { status: hasNextPage ? "loading-more" : "complete", files };
}
