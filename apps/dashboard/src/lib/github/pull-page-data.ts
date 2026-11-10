import type {
	GitHubActor,
	PullCommit,
	PullDetail,
	PullPageData,
	RequestedTeam,
} from "../github.types";
import { executeGitHubGraphQL, getViewer } from "./client";
import { getGitHubUserContextForRepository } from "./installations";
import {
	buildCommentReactionSummary,
	buildRepositoryRef,
	mapGraphQLActor,
	mapGraphQLComments,
	mapGraphQLLabels,
	mapGraphQLRepositoryRef,
} from "./mappers";
import { getPullCommitsResult, getRawPull, mapPullDetail } from "./pull-reads";
import { dedupeGitHubRead } from "./request-dedup";
import type {
	GitHubContext,
	GitHubGraphQLActor,
	GitHubGraphQLCommentConnection,
	GitHubGraphQLLabel,
	GitHubGraphQLRateLimit,
	GitHubGraphQLRepositoryRef,
	PullFromRepoInput,
} from "./shared";
import {
	COMMENTS_PER_PAGE,
	deriveHeadRefDeleted,
	getCommentsPageResult,
	getLoadedCommentPages,
	getTimelineEventsResult,
} from "./timeline";

type GitHubGraphQLReviewRequestNode = {
	requestedReviewer:
		| ({
				__typename: "User";
				login: string;
				avatarUrl: string;
				url: string;
		  } & Record<string, unknown>)
		| {
				__typename: "Team";
				name: string;
				slug: string;
				url: string;
		  }
		| null;
};
type GitHubGraphQLPullPageResponse = {
	repository: {
		pullRequest: {
			id: string;
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
			body: string;
			reactions: {
				nodes: Array<{
					content: string;
					user: { login: string } | null;
				} | null> | null;
			} | null;
			additions: number;
			deletions: number;
			changedFiles: number;
			comments: { totalCount: number };
			author: GitHubGraphQLActor;
			labels: {
				nodes: Array<GitHubGraphQLLabel | null> | null;
			} | null;
			headRefName: string;
			headRefOid: string;
			headRepositoryOwner: { login: string } | null;
			baseRefName: string;
			merged: boolean;
			mergeCommit: { oid: string } | null;
			mergedBy: GitHubGraphQLActor;
			mergeable: string;
			mergeStateStatus: string;
			repository: GitHubGraphQLRepositoryRef;
			reviewThreads: { totalCount: number };
			reviewRequests: {
				nodes: Array<GitHubGraphQLReviewRequestNode | null> | null;
			} | null;
			commits: {
				totalCount: number;
				nodes: Array<{
					commit: {
						oid: string;
						message: string;
						committedDate: string;
						author: {
							user?: {
								login: string;
								avatarUrl: string;
								url: string;
							} | null;
						} | null;
					};
				} | null> | null;
			};
			firstComments: GitHubGraphQLCommentConnection;
			lastComments: GitHubGraphQLCommentConnection;
		} | null;
	};
	rateLimit: GitHubGraphQLRateLimit;
};

const PULL_PAGE_QUERY = `query($owner: String!, $repo: String!, $number: Int!) {
	repository(owner: $owner, name: $repo) {
		pullRequest(number: $number) {
			id
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
			body
			reactions(first: 100) {
				nodes { content user { login } }
			}
			additions
			deletions
			changedFiles
			comments { totalCount }
			author { __typename login avatarUrl url }
			labels(first: 20) {
				nodes { name color description }
			}
			headRefName
			headRefOid
			headRepositoryOwner { login }
			baseRefName
			merged
			mergeCommit { oid }
			mergedBy { __typename login avatarUrl url }
			mergeable
			mergeStateStatus
			repository {
				name
				nameWithOwner
				url
				isPrivate
				owner { login }
			}
			reviewThreads(first: 1) { totalCount }
			reviewRequests(first: 100) {
				nodes {
					requestedReviewer {
						__typename
						... on User {
							login
							avatarUrl
							url
						}
						... on Team {
							name
							slug
							url
						}
					}
				}
			}
			commits(first: 100) {
				totalCount
				nodes {
					commit {
						oid
						message
						committedDate
						author {
							user {
								login
								avatarUrl
								url
							}
						}
					}
				}
			}
			firstComments: comments(first: 30) {
				totalCount
				nodes {
					id
					databaseId
					body
					createdAt
					lastEditedAt
					author { __typename login avatarUrl url }
					reactions(first: 100) {
						nodes { content user { login } }
					}
				}
			}
			lastComments: comments(last: 30) {
				totalCount
				nodes {
					id
					databaseId
					body
					createdAt
					lastEditedAt
					author { __typename login avatarUrl url }
					reactions(first: 100) {
						nodes { content user { login } }
					}
				}
			}
		}
	}
	rateLimit {
		cost
		remaining
		resetAt
	}
}`;

function mapGraphQLPullDetail(
	pull: NonNullable<GitHubGraphQLPullPageResponse["repository"]["pullRequest"]>,
	viewerLogin: string | undefined,
): PullDetail {
	const requestedReviewers: GitHubActor[] = [];
	const requestedTeams: RequestedTeam[] = [];

	for (const node of pull.reviewRequests?.nodes ?? []) {
		const reviewer = node?.requestedReviewer;
		if (!reviewer) {
			continue;
		}

		if (reviewer.__typename === "Team") {
			requestedTeams.push({
				slug: reviewer.slug,
				name: reviewer.name,
				url: reviewer.url,
			});
			continue;
		}

		const actor = mapGraphQLActor(reviewer);
		if (actor) {
			requestedReviewers.push(actor);
		}
	}

	return {
		id: pull.databaseId ?? 0,
		graphqlId: pull.id,
		number: pull.number,
		title: pull.title,
		state: pull.state.toLowerCase(),
		isDraft: pull.isDraft,
		createdAt: pull.createdAt,
		updatedAt: pull.updatedAt,
		closedAt: pull.closedAt,
		mergedAt: pull.mergedAt,
		comments: pull.comments.totalCount,
		url: pull.url,
		author: mapGraphQLActor(pull.author),
		labels: mapGraphQLLabels(pull.labels),
		repository: mapGraphQLRepositoryRef(pull.repository),
		reactions: buildCommentReactionSummary(
			pull.reactions?.nodes ?? undefined,
			viewerLogin,
		),
		body: pull.body,
		additions: pull.additions,
		deletions: pull.deletions,
		changedFiles: pull.changedFiles,
		commits: pull.commits.totalCount,
		reviewComments: pull.reviewThreads.totalCount,
		headRefName: pull.headRefName,
		headSha: pull.headRefOid,
		headRepoOwner: pull.headRepositoryOwner?.login ?? null,
		baseRefName: pull.baseRefName,
		isMerged: pull.merged,
		mergeCommitSha: pull.mergeCommit?.oid ?? null,
		mergedBy: mapGraphQLActor(pull.mergedBy),
		mergeable:
			pull.mergeable === "MERGEABLE"
				? true
				: pull.mergeable === "CONFLICTING"
					? false
					: null,
		mergeableState: pull.mergeStateStatus?.toLowerCase() ?? null,
		requestedReviewers,
		requestedTeams,
	};
}

function mapGraphQLPullCommits(
	pull: NonNullable<GitHubGraphQLPullPageResponse["repository"]["pullRequest"]>,
): PullCommit[] {
	return (pull.commits.nodes ?? []).flatMap((node) => {
		if (!node) {
			return [];
		}

		return [
			{
				sha: node.commit.oid,
				message: node.commit.message,
				createdAt: node.commit.committedDate,
				author: mapGraphQLActor(
					node.commit.author?.user
						? {
								...node.commit.author.user,
								__typename: "User",
							}
						: null,
				),
			},
		];
	});
}

async function getPullPageDataViaGraphQL(
	context: GitHubContext,
	data: PullFromRepoInput,
): Promise<PullPageData> {
	return dedupeGitHubRead<PullPageData>({
		userId: context.session.user.id,
		resource: "pulls.pageData.graphql.v2",
		params: data,
		fetcher: async () => {
			const viewerPromise = getGitHubUserContextForRepository({
				owner: data.owner,
				repo: data.repo,
			}).then((userCtx) => (userCtx ? getViewer(userCtx) : null));

			const [response, timelineResult, viewer] = await Promise.all([
				executeGitHubGraphQL<GitHubGraphQLPullPageResponse>(
					context,
					`github pull page ${data.owner}/${data.repo}#${data.pullNumber}`,
					PULL_PAGE_QUERY,
					{
						owner: data.owner,
						repo: data.repo,
						number: data.pullNumber,
					},
				),
				getTimelineEventsResult(context, {
					owner: data.owner,
					repo: data.repo,
					issueNumber: data.pullNumber,
				}),
				viewerPromise,
			]);

			const pull = response.repository.pullRequest;
			if (!pull) {
				throw new Error(
					`Pull request not found: ${data.owner}/${data.repo}#${data.pullNumber}`,
				);
			}

			const totalComments = pull.comments.totalCount;
			const loadedPages = getLoadedCommentPages(totalComments);
			const detail = mapGraphQLPullDetail(pull, viewer?.login);
			const events = timelineResult.events;

			return {
				detail,
				comments: mapGraphQLComments(
					viewer?.login,
					pull.firstComments,
					pull.lastComments,
				),
				commits: mapGraphQLPullCommits(pull),
				events,
				commentPagination: {
					totalCount: totalComments,
					perPage: COMMENTS_PER_PAGE,
					loadedPages,
				},
				eventPagination: {
					loadedPages: [1],
					hasMore: timelineResult.hasMore,
				},
				headRefDeleted: deriveHeadRefDeleted(events),
			};
		},
	});
}

async function getPullPageDataViaRest(
	context: GitHubContext,
	data: PullFromRepoInput,
): Promise<PullPageData> {
	const pull = await getRawPull(context, data);

	const totalComments = pull.comments ?? 0;
	const totalPages = Math.max(1, Math.ceil(totalComments / COMMENTS_PER_PAGE));
	const issueData = {
		owner: data.owner,
		repo: data.repo,
		issueNumber: data.pullNumber,
	};

	const pagesToFetch = totalPages === 1 ? [1] : [1, totalPages];

	const [commentsPages, commits, timelineResult] = await Promise.all([
		Promise.all(
			pagesToFetch.map((p) =>
				getCommentsPageResult(context, { ...issueData, page: p }),
			),
		),
		getPullCommitsResult(context, data),
		getTimelineEventsResult(context, issueData),
	]);

	const allComments = commentsPages.flatMap((p) => p.comments);

	return {
		detail: mapPullDetail(pull, buildRepositoryRef(data.owner, data.repo)),
		comments: allComments,
		commits,
		events: timelineResult.events,
		commentPagination: {
			totalCount: totalComments,
			perPage: COMMENTS_PER_PAGE,
			loadedPages: pagesToFetch,
		},
		eventPagination: {
			loadedPages: [1],
			hasMore: timelineResult.hasMore,
		},
		headRefDeleted: deriveHeadRefDeleted(timelineResult.events),
	};
}

export async function getPullPageDataResult(
	context: GitHubContext,
	data: PullFromRepoInput,
): Promise<PullPageData> {
	try {
		return await getPullPageDataViaGraphQL(context, data);
	} catch (error) {
		console.error("[pull-page:gql] failed, falling back to REST", error);
		return getPullPageDataViaRest(context, data);
	}
}
