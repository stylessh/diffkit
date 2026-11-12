import { createServerFn } from "@tanstack/react-start";
import { RequestError } from "octokit";
import { debug } from "../debug";
import type { RepoOverview, RepoViewerPermission } from "../github.types";
import { executeGitHubGraphQL } from "./client";
import {
	getGitHubContextForRepository,
	getGitHubUserContextForRepository,
} from "./installations";
import { mapGraphQLActor } from "./mappers";
import { dedupeGitHubRead } from "./request-dedup";
import type { GitHubGraphQLRateLimit } from "./shared";
import { identityValidator } from "./validators";

type GitHubGraphQLRepoOverviewResponse = {
	repository: {
		databaseId: number | null;
		name: string;
		nameWithOwner: string;
		description: string | null;
		isPrivate: boolean;
		isFork: boolean;
		defaultBranchRef: {
			name: string;
			target: {
				__typename: string;
				oid?: string;
				message?: string;
				committedDate?: string;
				author?: {
					user?: {
						login: string;
						avatarUrl: string;
						url: string;
					} | null;
				} | null;
			} | null;
		} | null;
		stargazerCount: number;
		forkCount: number;
		watchers: {
			totalCount: number;
		};
		primaryLanguage: {
			name: string;
		} | null;
		licenseInfo: {
			spdxId: string | null;
		} | null;
		repositoryTopics: {
			nodes: Array<{
				topic: {
					name: string;
				};
			} | null> | null;
		};
		url: string;
		owner: {
			login: string;
			avatarUrl: string;
		};
		branches: {
			totalCount: number;
		};
		tags: {
			totalCount: number;
		};
		pullRequests: {
			totalCount: number;
		};
		issues: {
			totalCount: number;
		};
		hasDiscussionsEnabled: boolean;
		productMap: { oid: string } | null;
		parent: {
			nameWithOwner: string;
			owner: {
				avatarUrl: string;
			};
		} | null;
	} | null;
	rateLimit: GitHubGraphQLRateLimit;
};

function mapGraphQLRepoOverview(
	repository: NonNullable<GitHubGraphQLRepoOverviewResponse["repository"]>,
): RepoOverview {
	const latestCommitTarget = repository.defaultBranchRef?.target;
	const latestCommit =
		latestCommitTarget?.__typename === "Commit" && latestCommitTarget.oid
			? {
					sha: latestCommitTarget.oid,
					message: latestCommitTarget.message ?? "",
					date: latestCommitTarget.committedDate ?? "",
					author: mapGraphQLActor(
						latestCommitTarget.author?.user
							? {
									...latestCommitTarget.author.user,
									__typename: "User",
								}
							: null,
					),
				}
			: null;

	return {
		id: repository.databaseId ?? 0,
		name: repository.name,
		fullName: repository.nameWithOwner,
		description: repository.description,
		isPrivate: repository.isPrivate,
		isFork: repository.isFork,
		viewerHasStarred: false,
		defaultBranch: repository.defaultBranchRef?.name ?? "main",
		stars: repository.stargazerCount,
		forks: repository.forkCount,
		watchers: repository.watchers.totalCount,
		language: repository.primaryLanguage?.name ?? null,
		license: repository.licenseInfo?.spdxId ?? null,
		topics: (repository.repositoryTopics.nodes ?? []).flatMap((node) =>
			node ? [node.topic.name] : [],
		),
		url: repository.url,
		owner: repository.owner.login,
		ownerAvatarUrl: repository.owner.avatarUrl,
		branchCount: repository.branches.totalCount,
		tagCount: repository.tags.totalCount,
		openPullCount: repository.pullRequests.totalCount,
		openIssueCount: repository.issues.totalCount,
		hasDiscussions: repository.hasDiscussionsEnabled,
		hasProductMap: repository.productMap !== null,
		forkParentFullName: repository.parent?.nameWithOwner ?? null,
		forkParentOwnerAvatarUrl: repository.parent?.owner.avatarUrl ?? null,
		latestCommit,
	};
}

/**
 * `viewerHasStarred` on the main repo overview query is wrong when that query runs
 * with an **installation** token. We resolve it separately using the **user** client
 * (OAuth or user-to-server) so it reflects the signed-in account.
 *
 * Note: `GET /user/starred/{owner}/{repo}` can incorrectly 404 for some GitHub App
 * user tokens even when the repo is starred; GraphQL `repository.viewerHasStarred`
 * with the same user client matches what the star/unstar REST calls use.
 */
async function resolveViewerHasStarredForRepo(data: {
	owner: string;
	repo: string;
}): Promise<boolean> {
	const userContext = await getGitHubUserContextForRepository(data);
	if (!userContext) {
		debug("github-star", "resolveViewerHasStarred: no user context", {
			repo: `${data.owner}/${data.repo}`,
		});
		return false;
	}

	try {
		const response = await executeGitHubGraphQL<{
			repository: { viewerHasStarred: boolean } | null;
		}>(
			userContext,
			`github repo viewerHasStarred ${data.owner}/${data.repo}`,
			`query($owner: String!, $name: String!) {
				repository(owner: $owner, name: $name) {
					viewerHasStarred
				}
			}`,
			{ owner: data.owner, name: data.repo },
		);
		return response.repository?.viewerHasStarred ?? false;
	} catch (error) {
		debug("github-star", "resolveViewerHasStarred: GraphQL failed", {
			repo: `${data.owner}/${data.repo}`,
			status: error instanceof RequestError ? error.status : undefined,
		});
		return false;
	}
}

type RepoOverviewInput = {
	owner: string;
	repo: string;
};

export const getRepoOverview = createServerFn({ method: "GET" })
	.validator(identityValidator<RepoOverviewInput>)
	.handler(async ({ data }): Promise<RepoOverview | null> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) return null;

		return dedupeGitHubRead<RepoOverview>({
			userId: context.session.user.id,
			resource: "repo.overview.v2",
			params: data,
			fetcher: async () => {
				const [response, viewerHasStarred] = await Promise.all([
					executeGitHubGraphQL<GitHubGraphQLRepoOverviewResponse>(
						context,
						`github repo overview ${data.owner}/${data.repo}`,
						`query($owner: String!, $repo: String!) {
							repository(owner: $owner, name: $repo) {
								databaseId
								name
								nameWithOwner
								description
								isPrivate
								isFork
								defaultBranchRef {
									name
									target {
										__typename
										... on Commit {
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
								stargazerCount
								forkCount
								watchers(first: 1) {
									totalCount
								}
								primaryLanguage {
									name
								}
								licenseInfo {
									spdxId
								}
								repositoryTopics(first: 20) {
									nodes {
										topic {
											name
										}
									}
								}
								url
								owner {
									login
									avatarUrl
								}
								branches: refs(refPrefix: "refs/heads/", first: 1) {
									totalCount
								}
								tags: refs(refPrefix: "refs/tags/", first: 1) {
									totalCount
								}
								pullRequests(states: OPEN, first: 1) {
									totalCount
								}
								issues(states: OPEN, first: 1) {
									totalCount
								}
								hasDiscussionsEnabled
								productMap: object(expression: "HEAD:.diffkit/map.json") {
									oid
								}
								parent {
									nameWithOwner
									owner {
										avatarUrl
									}
								}
							}
							rateLimit {
								cost
								remaining
								resetAt
							}
						}`,
						{
							owner: data.owner,
							repo: data.repo,
						},
					),
					resolveViewerHasStarredForRepo(data),
				]);

				if (!response.repository) {
					throw new Error(
						`GitHub repository not found: ${data.owner}/${data.repo}`,
					);
				}

				return {
					...mapGraphQLRepoOverview(response.repository),
					viewerHasStarred,
				};
			},
		});
	});

type GitHubGraphQLViewerPermissionResponse = {
	repository: { viewerPermission: RepoViewerPermission["permission"] } | null;
};

export const getRepoViewerPermission = createServerFn({ method: "GET" })
	.validator(identityValidator<{ owner: string; repo: string }>)
	.handler(async ({ data }): Promise<RepoViewerPermission> => {
		const unknown: RepoViewerPermission = { permission: null, canPush: false };
		// User token (not the installation token) so the answer reflects the viewer.
		const context = await getGitHubUserContextForRepository(data);
		if (!context) return unknown;
		try {
			return await dedupeGitHubRead<RepoViewerPermission>({
				userId: context.session.user.id,
				resource: "repo.viewerPermission.v1",
				params: { owner: data.owner, repo: data.repo },
				fetcher: async () => {
					const response =
						await executeGitHubGraphQL<GitHubGraphQLViewerPermissionResponse>(
							context,
							`github repo viewer permission ${data.owner}/${data.repo}`,
							`query($owner: String!, $repo: String!) {
								repository(owner: $owner, name: $repo) { viewerPermission }
							}`,
							{ owner: data.owner, repo: data.repo },
						);
					const permission = response.repository?.viewerPermission ?? null;
					return {
						permission,
						canPush:
							permission === "ADMIN" ||
							permission === "MAINTAIN" ||
							permission === "WRITE",
					};
				},
			});
		} catch (error) {
			console.error("[getRepoViewerPermission]", error);
			return unknown;
		}
	});
