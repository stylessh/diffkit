import type { QueryClient } from "@tanstack/react-query";
import {
	type GitHubEntityChange,
	type GitHubQueryScope,
	githubQueryKeys,
	githubQueryMatchesEntity,
} from "./github.query";
import type {
	IssueSummary,
	MyPullsResult,
	PullSummary,
	RepoOverview,
} from "./github.types";
import {
	formatEntityKey,
	type GitHubChangeEntity,
	normalizeRepoFullName,
	parseEntityKey,
} from "./github-change-entities";

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

/**
 * Invalidates exactly the queries a mutation affected, through the same
 * entity → query registry as the change feed. Active matches refetch; inactive
 * ones refetch on next use.
 */
export function invalidateGitHubEntities(
	queryClient: QueryClient,
	scope: GitHubQueryScope | null,
	entityKeys: string[],
	change: GitHubEntityChange = "updated",
) {
	const entities = entityKeys
		.map(parseEntityKey)
		.filter((entity): entity is GitHubChangeEntity => entity !== null);
	return queryClient.invalidateQueries({
		queryKey: scope ? ["github", scope.userId] : ["github"],
		predicate: (query) =>
			entities.some((entity) =>
				githubQueryMatchesEntity(
					query.queryKey,
					entity,
					query.state.data,
					change,
				),
			),
	});
}

type RepoInput = { owner: string; repo: string };

export function pullEntityKey(input: RepoInput & { pullNumber: number }) {
	return formatEntityKey({
		kind: "pull",
		repo: normalizeRepoFullName(input.owner, input.repo),
		number: input.pullNumber,
	});
}

export function issueEntityKey(input: RepoInput & { issueNumber: number }) {
	return formatEntityKey({
		kind: "issue",
		repo: normalizeRepoFullName(input.owner, input.repo),
		number: input.issueNumber,
	});
}

/**
 * Both entity keys for item `#number`, for code that can't tell a pull request
 * from an issue (e.g. conversation comments). They share one number sequence
 * per repo, so this still targets a single item.
 */
export function pullOrIssueEntityKeys(input: RepoInput & { number: number }) {
	return [
		pullEntityKey({ ...input, pullNumber: input.number }),
		issueEntityKey({ ...input, issueNumber: input.number }),
	];
}

export function repoEntityKey(input: RepoInput) {
	return formatEntityKey({
		kind: "repo",
		repo: normalizeRepoFullName(input.owner, input.repo),
	});
}

export function releaseEntityKey(input: RepoInput) {
	return formatEntityKey({
		kind: "release",
		repo: normalizeRepoFullName(input.owner, input.repo),
	});
}

export function runEntityKey(input: RepoInput & { runId: number }) {
	return formatEntityKey({
		kind: "run",
		repo: normalizeRepoFullName(input.owner, input.repo),
		runId: input.runId,
	});
}
