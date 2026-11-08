import type { QueryClient } from "@tanstack/react-query";
import type { GitHubQueryScope } from "./github.query";
import { githubQueryKeys } from "./github.query";
import type {
	CommitReference,
	IssueDetail,
	IssuePageData,
	IssueSummary,
	ItemReference,
	PullDetail,
	PullPageData,
	PullSummary,
	RepoCommitDetail,
	RepoCommitSummary,
	RepoCommitsPage,
} from "./github.types";
import {
	findIssueSummaryInLists,
	findPullSummaryInLists,
} from "./github-query-updates";
import { markdownExcerpt } from "./markdown-excerpt";

type ItemInput = { owner: string; repo: string; number: number };
type CommitInput = { owner: string; repo: string; sha: string };

function excerptOf(item: { body?: string }) {
	return item.body === undefined ? null : markdownExcerpt(item.body);
}

export function itemReferenceFromPull(
	input: ItemInput,
	pull: PullSummary & { body?: string; isMerged?: boolean },
): ItemReference {
	const status =
		pull.isMerged || pull.mergedAt
			? "merged"
			: pull.state === "closed"
				? "closed"
				: pull.isDraft
					? "draft"
					: "open";
	return {
		kind: "pull",
		status,
		owner: input.owner,
		repo: input.repo,
		number: pull.number,
		title: pull.title,
		author: pull.author,
		createdAt: pull.createdAt,
		comments: pull.comments,
		labels: pull.labels,
		excerpt: excerptOf(pull),
	};
}

export function itemReferenceFromIssue(
	input: ItemInput,
	issue: IssueSummary & { body?: string },
): ItemReference {
	const status =
		issue.state !== "closed"
			? "open"
			: issue.stateReason === "not_planned"
				? "notPlanned"
				: "completed";
	return {
		kind: "issue",
		status,
		owner: input.owner,
		repo: input.repo,
		number: issue.number,
		title: issue.title,
		author: issue.author,
		createdAt: issue.createdAt,
		comments: issue.comments,
		labels: issue.labels,
		excerpt: excerptOf(issue),
	};
}

/**
 * The richest cached view of `#number`: an open detail page first, then any
 * list row, so a hover card paints on its first frame for anything the user
 * has already seen.
 */
export function cachedItemReference(
	queryClient: QueryClient,
	scope: GitHubQueryScope,
	input: ItemInput,
): ItemReference | undefined {
	const pullInput = {
		owner: input.owner,
		repo: input.repo,
		pullNumber: input.number,
	};
	const issueInput = {
		owner: input.owner,
		repo: input.repo,
		issueNumber: input.number,
	};

	const pull =
		queryClient.getQueryData<PullPageData>(
			githubQueryKeys.pulls.page(scope, pullInput),
		)?.detail ??
		queryClient.getQueryData<PullDetail | null>(
			githubQueryKeys.pulls.detail(scope, pullInput),
		);
	if (pull) return itemReferenceFromPull(input, pull);

	const issue =
		queryClient.getQueryData<IssuePageData>(
			githubQueryKeys.issues.page(scope, issueInput),
		)?.detail ??
		queryClient.getQueryData<IssueDetail | null>(
			githubQueryKeys.issues.detail(scope, issueInput),
		);
	if (issue) return itemReferenceFromIssue(input, issue);

	const pullRow = findPullSummaryInLists(queryClient, scope, pullInput);
	if (pullRow) return itemReferenceFromPull(input, pullRow);
	const issueRow = findIssueSummaryInLists(queryClient, scope, issueInput);
	return issueRow ? itemReferenceFromIssue(input, issueRow) : undefined;
}

function commitTitle(message: string) {
	return message.split("\n", 1)[0];
}

function commitFromDetail(
	input: CommitInput,
	detail: RepoCommitDetail,
): CommitReference {
	return {
		owner: input.owner,
		repo: input.repo,
		sha: detail.sha,
		title: commitTitle(detail.message),
		author: detail.author,
		authorName: null,
		date: detail.date,
		verified: false,
		stats: {
			additions: detail.files.reduce((sum, file) => sum + file.additions, 0),
			deletions: detail.files.reduce((sum, file) => sum + file.deletions, 0),
		},
	};
}

function commitFromSummary(
	input: CommitInput,
	commit: RepoCommitSummary,
): CommitReference {
	return {
		owner: input.owner,
		repo: input.repo,
		sha: commit.sha,
		title: commitTitle(commit.message),
		author: commit.author,
		authorName: commit.authorName,
		date: commit.date,
		verified: commit.verified,
		stats: null,
	};
}

function sameRepo(a: { owner?: unknown; repo?: unknown }, b: CommitInput) {
	return (
		typeof a.owner === "string" &&
		typeof a.repo === "string" &&
		a.owner.toLowerCase() === b.owner.toLowerCase() &&
		a.repo.toLowerCase() === b.repo.toLowerCase()
	);
}

/** Commit pages and commit lists both seed a commit's hover card. */
export function cachedCommitReference(
	queryClient: QueryClient,
	scope: GitHubQueryScope,
	input: CommitInput,
): CommitReference | undefined {
	for (const [key, data] of queryClient.getQueriesData<RepoCommitDetail | null>(
		{
			queryKey: ["github", scope.userId, "repo", "commit"],
		},
	)) {
		const keyInput = key[4] as CommitInput | undefined;
		if (
			data &&
			keyInput &&
			sameRepo(keyInput, input) &&
			data.sha.startsWith(input.sha)
		) {
			return commitFromDetail(input, data);
		}
	}
	for (const [key, data] of queryClient.getQueriesData<RepoCommitsPage>({
		queryKey: ["github", scope.userId, "commits", "list"],
	})) {
		const keyInput = key[4] as CommitInput | undefined;
		if (!data || !keyInput || !sameRepo(keyInput, input)) continue;
		const commit = data.commits.find((item) => item.sha.startsWith(input.sha));
		if (commit) return commitFromSummary(input, commit);
	}
	return undefined;
}
