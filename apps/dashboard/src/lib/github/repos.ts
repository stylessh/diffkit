import { createServerFn } from "@tanstack/react-start";
import { RequestError } from "octokit";
import { debug } from "../debug";
import type {
	BranchComparison,
	DiscussionsResult,
	PullCommit,
	PullFile,
	RepoBranch,
	RepoContributorsResult,
	RepoOverview,
	RepoParticipationStats,
	RepoViewerPermission,
	UserRepoSummary,
} from "../github.types";
import { isRepoVisibleWithInstallationAccess } from "../github-access";
import { isRecentPush } from "../recent-push";
import {
	filterUserRepoSummaries,
	type ReposHubInput,
	type ReposHubResult,
} from "../repos-hub-filter";
import {
	executeGitHubGraphQL,
	fetchGitHubResource,
	fetchPaginatedGitHubResource,
	getGitHubContext,
	getViewer,
} from "./client";
import {
	getGitHubContextForRepository,
	getGitHubUserContextForRepository,
	getInstallationAccessIndex,
} from "./installations";
import { mapActor, mapGraphQLActor } from "./mappers";
import { dedupeGitHubRead } from "./request-dedup";
import {
	type GitHubClient,
	type GitHubContext,
	type GitHubGraphQLRateLimit,
	type MutationFailure,
	type MutationResult,
	toMutationError,
} from "./shared";
import type { UserProfileInput } from "./users";
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
		parent: {
			nameWithOwner: string;
			owner: {
				avatarUrl: string;
			};
		} | null;
	} | null;
	rateLimit: GitHubGraphQLRateLimit;
};
type AuthenticatedUserRepo = Awaited<
	ReturnType<GitHubClient["rest"]["repos"]["listForAuthenticatedUser"]>
>["data"][number];
type ListForUserRepo = Awaited<
	ReturnType<GitHubClient["rest"]["repos"]["listForUser"]>
>["data"][number];

function mapGithubRestRepoToUserRepoSummary(
	repo: AuthenticatedUserRepo | ListForUserRepo,
): UserRepoSummary {
	const repoId = repo.id;
	if (typeof repoId !== "number") {
		throw new Error("GitHub repository payload missing id");
	}

	const visibility: UserRepoSummary["visibility"] =
		repo.visibility === "internal"
			? "internal"
			: repo.visibility === "private" || repo.private
				? "private"
				: "public";
	return {
		id: repoId,
		name: repo.name ?? "",
		fullName: repo.full_name ?? "",
		description: repo.description ?? null,
		stars: repo.stargazers_count ?? 0,
		forks: repo.forks_count ?? 0,
		language: repo.language ?? null,
		updatedAt: repo.updated_at ?? null,
		createdAt: repo.created_at ?? null,
		isPrivate: Boolean(repo.private),
		visibility,
		url: repo.html_url ?? "",
		owner: repo.owner.login ?? "",
	};
}

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

async function fetchInstallationFilteredAuthenticatedRepos(
	context: GitHubContext,
): Promise<UserRepoSummary[]> {
	const [repos, accessIndex] = await Promise.all([
		fetchPaginatedGitHubResource<AuthenticatedUserRepo, UserRepoSummary[]>({
			context,
			resource: "repos.list",
			params: { sort: "updated", perPage: 100 },
			pageSize: 100,
			request: (page) =>
				context.octokit.rest.repos.listForAuthenticatedUser({
					sort: "updated",
					per_page: 100,
					page,
				}),
			mapData: (items) => items.map(mapGithubRestRepoToUserRepoSummary),
		}),
		getInstallationAccessIndex(context),
	]);

	const filtered = repos.filter((repo) =>
		isRepoVisibleWithInstallationAccess(
			accessIndex,
			repo.owner,
			repo.name,
			repo.isPrivate,
		),
	);

	const removedCount = repos.length - filtered.length;
	if (removedCount > 0) {
		debug(
			"installation-access",
			"fetchInstallationFilteredAuthenticatedRepos",
			{
				total: repos.length,
				kept: filtered.length,
				removed: removedCount,
				removedRepos: repos
					.filter(
						(repo) =>
							!isRepoVisibleWithInstallationAccess(
								accessIndex,
								repo.owner,
								repo.name,
								repo.isPrivate,
							),
					)
					.map((repo) => repo.fullName),
			},
		);
	}

	return filtered;
}

async function fetchPublicReposForUser(
	context: GitHubContext,
	username: string,
): Promise<UserRepoSummary[]> {
	return fetchPaginatedGitHubResource<ListForUserRepo, UserRepoSummary[]>({
		context,
		resource: "repos.listForUser",
		params: { username, sort: "updated", perPage: 100 },
		pageSize: 100,
		request: (page, signal) =>
			context.octokit.rest.repos.listForUser({
				username,
				sort: "updated",
				per_page: 100,
				page,
				request: { signal },
			}),
		mapData: (items) => items.map(mapGithubRestRepoToUserRepoSummary),
	});
}

export const getUserRepos = createServerFn({ method: "GET" }).handler(
	async (): Promise<UserRepoSummary[]> => {
		const context = await getGitHubContext();
		if (!context) {
			return [];
		}
		return fetchInstallationFilteredAuthenticatedRepos(context);
	},
);

export const getReposHub = createServerFn({ method: "GET" })
	.validator(identityValidator<ReposHubInput>)
	.handler(async ({ data }): Promise<ReposHubResult> => {
		const context = await getGitHubContext();
		if (!context) {
			return {
				totals: { all: 0, public: 0, private: 0 },
				matchingCount: 0,
				repos: [],
			};
		}

		const limit = Math.min(Math.max(1, data.limit), 10_000);
		const all = await fetchInstallationFilteredAuthenticatedRepos(context);
		const totals = {
			all: all.length,
			public: all.filter((r) => !r.isPrivate).length,
			private: all.filter((r) => r.isPrivate).length,
		};
		const filtered = filterUserRepoSummaries(all, {
			searchQuery: data.searchQuery,
			visibility: data.visibility,
			sortId: data.sortId,
		});

		return {
			totals,
			matchingCount: filtered.length,
			repos: filtered.slice(0, limit),
		};
	});

export const getProfileRepos = createServerFn({ method: "GET" })
	.validator(identityValidator<UserProfileInput>)
	.handler(async ({ data }): Promise<UserRepoSummary[]> => {
		const context = await getGitHubContext();
		if (!context) {
			return [];
		}

		const viewer = await getViewer(context);
		const isOwnProfile =
			viewer.login.toLowerCase() === data.username.toLowerCase();

		if (isOwnProfile) {
			return fetchInstallationFilteredAuthenticatedRepos(context);
		}

		try {
			return await fetchPublicReposForUser(context, data.username);
		} catch (error) {
			if (error instanceof RequestError && error.status === 404) {
				return [];
			}
			throw error;
		}
	});

export type SetRepoStarredInput = {
	owner: string;
	repo: string;
	starred: boolean;
};

export const setRepoStarred = createServerFn({ method: "POST" })
	.validator(identityValidator<SetRepoStarredInput>)
	.handler(async ({ data }): Promise<MutationResult> => {
		const target = `${data.owner}/${data.repo}`;
		debug("github-star", "setRepoStarred called", {
			target,
			starred: data.starred,
		});
		console.info("[github-star] request", {
			target,
			starred: data.starred,
		});

		const context = await getGitHubUserContextForRepository(data);
		if (!context) {
			debug("github-star", "no GitHub user context (OAuth token?)", {
				target,
			});
			console.warn("[github-star] aborted: no user context", { target });
			return { ok: false, error: "Not authenticated" };
		}

		try {
			debug("github-star", "calling GitHub activity API", {
				target,
				action: data.starred ? "star" : "unstar",
			});
			console.info("[github-star] calling octokit.rest.activity", {
				target,
				action: data.starred
					? "starRepoForAuthenticatedUser"
					: "unstarRepoForAuthenticatedUser",
			});

			if (data.starred) {
				await context.octokit.rest.activity.starRepoForAuthenticatedUser({
					owner: data.owner,
					repo: data.repo,
				});
			} else {
				await context.octokit.rest.activity.unstarRepoForAuthenticatedUser({
					owner: data.owner,
					repo: data.repo,
				});
			}

			debug("github-star", "success", { target });
			console.info("[github-star] ok", { target, starred: data.starred });

			return { ok: true };
		} catch (error) {
			const errMeta =
				error instanceof RequestError
					? {
							status: error.status,
							message: error.message,
							request: error.request?.url,
						}
					: { message: error instanceof Error ? error.message : String(error) };
			debug("github-star", "GitHub API error", {
				target,
				...errMeta,
			});
			console.error("[github-star] GitHub API error", {
				target,
				starred: data.starred,
				...errMeta,
			});
			return toMutationError(
				data.starred ? "star repository" : "unstar repository",
				error,
			);
		}
	});

export type ForkRepoInput = {
	owner: string;
	repo: string;
};

export type ForkRepoResult =
	| { ok: true; forkOwner: string; forkName: string; htmlUrl: string }
	| MutationFailure;

export const forkRepository = createServerFn({ method: "POST" })
	.validator(identityValidator<ForkRepoInput>)
	.handler(async ({ data }): Promise<ForkRepoResult> => {
		const context = await getGitHubUserContextForRepository(data);
		if (!context) {
			return { ok: false, error: "Not authenticated" };
		}

		try {
			const response = await context.octokit.rest.repos.createFork({
				owner: data.owner,
				repo: data.repo,
			});

			return {
				ok: true,
				forkOwner: response.data.owner.login,
				forkName: response.data.name,
				htmlUrl: response.data.html_url,
			};
		} catch (error) {
			return toMutationError("fork repository", error);
		}
	});

type RepoOverviewInput = {
	owner: string;
	repo: string;
};

export const getRepoParticipationStats = createServerFn({ method: "GET" })
	.validator(identityValidator<RepoOverviewInput>)
	.handler(async ({ data }): Promise<RepoParticipationStats> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return { weeklyCommits: [] };
		}

		return dedupeGitHubRead<RepoParticipationStats>({
			userId: context.session.user.id,
			resource: "repos.participationStats",
			params: data,
			fetcher: async () => {
				const maxAttempts = 6;
				const retryDelayMs = 1_500;

				for (let attempt = 0; attempt < maxAttempts; attempt++) {
					try {
						const response =
							await context.octokit.rest.repos.getParticipationStats({
								owner: data.owner,
								repo: data.repo,
							});

						const weeklyCommits = Array.isArray(response.data?.all)
							? response.data.all
							: [];

						return { weeklyCommits };
					} catch (error) {
						if (error instanceof RequestError && error.status === 202) {
							if (attempt < maxAttempts - 1) {
								await new Promise((resolve) =>
									setTimeout(resolve, retryDelayMs),
								);
								continue;
							}
							throw error;
						}

						if (error instanceof RequestError) {
							if (error.status === 404 || error.status === 403) {
								return { weeklyCommits: [] };
							}
						}

						throw error;
					}
				}

				throw new Error("participation stats: exhausted 202 retries");
			},
		});
	});

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
				const response =
					await executeGitHubGraphQL<GitHubGraphQLRepoOverviewResponse>(
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
					);

				if (!response.repository) {
					throw new Error(
						`GitHub repository not found: ${data.owner}/${data.repo}`,
					);
				}

				const overview = mapGraphQLRepoOverview(response.repository);
				overview.viewerHasStarred = await resolveViewerHasStarredForRepo(data);

				return overview;
			},
		});
	});

type RepoDiscussionsInput = {
	owner: string;
	repo: string;
	first?: number;
};

type GraphQLDiscussionsResponse = {
	repository: {
		discussions: {
			totalCount: number;
			nodes: Array<{
				number: number;
				title: string;
				createdAt: string;
				updatedAt: string;
				author: { login: string; avatarUrl: string } | null;
				category: { name: string; emojiHTML: string } | null;
				comments: { totalCount: number };
				answerChosenAt: string | null;
				url: string;
			}>;
		};
	};
};

export const getRepoDiscussions = createServerFn({ method: "GET" })
	.validator(identityValidator<RepoDiscussionsInput>)
	.handler(async ({ data }): Promise<DiscussionsResult> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) return { discussions: [], totalCount: 0 };

		return dedupeGitHubRead<DiscussionsResult>({
			userId: context.session.user.id,
			resource: "repo.discussions.v1",
			params: {
				owner: data.owner,
				repo: data.repo,
				first: data.first ?? 5,
			},
			fetcher: async () => {
				try {
					const response =
						await executeGitHubGraphQL<GraphQLDiscussionsResponse>(
							context,
							`github repo discussions ${data.owner}/${data.repo}`,
							`query($owner: String!, $repo: String!, $first: Int!) {
								repository(owner: $owner, name: $repo) {
									discussions(first: $first, orderBy: { field: UPDATED_AT, direction: DESC }) {
										totalCount
										nodes {
											number
											title
											createdAt
											updatedAt
											author { login avatarUrl }
											category { name emojiHTML }
											comments { totalCount }
											answerChosenAt
											url
										}
									}
								}
							}`,
							{
								owner: data.owner,
								repo: data.repo,
								first: data.first ?? 5,
							},
						);

					return {
						totalCount: response.repository.discussions.totalCount,
						discussions: response.repository.discussions.nodes.map((d) => ({
							number: d.number,
							title: d.title,
							createdAt: d.createdAt,
							updatedAt: d.updatedAt,
							author: d.author,
							category: d.category?.name ?? null,
							comments: d.comments.totalCount,
							isAnswered: d.answerChosenAt !== null,
							url: d.url,
						})),
					};
				} catch (error) {
					if (
						error instanceof RequestError &&
						(error.status === 403 || error.status === 429)
					) {
						throw error;
					}

					return { discussions: [], totalCount: 0 };
				}
			},
		});
	});

function parseLinkHeaderLastPage(link: string | undefined): number | null {
	if (!link) return null;
	const match = link.match(/[&?]page=(\d+)[^>]*>;\s*rel="last"/);
	return match ? Number(match[1]) : null;
}

type RepoBranchesInput = {
	owner: string;
	repo: string;
};

export const getRepoBranches = createServerFn({ method: "GET" })
	.validator(identityValidator<RepoBranchesInput>)
	.handler(async ({ data }): Promise<RepoBranch[]> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) return [];

		return fetchGitHubResource<
			Awaited<
				ReturnType<GitHubClient["rest"]["repos"]["listBranches"]>
			>["data"],
			RepoBranch[]
		>({
			context,
			resource: "repo.branches.v1",
			params: data,
			request: () =>
				context.octokit.rest.repos.listBranches({
					owner: data.owner,
					repo: data.repo,
					per_page: 25,
				}),
			mapData: (branches) =>
				branches.map((b) => ({
					name: b.name,
					isProtected: b.protected,
				})),
		});
	});

type BranchComparisonInput = {
	owner: string;
	repo: string;
	base: string;
	head: string;
};

export const getBranchComparison = createServerFn({ method: "GET" })
	.validator(identityValidator<BranchComparisonInput>)
	.handler(async ({ data }): Promise<BranchComparison | null> => {
		if (data.base === data.head) return null;
		const context = await getGitHubContextForRepository(data);
		if (!context) return null;

		return fetchGitHubResource<
			Awaited<
				ReturnType<GitHubClient["rest"]["repos"]["compareCommitsWithBasehead"]>
			>["data"],
			BranchComparison
		>({
			context,
			resource: "repo.branchComparison.v1",
			params: data,
			request: () =>
				context.octokit.rest.repos.compareCommitsWithBasehead({
					owner: data.owner,
					repo: data.repo,
					basehead: `${data.base}...${data.head}`,
					per_page: 1,
				}),
			mapData: (comparison) => ({
				aheadBy: comparison.ahead_by,
				behindBy: comparison.behind_by,
				status: comparison.status as BranchComparison["status"],
				totalCommits: comparison.total_commits,
			}),
		}).catch(() => null);
	});

export type RepoTemplateKind = "pr" | "issue";

type RepoTemplateInput = {
	owner: string;
	repo: string;
	kind: RepoTemplateKind;
};

const PR_TEMPLATE_PATHS = [
	".github/pull_request_template.md",
	".github/PULL_REQUEST_TEMPLATE.md",
	"docs/pull_request_template.md",
	"docs/PULL_REQUEST_TEMPLATE.md",
	"pull_request_template.md",
	"PULL_REQUEST_TEMPLATE.md",
];

const ISSUE_TEMPLATE_PATHS = [
	".github/ISSUE_TEMPLATE.md",
	".github/issue_template.md",
	"docs/ISSUE_TEMPLATE.md",
	"docs/issue_template.md",
	"ISSUE_TEMPLATE.md",
	"issue_template.md",
];

type RepoTemplateGraphQLResponse = {
	repository: {
		[alias: string]: { text: string | null } | null;
	} | null;
};

export const getRepoTemplate = createServerFn({ method: "GET" })
	.validator(identityValidator<RepoTemplateInput>)
	.handler(async ({ data }): Promise<string | null> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) return null;

		try {
			return await dedupeGitHubRead<string | null>({
				userId: context.session.user.id,
				resource: `repo.template.${data.kind}.v1`,
				params: data,
				fetcher: async () => {
					const paths =
						data.kind === "pr" ? PR_TEMPLATE_PATHS : ISSUE_TEMPLATE_PATHS;
					const fields = paths
						.map(
							(path, i) =>
								`p${i}: object(expression: "HEAD:${path}") { ... on Blob { text } }`,
						)
						.join("\n");

					const response =
						await executeGitHubGraphQL<RepoTemplateGraphQLResponse>(
							context,
							`github repo template ${data.kind} ${data.owner}/${data.repo}`,
							`query($owner: String!, $repo: String!) {
								repository(owner: $owner, name: $repo) {
									${fields}
								}
							}`,
							{ owner: data.owner, repo: data.repo },
						);

					const repository = response.repository;
					let body: string | null = null;
					if (repository) {
						for (let i = 0; i < paths.length; i++) {
							const entry = repository[`p${i}`];
							const text = entry?.text;
							if (text && text.length > 0) {
								body = text;
								break;
							}
						}
					}

					return body;
				},
			});
		} catch {
			return null;
		}
	});

export type RecentPushableBranch = {
	branch: string;
	pushedAt: string;
	aheadBy: number;
};

type RecentPushableBranchInput = {
	owner: string;
	repo: string;
};

export const getRecentPushableBranch = createServerFn({ method: "GET" })
	.validator(identityValidator<RecentPushableBranchInput>)
	.handler(async ({ data }): Promise<RecentPushableBranch | null> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) return null;

		const userContext = await getGitHubUserContextForRepository(data);
		if (!userContext) return null;

		try {
			return await dedupeGitHubRead<RecentPushableBranch | null>({
				userId: context.session.user.id,
				resource: "repo.recentPushableBranch.v1",
				params: data,
				fetcher: async () => {
					const viewer = await getViewer(userContext);
					if (!viewer.login) {
						return null;
					}

					const overview = await context.octokit.rest.repos.get({
						owner: data.owner,
						repo: data.repo,
					});
					const defaultBranch = overview.data.default_branch;
					if (!defaultBranch) {
						return null;
					}

					const activities =
						await userContext.octokit.rest.repos.listActivities({
							owner: data.owner,
							repo: data.repo,
							actor: viewer.login,
							activity_type: "push",
							time_period: "day",
							per_page: 10,
						});

					const seen = new Set<string>();
					for (const activity of activities.data) {
						const ref = activity.ref;
						if (!ref.startsWith("refs/heads/")) continue;
						const branch = ref.slice("refs/heads/".length);
						if (branch === defaultBranch) continue;
						if (!isRecentPush(activity.timestamp)) continue;
						if (seen.has(branch)) continue;
						seen.add(branch);

						const existingPrs = await context.octokit.rest.pulls.list({
							owner: data.owner,
							repo: data.repo,
							head: `${data.owner}:${branch}`,
							state: "open",
							per_page: 1,
						});
						if (existingPrs.data.length > 0) continue;

						const comparison =
							await context.octokit.rest.repos.compareCommitsWithBasehead({
								owner: data.owner,
								repo: data.repo,
								basehead: `${defaultBranch}...${branch}`,
								per_page: 1,
							});
						if (comparison.data.ahead_by === 0) continue;

						return {
							branch,
							pushedAt: activity.timestamp,
							aheadBy: comparison.data.ahead_by,
						};
					}

					return null;
				},
			});
		} catch {
			return null;
		}
	});

export type CompareDetail = {
	aheadBy: number;
	behindBy: number;
	status: "ahead" | "behind" | "diverged" | "identical";
	totalCommits: number;
	/** The commit the head is diffed against; moves when the base advances. */
	mergeBaseSha: string;
	commits: PullCommit[];
	files: PullFile[];
	/** True when the file list hit GitHub's 300-file cap for this endpoint. */
	filesTruncated: boolean;
};

const COMPARE_COMMITS_MAX_PAGES = 3;
const COMPARE_COMMITS_PER_PAGE = 100;
const COMPARE_FILES_CAP = 300;

export const getCompareDetail = createServerFn({ method: "GET" })
	.validator(identityValidator<BranchComparisonInput>)
	.handler(async ({ data }): Promise<CompareDetail | null> => {
		if (data.base === data.head) return null;
		const context = await getGitHubContextForRepository(data);
		if (!context) return null;

		try {
			return await dedupeGitHubRead<CompareDetail>({
				userId: context.session.user.id,
				resource: "repo.compareDetail.v3",
				params: data,
				fetcher: async () => {
					const first =
						await context.octokit.rest.repos.compareCommitsWithBasehead({
							owner: data.owner,
							repo: data.repo,
							basehead: `${data.base}...${data.head}`,
							per_page: COMPARE_COMMITS_PER_PAGE,
							page: 1,
						});

					const commitsRaw: (typeof first.data.commits)[number][] = [
						...first.data.commits,
					];
					const totalCommits = first.data.total_commits;

					// Paginate additional commit pages — compareCommitsWithBasehead
					// returns files only on page 1, so we only collect commits here.
					for (let page = 2; page <= COMPARE_COMMITS_MAX_PAGES; page++) {
						if (commitsRaw.length >= totalCommits) break;
						const next =
							await context.octokit.rest.repos.compareCommitsWithBasehead({
								owner: data.owner,
								repo: data.repo,
								basehead: `${data.base}...${data.head}`,
								per_page: COMPARE_COMMITS_PER_PAGE,
								page,
							});
						if (next.data.commits.length === 0) break;
						commitsRaw.push(...next.data.commits);
					}

					const files = first.data.files ?? [];
					const filesTruncated = files.length >= COMPARE_FILES_CAP;
					if (filesTruncated) {
						console.warn(
							`[compare detail] file list truncated at ${COMPARE_FILES_CAP} for ${data.owner}/${data.repo} ${data.base}...${data.head}`,
						);
					}

					return {
						aheadBy: first.data.ahead_by,
						behindBy: first.data.behind_by,
						status: first.data.status as CompareDetail["status"],
						totalCommits,
						mergeBaseSha: first.data.merge_base_commit.sha,
						commits: commitsRaw.map((c) => ({
							sha: c.sha,
							message: c.commit.message,
							createdAt:
								c.commit.committer?.date ?? c.commit.author?.date ?? "",
							author: mapActor(c.author),
						})),
						files: files.map((f) => ({
							sha: f.sha ?? null,
							filename: f.filename,
							status: f.status as PullFile["status"],
							additions: f.additions,
							deletions: f.deletions,
							changes: f.changes,
							patch: f.patch ?? null,
							previousFilename: f.previous_filename ?? null,
						})),
						filesTruncated,
					};
				},
			});
		} catch {
			return null;
		}
	});

type RepoContributorsInput = {
	owner: string;
	repo: string;
};

export const getRepoContributors = createServerFn({ method: "GET" })
	.validator(identityValidator<RepoContributorsInput>)
	.handler(async ({ data }): Promise<RepoContributorsResult> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) return { contributors: [], totalCount: 0 };

		return dedupeGitHubRead<RepoContributorsResult>({
			userId: context.session.user.id,
			resource: "repo.contributors.v1",
			params: data,
			fetcher: async () => {
				const response = await context.octokit.rest.repos.listContributors({
					owner: data.owner,
					repo: data.repo,
					per_page: 30,
					anon: "false",
				});
				const totalCount =
					parseLinkHeaderLastPage(
						response.headers.link as string | undefined,
					) ?? response.data.length;

				return {
					contributors: response.data
						.filter((c): c is typeof c & { login: string } => !!c.login)
						.map((c) => ({
							login: c.login,
							avatarUrl: c.avatar_url ?? "",
							contributions: c.contributions ?? 0,
						})),
					totalCount,
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
