import { debug } from "../debug";
import type {
	MyIssuesResult,
	MyPullsResult,
	RepositoryRef,
} from "../github.types";
import {
	GitHubOperationTimeoutError,
	getRemainingSearchTimeoutMs,
	withGitHubOperationTimeout,
} from "./client";
import {
	type GraphQLMyIssuesResponse,
	type GraphQLMyPullsResponse,
	MY_ISSUES_SEARCH_QUERY,
	MY_PULLS_SEARCH_QUERY,
	mapGraphQLIssueSearchConnection,
	mapGraphQLPullSearchConnection,
} from "./my-search-documents";
import {
	extractForbiddenOrg,
	type GitHubGraphQLSearchSource,
	getMySearchSources,
	MY_SEARCH_SOURCE_TIMEOUT_MS,
	persistForbiddenOrgs,
} from "./my-search-sources";
import { dedupeGitHubRead } from "./request-dedup";
import { buildUserSearchQuery } from "./search-query";
import {
	GITHUB_MIN_OPERATION_TIMEOUT_MS,
	type GitHubContext,
	type IssueSearchRole,
	normalizeLogin,
	type PullSearchRole,
} from "./shared";

const MY_SEARCH_BUCKET_LIMIT = 30;
const MY_SEARCH_TOTAL_TIMEOUT_MS = 18_000;

function mergeSearchBuckets<
	TItem extends {
		number: number;
		updatedAt: string;
		repository: RepositoryRef;
	},
>(buckets: TItem[][]) {
	const byKey = new Map<string, TItem>();

	for (const bucket of buckets) {
		for (const item of bucket) {
			const key = `${normalizeLogin(item.repository.fullName)}#${item.number}`;
			const existing = byKey.get(key);
			if (
				!existing ||
				Date.parse(item.updatedAt) > Date.parse(existing.updatedAt)
			) {
				byKey.set(key, item);
			}
		}
	}

	return [...byKey.values()]
		.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
		.slice(0, MY_SEARCH_BUCKET_LIMIT);
}

function mergeMyPullsResults(results: MyPullsResult[]): MyPullsResult {
	return {
		reviewRequested: mergeSearchBuckets(
			results.map((result) => result.reviewRequested),
		),
		assigned: mergeSearchBuckets(results.map((result) => result.assigned)),
		authored: mergeSearchBuckets(results.map((result) => result.authored)),
		mentioned: mergeSearchBuckets(results.map((result) => result.mentioned)),
		involved: mergeSearchBuckets(results.map((result) => result.involved)),
	};
}

function mergeMyIssuesResults(results: MyIssuesResult[]): MyIssuesResult {
	return {
		assigned: mergeSearchBuckets(results.map((result) => result.assigned)),
		authored: mergeSearchBuckets(results.map((result) => result.authored)),
		mentioned: mergeSearchBuckets(results.map((result) => result.mentioned)),
	};
}

type MySearchOutcome = {
	forbiddenOrgs?: string[];
	partial?: boolean;
	timedOut?: boolean;
};

type MySearch<TResponse, TResult> = {
	resource: string;
	itemType: "issue" | "pr";
	document: string;
	/** GraphQL alias to the role it searches; the variable is `<alias>Query`. */
	roles: Record<string, IssueSearchRole | PullSearchRole>;
	mapResponse: (response: TResponse) => TResult;
	merge: (results: TResult[]) => TResult;
};

type SourceSearch<TResult> =
	| { status: "loaded"; result: TResult }
	| { status: "skipped" }
	| { status: "failed"; timedOut: boolean; forbiddenOrg: string | null };

async function searchSource<TResponse, TResult>({
	search,
	source,
	username,
	deadlineAt,
}: {
	search: MySearch<TResponse, TResult>;
	source: GitHubGraphQLSearchSource;
	username: string;
	deadlineAt: number;
}): Promise<SourceSearch<TResult>> {
	const timeoutMs = getRemainingSearchTimeoutMs(
		deadlineAt,
		MY_SEARCH_SOURCE_TIMEOUT_MS,
	);
	if (timeoutMs < GITHUB_MIN_OPERATION_TIMEOUT_MS) {
		debug("github-search", "skipping search source, deadline low", {
			resource: search.resource,
			source: source.label,
			remainingMs: timeoutMs,
		});
		return { status: "skipped" };
	}

	const queries = Object.fromEntries(
		Object.entries(search.roles).map(([alias, role]) => [
			`${alias}Query`,
			buildUserSearchQuery({
				itemType: search.itemType,
				role,
				state: "open",
				username,
				owner: source.owner?.login,
				ownerType: source.owner?.targetType,
				excludeOwners: source.excludeOwners,
			}),
		]),
	);

	try {
		const response = await withGitHubOperationTimeout(
			`github ${search.resource} ${source.label}`,
			timeoutMs,
			(signal) =>
				source.context.octokit.graphql<TResponse>(search.document, {
					...queries,
					request: { signal },
				}),
		);
		return { status: "loaded", result: search.mapResponse(response) };
	} catch (error) {
		console.error(
			`[github-search] ${search.resource} failed`,
			source.label,
			error,
		);
		return {
			status: "failed",
			timedOut: error instanceof GitHubOperationTimeoutError,
			forbiddenOrg: extractForbiddenOrg(error),
		};
	}
}

/**
 * One search per installation plus the OAuth fallback, all at once: each
 * source uses its own token, so they do not share a rate limit.
 */
async function searchEverySource<TResponse, TResult extends MySearchOutcome>({
	context,
	username,
	search,
}: {
	context: GitHubContext;
	username: string;
	search: MySearch<TResponse, TResult>;
}): Promise<TResult> {
	const userId = context.session.user.id;
	return dedupeGitHubRead<TResult>({
		userId,
		resource: search.resource,
		params: { username },
		fetcher: async () => {
			const deadlineAt = Date.now() + MY_SEARCH_TOTAL_TIMEOUT_MS;
			const sources = await getMySearchSources(context, username, deadlineAt);
			const searches = await Promise.all(
				sources.map((source) =>
					searchSource({ search, source, username, deadlineAt }),
				),
			);

			const data = search.merge(
				searches.flatMap((outcome) =>
					outcome.status === "loaded" ? [outcome.result] : [],
				),
			);
			const forbiddenOrgs = [
				...new Set(
					searches.flatMap((outcome) =>
						outcome.status === "failed" && outcome.forbiddenOrg
							? [outcome.forbiddenOrg]
							: [],
					),
				),
			];
			if (forbiddenOrgs.length > 0) {
				data.forbiddenOrgs = forbiddenOrgs;
				await persistForbiddenOrgs(userId, forbiddenOrgs);
			}
			if (searches.some((outcome) => outcome.status !== "loaded")) {
				data.partial = true;
			}
			if (
				searches.some(
					(outcome) => outcome.status === "failed" && outcome.timedOut,
				)
			) {
				data.timedOut = true;
			}
			return data;
		},
	});
}

const myPullsSearch: MySearch<GraphQLMyPullsResponse, MyPullsResult> = {
	resource: "pulls.mine.graphql.v2",
	itemType: "pr",
	document: MY_PULLS_SEARCH_QUERY,
	roles: {
		reviewRequested: "review-requested",
		assigned: "assigned",
		authored: "author",
		mentioned: "mentioned",
		involved: "involved",
	},
	mapResponse: (response) => ({
		reviewRequested: mapGraphQLPullSearchConnection(response.reviewRequested),
		assigned: mapGraphQLPullSearchConnection(response.assigned),
		authored: mapGraphQLPullSearchConnection(response.authored),
		mentioned: mapGraphQLPullSearchConnection(response.mentioned),
		involved: mapGraphQLPullSearchConnection(response.involved),
	}),
	merge: mergeMyPullsResults,
};

const myIssuesSearch: MySearch<GraphQLMyIssuesResponse, MyIssuesResult> = {
	resource: "issues.mine.graphql.v2",
	itemType: "issue",
	document: MY_ISSUES_SEARCH_QUERY,
	roles: {
		assigned: "assigned",
		authored: "author",
		mentioned: "mentioned",
	},
	mapResponse: (response) => ({
		assigned: mapGraphQLIssueSearchConnection(response.assigned),
		authored: mapGraphQLIssueSearchConnection(response.authored),
		mentioned: mapGraphQLIssueSearchConnection(response.mentioned),
	}),
	merge: mergeMyIssuesResults,
};

export function getMyPullsResult(input: {
	context: GitHubContext;
	username: string;
}) {
	return searchEverySource({ ...input, search: myPullsSearch });
}

export function getMyIssuesResult(input: {
	context: GitHubContext;
	username: string;
}) {
	return searchEverySource({ ...input, search: myIssuesSearch });
}
