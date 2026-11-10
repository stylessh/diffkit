import type { QueryClient } from "@tanstack/react-query";
import {
	type GitHubEntityChange,
	type GitHubQueryScope,
	githubQueryKeys,
	githubQueryMatchesEntity,
} from "./github.query";
import type {
	IssueSummary,
	MyIssuesResult,
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

/**
 * Drops item `#number` from every cached list that only holds open items: the
 * viewer's own lists, the repo's open list, and the repo overview's counter.
 */
function removeFromOpenViews(
	queryClient: QueryClient,
	scope: GitHubQueryScope,
	group: "pulls" | "issues",
	input: { owner: string; repo: string; number: number },
) {
	const { owner, repo, number } = input;
	const isOther = (item: ListItem) =>
		item.number !== number ||
		item.repository.owner !== owner ||
		item.repository.name !== repo;

	queryClient.setQueryData<MyPullsResult | MyIssuesResult>(
		githubQueryKeys[group].mine(scope),
		(current) => {
			if (!current) {
				return current;
			}

			return Object.fromEntries(
				Object.entries(current).map(([name, value]) => [
					name,
					Array.isArray(value) && value.every(isListItem)
						? value.filter(isOther)
						: value,
				]),
			) as typeof current;
		},
	);

	queryClient.setQueriesData<ListItem[]>(
		{
			predicate: (query) => {
				const key = query.queryKey;
				if (!Array.isArray(key) || key.length < 5) {
					return false;
				}

				if (
					key[0] !== "github" ||
					key[1] !== scope.userId ||
					key[2] !== group ||
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
		(current) => current?.filter(isOther),
	);

	const counter = group === "pulls" ? "openPullCount" : "openIssueCount";
	queryClient.setQueryData<RepoOverview>(
		githubQueryKeys.repo.overview(scope, { owner, repo }),
		(current) => {
			if (!current) {
				return current;
			}

			return { ...current, [counter]: Math.max(0, current[counter] - 1) };
		},
	);
}

export function removePullFromOpenViews(
	queryClient: QueryClient,
	scope: GitHubQueryScope,
	input: { owner: string; repo: string; pullNumber: number },
) {
	removeFromOpenViews(queryClient, scope, "pulls", {
		owner: input.owner,
		repo: input.repo,
		number: input.pullNumber,
	});
}

export function removeIssueFromOpenViews(
	queryClient: QueryClient,
	scope: GitHubQueryScope,
	input: { owner: string; repo: string; issueNumber: number },
) {
	removeFromOpenViews(queryClient, scope, "issues", {
		owner: input.owner,
		repo: input.repo,
		number: input.issueNumber,
	});
}

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
 * Same entity → query registry as the change feed, so a mutation and the
 * webhook it triggers invalidate the same queries.
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

export function milestonesEntityKey(input: RepoInput) {
	return formatEntityKey({
		kind: "milestones",
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

export function labelsEntityKey(input: RepoInput) {
	return formatEntityKey({
		kind: "labels",
		repo: normalizeRepoFullName(input.owner, input.repo),
	});
}

export function collaboratorsEntityKey(input: RepoInput) {
	return formatEntityKey({
		kind: "collaborators",
		repo: normalizeRepoFullName(input.owner, input.repo),
	});
}

export function settingsEntityKey(input: RepoInput) {
	return formatEntityKey({
		kind: "settings",
		repo: normalizeRepoFullName(input.owner, input.repo),
	});
}

export function orgEntityKey(org: string) {
	return formatEntityKey({ kind: "org", org: org.toLowerCase() });
}
