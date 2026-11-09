import { debug } from "../debug";
import type {
	IssueSummary,
	MyIssuesResult,
	MyPullsResult,
	PullSummary,
	RepositoryRef,
} from "../github.types";
import type {
	GitHubAppInstallation,
	GitHubInstallationTargetType,
} from "../github-access";
import {
	GitHubOperationTimeoutError,
	getRemainingSearchTimeoutMs,
	withGitHubOperationTimeout,
} from "./client";
import {
	getGitHubAppUserInstallations,
	getGitHubContextForInstallation,
} from "./installations";
import {
	mapGraphQLActor,
	mapGraphQLLabels,
	mapGraphQLRepositoryRef,
} from "./mappers";
import { dedupeGitHubRead } from "./request-dedup";
import {
	GITHUB_MIN_OPERATION_TIMEOUT_MS,
	type GitHubContext,
	type GitHubGraphQLActor,
	type GitHubGraphQLLabel,
	type GitHubGraphQLRateLimit,
	type GitHubGraphQLRepositoryRef,
	type IssueSearchRole,
	normalizeLogin,
	type PullSearchRole,
	type RepoState,
} from "./shared";

type GitHubSearchOwnerScope = {
	login: string;
	targetType: GitHubInstallationTargetType;
};
type GitHubGraphQLSearchSource = {
	label: string;
	context: GitHubContext;
	owner?: GitHubSearchOwnerScope;
	excludeOwners?: GitHubSearchOwnerScope[];
};
type GitHubGraphQLSearchConnection<TNode> = {
	nodes: Array<TNode | null> | null;
};
type GitHubGraphQLPullSearchNode = {
	__typename: "PullRequest";
	databaseId: number | null;
	number: number;
	title: string;
	state: string;
	isDraft: boolean;
	createdAt: string;
	updatedAt: string;
	closedAt: string | null;
	mergedAt: string | null;
	url: string;
	additions: number;
	deletions: number;
	comments: {
		totalCount: number;
	};
	author: GitHubGraphQLActor;
	labels: {
		nodes: Array<GitHubGraphQLLabel | null> | null;
	} | null;
	repository: GitHubGraphQLRepositoryRef;
};
type GitHubGraphQLIssueSearchNode = {
	__typename: "Issue";
	databaseId: number | null;
	number: number;
	title: string;
	state: string;
	stateReason: string | null;
	createdAt: string;
	updatedAt: string;
	closedAt: string | null;
	url: string;
	comments: {
		totalCount: number;
	};
	author: GitHubGraphQLActor;
	labels: {
		nodes: Array<GitHubGraphQLLabel | null> | null;
	} | null;
	repository: GitHubGraphQLRepositoryRef;
};
const MY_SEARCH_BUCKET_LIMIT = 30;
const MY_SEARCH_SOURCE_TIMEOUT_MS = 8_000;
const MY_SEARCH_TOTAL_TIMEOUT_MS = 18_000;

function mapGraphQLPullSearchNode(
	node: GitHubGraphQLPullSearchNode | null,
): PullSummary | null {
	if (!node || node.__typename !== "PullRequest" || node.databaseId == null) {
		return null;
	}

	return {
		id: node.databaseId,
		number: node.number,
		title: node.title,
		state: node.state.toLowerCase(),
		isDraft: node.isDraft,
		createdAt: node.createdAt,
		updatedAt: node.updatedAt,
		closedAt: node.closedAt,
		mergedAt: node.mergedAt,
		additions: node.additions,
		deletions: node.deletions,
		comments: node.comments.totalCount,
		url: node.url,
		author: mapGraphQLActor(node.author),
		labels: mapGraphQLLabels(node.labels),
		repository: mapGraphQLRepositoryRef(node.repository),
	};
}

function mapGraphQLIssueSearchNode(
	node: GitHubGraphQLIssueSearchNode | null,
): IssueSummary | null {
	if (!node || node.__typename !== "Issue" || node.databaseId == null) {
		return null;
	}

	return {
		id: node.databaseId,
		number: node.number,
		title: node.title,
		state: node.state.toLowerCase(),
		stateReason: node.stateReason?.toLowerCase() ?? null,
		createdAt: node.createdAt,
		updatedAt: node.updatedAt,
		closedAt: node.closedAt,
		comments: node.comments.totalCount,
		url: node.url,
		author: mapGraphQLActor(node.author),
		labels: mapGraphQLLabels(node.labels),
		repository: mapGraphQLRepositoryRef(node.repository),
	};
}

/**
 * Persist orgs that returned an OAuth restriction so the OAuth fallback can
 * skip them on future fetches (see `getMySearchSources`). Awaited inline —
 * the worker is configured with `no_handle_cross_request_promise_resolution`
 * so a fire-and-forget write would race the response and get cancelled.
 * Errors are swallowed: this is best-effort optimization, not correctness.
 */
async function persistForbiddenOrgs(userId: string, orgs: string[]) {
	try {
		const { recordForbiddenOrgs } = await import("../forbidden-orgs-store");
		await recordForbiddenOrgs(userId, orgs);
	} catch (error) {
		console.error("[github-search] failed to persist forbidden orgs", error);
	}
}

function extractForbiddenOrg(error: unknown): string | null {
	const message = error instanceof Error ? error.message : String(error ?? "");
	if (
		!message.includes("OAuth App access restrictions") &&
		!message.includes("FORBIDDEN")
	) {
		return null;
	}
	const match = message.match(/the `([^`]+)` organization/);
	return match?.[1] ?? null;
}

export function buildUserSearchQuery({
	itemType,
	role,
	state,
	username,
	owner,
	ownerType,
	repo,
	excludeOwners,
}: {
	itemType: "issue" | "pr";
	role: IssueSearchRole | PullSearchRole;
	state: RepoState;
	username: string;
	owner?: string;
	ownerType?: GitHubInstallationTargetType;
	repo?: string;
	excludeOwners?: GitHubSearchOwnerScope[];
}) {
	const stateFilter = state === "all" ? "" : ` is:${state}`;
	const scopeFilter =
		owner && repo
			? ` repo:${owner}/${repo}`
			: owner
				? ` ${buildOwnerSearchQualifier({ login: owner, targetType: ownerType })}`
				: "";
	const roleFilter =
		role === "all"
			? ` involves:${username}`
			: role === "assigned"
				? ` assignee:${username}`
				: role === "mentioned"
					? ` mentions:${username}`
					: role === "review-requested"
						? ` user-review-requested:${username}`
						: role === "involved"
							? ` involves:${username}`
							: ` author:${username}`;
	const exclusionFilter =
		excludeOwners
			?.map((scope) => ` -${buildOwnerSearchQualifier(scope)}`)
			.join("") ?? "";

	return `is:${itemType}${stateFilter}${scopeFilter}${roleFilter}${exclusionFilter} archived:false`;
}

function buildOwnerSearchQualifier(scope: {
	login: string;
	targetType?: GitHubInstallationTargetType;
}) {
	const qualifier = scope.targetType === "Organization" ? "org" : "user";
	return `${qualifier}:${scope.login}`;
}

type GraphQLMyPullsResponse = {
	reviewRequested: GitHubGraphQLSearchConnection<GitHubGraphQLPullSearchNode>;
	assigned: GitHubGraphQLSearchConnection<GitHubGraphQLPullSearchNode>;
	authored: GitHubGraphQLSearchConnection<GitHubGraphQLPullSearchNode>;
	mentioned: GitHubGraphQLSearchConnection<GitHubGraphQLPullSearchNode>;
	involved: GitHubGraphQLSearchConnection<GitHubGraphQLPullSearchNode>;
	rateLimit: GitHubGraphQLRateLimit;
};

type GraphQLMyIssuesResponse = {
	assigned: GitHubGraphQLSearchConnection<GitHubGraphQLIssueSearchNode>;
	authored: GitHubGraphQLSearchConnection<GitHubGraphQLIssueSearchNode>;
	mentioned: GitHubGraphQLSearchConnection<GitHubGraphQLIssueSearchNode>;
	rateLimit: GitHubGraphQLRateLimit;
};

function mapGraphQLPullSearchConnection(
	connection: GitHubGraphQLSearchConnection<GitHubGraphQLPullSearchNode>,
) {
	return (connection.nodes ?? [])
		.map((node) => mapGraphQLPullSearchNode(node))
		.filter((item): item is PullSummary => Boolean(item));
}

function mapGraphQLIssueSearchConnection(
	connection: GitHubGraphQLSearchConnection<GitHubGraphQLIssueSearchNode>,
) {
	return (connection.nodes ?? [])
		.map((node) => mapGraphQLIssueSearchNode(node))
		.filter((item): item is IssueSummary => Boolean(item));
}

function ownerScopeKey(scope: GitHubSearchOwnerScope) {
	return `${scope.targetType}:${normalizeLogin(scope.login)}`;
}

function toSearchOwnerScope(
	installation: GitHubAppInstallation,
): GitHubSearchOwnerScope | null {
	if (
		installation.suspendedAt ||
		(installation.targetType !== "Organization" &&
			installation.targetType !== "User")
	) {
		return null;
	}

	return {
		login: installation.account.login,
		targetType: installation.targetType,
	};
}

function addExcludedOwnerScope(
	excludedOwners: Map<string, GitHubSearchOwnerScope>,
	scope: GitHubSearchOwnerScope,
) {
	excludedOwners.set(ownerScopeKey(scope), scope);
}

async function getMySearchSources(
	context: GitHubContext,
	viewerLogin: string,
	deadlineAt: number,
): Promise<GitHubGraphQLSearchSource[]> {
	let installations: GitHubAppInstallation[] = [];
	try {
		const installationResult = await withGitHubOperationTimeout(
			"github search source discovery",
			getRemainingSearchTimeoutMs(deadlineAt, MY_SEARCH_SOURCE_TIMEOUT_MS),
			() => getGitHubAppUserInstallations(context.session.user.id),
		);
		installations = installationResult.installations;
	} catch (error) {
		console.error("[github-search] failed to discover search sources", error);
	}

	const sources: GitHubGraphQLSearchSource[] = [];
	const excludedOAuthOwners = new Map<string, GitHubSearchOwnerScope>();

	for (const installation of installations) {
		const owner = toSearchOwnerScope(installation);
		if (!owner) {
			continue;
		}

		const contextTimeoutMs = getRemainingSearchTimeoutMs(
			deadlineAt,
			MY_SEARCH_SOURCE_TIMEOUT_MS,
		);
		if (contextTimeoutMs < GITHUB_MIN_OPERATION_TIMEOUT_MS) {
			debug("github-search", "skipping remaining installations, deadline low", {
				remainingMs: contextTimeoutMs,
			});
			break;
		}

		const installationContext = await withGitHubOperationTimeout(
			`github installation context ${installation.id}`,
			contextTimeoutMs,
			() => getGitHubContextForInstallation(context, installation),
		).catch((error) => {
			console.error(
				"[github-search] failed to create installation source",
				installation.account.login,
				error,
			);
			return null;
		});
		if (!installationContext) {
			continue;
		}

		if (owner.targetType === "Organization") {
			addExcludedOwnerScope(excludedOAuthOwners, owner);
		}
		if (
			owner.targetType === "User" &&
			installation.repositorySelection === "all" &&
			normalizeLogin(owner.login) === normalizeLogin(viewerLogin)
		) {
			addExcludedOwnerScope(excludedOAuthOwners, owner);
		}

		sources.push({
			label: `installation:${installation.id}:${owner.login}`,
			context: installationContext,
			owner,
		});
	}

	// Seed the OAuth fallback's exclusion list with orgs we already know are
	// blocked by an OAuth App restriction. Without this we'd re-issue the same
	// failing search on every reload — surfacing the "restricted third-party
	// access" warning and burning per-source timeout budget.
	//
	// Self-heal: if the user has now installed the app on an org that was
	// previously forbidden, drop the persisted entry so we treat it normally
	// going forward.
	const installedOrgKeys = new Set(
		installations.map((installation) =>
			normalizeLogin(installation.account.login),
		),
	);
	try {
		const { getForbiddenOrgsForUser, clearForbiddenOrgsForUser } = await import(
			"../forbidden-orgs-store"
		);
		const knownForbiddenOrgs = await getForbiddenOrgsForUser(
			context.session.user.id,
		);
		const stillForbidden: string[] = [];
		const recovered: string[] = [];
		for (const org of knownForbiddenOrgs) {
			if (installedOrgKeys.has(normalizeLogin(org))) {
				recovered.push(org);
			} else {
				stillForbidden.push(org);
			}
		}
		if (recovered.length > 0) {
			try {
				await clearForbiddenOrgsForUser(context.session.user.id, recovered);
			} catch (error) {
				console.error(
					"[github-search] failed to clear recovered forbidden orgs",
					error,
				);
			}
		}
		for (const org of stillForbidden) {
			addExcludedOwnerScope(excludedOAuthOwners, {
				login: org,
				targetType: "Organization",
			});
		}
	} catch (error) {
		console.error("[github-search] failed to load known forbidden orgs", error);
	}

	sources.push({
		label: "oauth:fallback",
		context,
		excludeOwners: [...excludedOAuthOwners.values()],
	});

	return sources;
}

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

function buildSourceSearchQuery({
	itemType,
	role,
	source,
	username,
}: {
	itemType: "issue" | "pr";
	role: IssueSearchRole | PullSearchRole;
	source: GitHubGraphQLSearchSource;
	username: string;
}) {
	return buildUserSearchQuery({
		itemType,
		role,
		state: "open",
		username,
		owner: source.owner?.login,
		ownerType: source.owner?.targetType,
		excludeOwners: source.excludeOwners,
	});
}

export async function getMyPullsResult({
	context,
	username,
}: {
	context: GitHubContext;
	username: string;
}) {
	return dedupeGitHubRead<MyPullsResult>({
		userId: context.session.user.id,
		resource: "pulls.mine.graphql.v2",
		params: { username },
		fetcher: async () => {
			const deadlineAt = Date.now() + MY_SEARCH_TOTAL_TIMEOUT_MS;
			const sources = await getMySearchSources(context, username, deadlineAt);
			const results: MyPullsResult[] = [];
			const forbiddenOrgs: string[] = [];
			let timedOut = false;

			for (const source of sources) {
				const sourceTimeoutMs = getRemainingSearchTimeoutMs(
					deadlineAt,
					MY_SEARCH_SOURCE_TIMEOUT_MS,
				);
				if (sourceTimeoutMs < GITHUB_MIN_OPERATION_TIMEOUT_MS) {
					debug("github-search", "stopping pull search, deadline low", {
						remainingMs: sourceTimeoutMs,
					});
					break;
				}

				try {
					const response = await withGitHubOperationTimeout(
						`github pull search ${source.label}`,
						sourceTimeoutMs,
						(signal) =>
							source.context.octokit.graphql<GraphQLMyPullsResponse>(
								`query(
								$reviewRequestedQuery: String!
								$assignedQuery: String!
								$authoredQuery: String!
								$mentionedQuery: String!
								$involvedQuery: String!
							) {
								reviewRequested: search(type: ISSUE, first: 30, query: $reviewRequestedQuery) {
									nodes { ...PullSearchFields }
								}
								assigned: search(type: ISSUE, first: 30, query: $assignedQuery) {
									nodes { ...PullSearchFields }
								}
								authored: search(type: ISSUE, first: 30, query: $authoredQuery) {
									nodes { ...PullSearchFields }
								}
								mentioned: search(type: ISSUE, first: 30, query: $mentionedQuery) {
									nodes { ...PullSearchFields }
								}
								involved: search(type: ISSUE, first: 30, query: $involvedQuery) {
									nodes { ...PullSearchFields }
								}
								rateLimit {
									cost
									remaining
									resetAt
								}
							}

							fragment PullSearchFields on PullRequest {
								__typename
								databaseId
								number
								title
								state
								isDraft
								createdAt
								updatedAt
								closedAt
								mergedAt
								url
								additions
								deletions
								comments {
									totalCount
								}
								author {
									__typename
									login
									avatarUrl
									url
								}
								labels(first: 20) {
									nodes {
										name
										color
										description
									}
								}
								repository {
									name
									nameWithOwner
									url
									isPrivate
									owner {
										login
										avatarUrl(size: 32)
									}
								}
							}`,
								{
									reviewRequestedQuery: buildSourceSearchQuery({
										itemType: "pr",
										role: "review-requested",
										source,
										username,
									}),
									assignedQuery: buildSourceSearchQuery({
										itemType: "pr",
										role: "assigned",
										source,
										username,
									}),
									authoredQuery: buildSourceSearchQuery({
										itemType: "pr",
										role: "author",
										source,
										username,
									}),
									mentionedQuery: buildSourceSearchQuery({
										itemType: "pr",
										role: "mentioned",
										source,
										username,
									}),
									involvedQuery: buildSourceSearchQuery({
										itemType: "pr",
										role: "involved",
										source,
										username,
									}),
									request: { signal },
								},
							),
					);

					results.push({
						reviewRequested: mapGraphQLPullSearchConnection(
							response.reviewRequested,
						),
						assigned: mapGraphQLPullSearchConnection(response.assigned),
						authored: mapGraphQLPullSearchConnection(response.authored),
						mentioned: mapGraphQLPullSearchConnection(response.mentioned),
						involved: mapGraphQLPullSearchConnection(response.involved),
					});
				} catch (error) {
					console.error(
						"[github-search] failed to load pull requests",
						source.label,
						error,
					);
					if (error instanceof GitHubOperationTimeoutError) {
						timedOut = true;
					}
					const org = extractForbiddenOrg(error);
					if (org) forbiddenOrgs.push(org);
				}
			}

			const data = mergeMyPullsResults(results);
			if (forbiddenOrgs.length > 0) {
				const uniqueForbiddenOrgs = [...new Set(forbiddenOrgs)];
				data.forbiddenOrgs = uniqueForbiddenOrgs;
				await persistForbiddenOrgs(
					context.session.user.id,
					uniqueForbiddenOrgs,
				);
			}
			if (results.length < sources.length) {
				data.partial = true;
			}
			if (timedOut) {
				data.timedOut = true;
			}

			return data;
		},
	});
}

export async function getMyIssuesResult({
	context,
	username,
}: {
	context: GitHubContext;
	username: string;
}) {
	return dedupeGitHubRead<MyIssuesResult>({
		userId: context.session.user.id,
		resource: "issues.mine.graphql.v2",
		params: { username },
		fetcher: async () => {
			const deadlineAt = Date.now() + MY_SEARCH_TOTAL_TIMEOUT_MS;
			const sources = await getMySearchSources(context, username, deadlineAt);
			const results: MyIssuesResult[] = [];
			const forbiddenOrgs: string[] = [];
			let timedOut = false;

			for (const source of sources) {
				const sourceTimeoutMs = getRemainingSearchTimeoutMs(
					deadlineAt,
					MY_SEARCH_SOURCE_TIMEOUT_MS,
				);
				if (sourceTimeoutMs < GITHUB_MIN_OPERATION_TIMEOUT_MS) {
					debug("github-search", "stopping issue search, deadline low", {
						remainingMs: sourceTimeoutMs,
					});
					break;
				}

				try {
					const response = await withGitHubOperationTimeout(
						`github issue search ${source.label}`,
						sourceTimeoutMs,
						(signal) =>
							source.context.octokit.graphql<GraphQLMyIssuesResponse>(
								`query(
								$assignedQuery: String!
								$authoredQuery: String!
								$mentionedQuery: String!
							) {
								assigned: search(type: ISSUE, first: 30, query: $assignedQuery) {
									nodes { ...IssueSearchFields }
								}
								authored: search(type: ISSUE, first: 30, query: $authoredQuery) {
									nodes { ...IssueSearchFields }
								}
								mentioned: search(type: ISSUE, first: 30, query: $mentionedQuery) {
									nodes { ...IssueSearchFields }
								}
								rateLimit {
									cost
									remaining
									resetAt
								}
							}

							fragment IssueSearchFields on Issue {
								__typename
								databaseId
								number
								title
								state
								stateReason
								createdAt
								updatedAt
								closedAt
								url
								comments {
									totalCount
								}
								author {
									__typename
									login
									avatarUrl
									url
								}
								labels(first: 20) {
									nodes {
										name
										color
										description
									}
								}
								repository {
									name
									nameWithOwner
									url
									isPrivate
									owner {
										login
										avatarUrl(size: 32)
									}
								}
							}`,
								{
									assignedQuery: buildSourceSearchQuery({
										itemType: "issue",
										role: "assigned",
										source,
										username,
									}),
									authoredQuery: buildSourceSearchQuery({
										itemType: "issue",
										role: "author",
										source,
										username,
									}),
									mentionedQuery: buildSourceSearchQuery({
										itemType: "issue",
										role: "mentioned",
										source,
										username,
									}),
									request: { signal },
								},
							),
					);

					results.push({
						assigned: mapGraphQLIssueSearchConnection(response.assigned),
						authored: mapGraphQLIssueSearchConnection(response.authored),
						mentioned: mapGraphQLIssueSearchConnection(response.mentioned),
					});
				} catch (error) {
					console.error(
						"[github-search] failed to load issues",
						source.label,
						error,
					);
					if (error instanceof GitHubOperationTimeoutError) {
						timedOut = true;
					}
					const org = extractForbiddenOrg(error);
					if (org) forbiddenOrgs.push(org);
				}
			}

			const data = mergeMyIssuesResults(results);
			if (forbiddenOrgs.length > 0) {
				const uniqueForbiddenOrgs = [...new Set(forbiddenOrgs)];
				data.forbiddenOrgs = uniqueForbiddenOrgs;
				await persistForbiddenOrgs(
					context.session.user.id,
					uniqueForbiddenOrgs,
				);
			}
			if (results.length < sources.length) {
				data.partial = true;
			}
			if (timedOut) {
				data.timedOut = true;
			}

			return data;
		},
	});
}
