import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
	type GitHubQueryScope,
	githubPullsFromRepoQueryOptions,
} from "#/lib/github.query";
import type { PullDetail, PullSummary } from "#/lib/github.types";
import {
	buildPullStackIndex,
	getPullStackContext,
	type PullStackContext,
	stackablePullFromDetail,
} from "#/lib/pull-stack";
import { useHasMounted } from "#/lib/use-has-mounted";

/**
 * Open PRs examined for stacks. One REST page (100 PRs); repos with more open
 * PRs than this may show a truncated stack.
 */
export const PULL_STACK_PAGE_SIZE = 100;

export function pullStackListQueryInput(owner: string, repo: string) {
	return {
		owner,
		repo,
		state: "open",
		page: 1,
		perPage: PULL_STACK_PAGE_SIZE,
	} as const;
}

export type PullStackState = {
	context: PullStackContext<PullSummary> | null;
	isLoading: boolean;
};

/**
 * Stack context for the PR being viewed, derived from the repo's open PR list
 * (a single cached REST request) with the freshly loaded detail merged over
 * the list entry for the current PR.
 */
export function usePullStack({
	scope,
	owner,
	repo,
	pr,
}: {
	scope: GitHubQueryScope;
	owner: string;
	repo: string;
	pr: PullDetail;
}): PullStackState {
	const hasMounted = useHasMounted();
	const isOpen = pr.state === "open";
	const query = useQuery({
		...githubPullsFromRepoQueryOptions(
			scope,
			pullStackListQueryInput(owner, repo),
		),
		enabled: hasMounted && isOpen,
	});

	const repoFullName = `${owner}/${repo}`;
	const context = useMemo(() => {
		if (!isOpen || !query.data) return null;
		const current: PullSummary = {
			...pr,
			...stackablePullFromDetail(pr, repoFullName),
		} as PullSummary;
		const index = buildPullStackIndex<PullSummary>(
			[...query.data.filter((pull) => pull.number !== pr.number), current],
			{ repoFullName },
		);
		return getPullStackContext(index, pr.number);
	}, [isOpen, pr, query.data, repoFullName]);

	return { context, isLoading: isOpen && query.isPending };
}
