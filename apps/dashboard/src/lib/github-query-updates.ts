import type { QueryClient } from "@tanstack/react-query";
import { type GitHubQueryScope, githubQueryKeys } from "./github.query";
import type {
	IssueSummary,
	MyPullsResult,
	PullSummary,
	RepoOverview,
} from "./github.types";

function matchesPull(
	pull: Pick<PullSummary, "number" | "repository">,
	owner: string,
	repo: string,
	pullNumber: number,
) {
	return (
		pull.number === pullNumber &&
		pull.repository.owner === owner &&
		pull.repository.name === repo
	);
}

export function removePullFromOpenViews(
	queryClient: QueryClient,
	scope: GitHubQueryScope,
	input: { owner: string; repo: string; pullNumber: number },
) {
	const { owner, repo, pullNumber } = input;

	queryClient.setQueryData<MyPullsResult>(
		githubQueryKeys.pulls.mine(scope),
		(current) => {
			if (!current) {
				return current;
			}

			return {
				...current,
				reviewRequested: current.reviewRequested.filter(
					(pull) => !matchesPull(pull, owner, repo, pullNumber),
				),
				assigned: current.assigned.filter(
					(pull) => !matchesPull(pull, owner, repo, pullNumber),
				),
				authored: current.authored.filter(
					(pull) => !matchesPull(pull, owner, repo, pullNumber),
				),
				mentioned: current.mentioned.filter(
					(pull) => !matchesPull(pull, owner, repo, pullNumber),
				),
				involved: current.involved.filter(
					(pull) => !matchesPull(pull, owner, repo, pullNumber),
				),
			};
		},
	);

	queryClient.setQueriesData<PullSummary[]>(
		{
			predicate: (query) => {
				const key = query.queryKey;
				if (!Array.isArray(key) || key.length < 5) {
					return false;
				}

				if (
					key[0] !== "github" ||
					key[1] !== scope.userId ||
					key[2] !== "pulls" ||
					key[3] !== "repo"
				) {
					return false;
				}

				const queryInput = key[4];
				if (!queryInput || typeof queryInput !== "object") {
					return false;
				}

				const repoInput = queryInput as {
					owner?: string;
					repo?: string;
					state?: string;
				};

				return (
					repoInput.owner === owner &&
					repoInput.repo === repo &&
					(repoInput.state === undefined || repoInput.state === "open")
				);
			},
		},
		(current) => {
			if (!current) {
				return current;
			}

			return current.filter(
				(pull) => !matchesPull(pull, owner, repo, pullNumber),
			);
		},
	);

	queryClient.setQueryData<RepoOverview>(
		githubQueryKeys.repo.overview(scope, { owner, repo }),
		(current) => {
			if (!current) {
				return current;
			}

			return {
				...current,
				openPullCount: Math.max(0, current.openPullCount - 1),
			};
		},
	);
}

// ---------------------------------------------------------------------------
// List → detail seeding
// ---------------------------------------------------------------------------

type ListItem = {
	number: number;
	updatedAt: string;
	repository: { owner: string; name: string };
};

const SEED_LIST_NAMES = new Set(["mine", "repo", "user"]);

function* listItemsIn(data: unknown): Generator<unknown> {
	if (Array.isArray(data)) {
		yield* data;
		return;
	}
	if (data && typeof data === "object") {
		for (const value of Object.values(data)) {
			if (Array.isArray(value)) yield* value;
		}
	}
}

function isListItem(value: unknown): value is ListItem {
	if (!value || typeof value !== "object") return false;
	const item = value as Partial<ListItem>;
	return (
		typeof item.number === "number" &&
		typeof item.updatedAt === "string" &&
		typeof item.repository?.owner === "string" &&
		typeof item.repository?.name === "string"
	);
}

function findSummaryInLists<T extends ListItem>(
	queryClient: QueryClient,
	scope: GitHubQueryScope,
	group: "pulls" | "issues",
	input: { owner: string; repo: string; number: number },
): T | undefined {
	const owner = input.owner.toLowerCase();
	const repo = input.repo.toLowerCase();
	let newest: T | undefined;
	for (const [queryKey, data] of queryClient.getQueriesData({
		queryKey: ["github", scope.userId, group],
	})) {
		if (!SEED_LIST_NAMES.has(String(queryKey[3]))) continue;
		for (const item of listItemsIn(data)) {
			if (
				isListItem(item) &&
				item.number === input.number &&
				item.repository.owner.toLowerCase() === owner &&
				item.repository.name.toLowerCase() === repo &&
				(!newest || item.updatedAt > newest.updatedAt)
			) {
				newest = item as T;
			}
		}
	}
	return newest;
}

/**
 * The freshest list row for a pull request already in the cache (my pulls,
 * repo pulls, user pulls). Detail pages render its title, state, author and
 * labels on the first frame while the full page query loads.
 */
export function findPullSummaryInLists(
	queryClient: QueryClient,
	scope: GitHubQueryScope,
	input: { owner: string; repo: string; pullNumber: number },
): PullSummary | undefined {
	return findSummaryInLists<PullSummary>(queryClient, scope, "pulls", {
		owner: input.owner,
		repo: input.repo,
		number: input.pullNumber,
	});
}

/** Issue counterpart of `findPullSummaryInLists`. */
export function findIssueSummaryInLists(
	queryClient: QueryClient,
	scope: GitHubQueryScope,
	input: { owner: string; repo: string; issueNumber: number },
): IssueSummary | undefined {
	return findSummaryInLists<IssueSummary>(queryClient, scope, "issues", {
		owner: input.owner,
		repo: input.repo,
		number: input.issueNumber,
	});
}
