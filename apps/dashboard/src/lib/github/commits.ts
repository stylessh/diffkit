import { createServerFn } from "@tanstack/react-start";
import { RequestError } from "octokit";
import { refPrefixCandidates, splitCommitsSplat } from "../commits-route";
import type {
	PullFile,
	RepoBranchesListInput,
	RepoBranchesListPage,
	RepoBranchListItem,
	RepoCommitDetail,
	RepoCommitInput,
	RepoCommitSummary,
	RepoCommitsInput,
	RepoCommitsPage,
	RepoRefNames,
	RepoRefNamesInput,
	RepoRefSplatInput,
	RepoRefSplatResolution,
	RepoTagListItem,
	RepoTagsListInput,
	RepoTagsListPage,
} from "../github.types";
import { executeGitHubGraphQL, fetchGitHubResource } from "./client";
import { getGitHubContextForRepository } from "./installations";
import { mapActor, mapGraphQLActor } from "./mappers";
import { dedupeGitHubRead } from "./request-dedup";
import {
	clampPage,
	clampPerPage,
	type GitHubApiUser,
	type GitHubContext,
} from "./shared";
import { identityValidator } from "./validators";

async function getRepoCommitResult(
	context: GitHubContext,
	data: RepoCommitInput,
): Promise<RepoCommitDetail> {
	return fetchGitHubResource({
		context,
		resource: "repos.commit",
		params: data,
		request: (signal) =>
			context.octokit.rest.repos.getCommit({
				owner: data.owner,
				repo: data.repo,
				ref: data.sha,
				request: { signal },
			}),
		mapData: (commit) => ({
			sha: commit.sha,
			message: commit.commit.message ?? "",
			date:
				commit.commit.author?.date ??
				commit.commit.committer?.date ??
				new Date().toISOString(),
			author: commit.author
				? {
						login: commit.author.login,
						avatarUrl: commit.author.avatar_url,
						url: commit.author.html_url,
						type: commit.author.type ?? "User",
					}
				: null,
			files: (commit.files ?? []).map((file) => ({
				sha: file.sha,
				filename: file.filename,
				status: file.status as PullFile["status"],
				additions: file.additions,
				deletions: file.deletions,
				changes: file.changes,
				patch: file.patch ?? null,
				previousFilename: file.previous_filename ?? null,
			})),
		}),
	});
}

export const getRepoCommit = createServerFn({ method: "GET" })
	.validator(identityValidator<RepoCommitInput>)
	.handler(async ({ data }): Promise<RepoCommitDetail | null> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return null;
		}

		try {
			return await getRepoCommitResult(context, data);
		} catch (error) {
			if (
				error instanceof RequestError &&
				(error.status === 404 || error.status === 403)
			) {
				return null;
			}
			throw error;
		}
	});

// Rate-limit budget: one GitHub request per page, so cost stays bounded.
//   commits list ......... 1 REST call (1 search call when filtering by message)
//   branches list ........ 1 GraphQL call per 100 branches
//   tags list ............ 1 GraphQL call per 30 tags
//   ref names (pickers) .. 1 REST call (first 100 refs)

type GitHubCommitListItem = {
	sha: string;
	html_url: string;
	author?: GitHubApiUser | null;
	commit: {
		message: string;
		comment_count?: number;
		author?: { name?: string; date?: string } | null;
		committer?: { name?: string; date?: string } | null;
		verification?: { verified?: boolean } | null;
	};
};

function mapRepoCommitSummary(item: GitHubCommitListItem): RepoCommitSummary {
	return {
		sha: item.sha,
		message: item.commit.message ?? "",
		date:
			item.commit.author?.date ??
			item.commit.committer?.date ??
			new Date(0).toISOString(),
		author: mapActor(item.author),
		authorName: item.commit.author?.name ?? null,
		verified: item.commit.verification?.verified === true,
		commentCount: item.commit.comment_count ?? 0,
		url: item.html_url,
	};
}

function emptyRepoCommitsPage(searched = false): RepoCommitsPage {
	return { commits: [], hasNextPage: false, searched };
}

/** GitHub's commit search caps results at 1000. */
const GITHUB_SEARCH_RESULT_LIMIT = 1000;

function buildCommitSearchQuery(data: RepoCommitsInput, query: string) {
	const qualifiers = [`repo:${data.owner}/${data.repo}`];
	const author = data.author?.trim();
	if (author) {
		qualifiers.push(
			author.includes("@") ? `author-email:${author}` : `author:${author}`,
		);
	}
	return `${query} ${qualifiers.join(" ")}`;
}

export const getRepoCommits = createServerFn({ method: "GET" })
	.validator(identityValidator<RepoCommitsInput>)
	.handler(async ({ data }): Promise<RepoCommitsPage> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) return emptyRepoCommitsPage();

		const perPage = clampPerPage(data.perPage, 30);
		const page = clampPage(data.page);
		const ref = data.ref?.trim() || undefined;
		const path = data.path?.trim() || undefined;
		const author = data.author?.trim() || undefined;
		const query = data.query?.trim() || undefined;

		try {
			if (query) {
				const q = buildCommitSearchQuery(data, query);
				return await fetchGitHubResource({
					context,
					resource: "repo.commits.search.v1",
					params: { owner: data.owner, repo: data.repo, q, page, perPage },
					request: (signal) =>
						context.octokit.rest.search.commits({
							q,
							sort: "author-date",
							order: "desc",
							per_page: perPage,
							page,
							request: { signal },
						}),
					mapData: (result): RepoCommitsPage => ({
						commits: result.items.map((item) =>
							mapRepoCommitSummary(item as unknown as GitHubCommitListItem),
						),
						hasNextPage:
							page * perPage <
							Math.min(result.total_count, GITHUB_SEARCH_RESULT_LIMIT),
						searched: true,
					}),
				});
			}

			return await fetchGitHubResource({
				context,
				resource: "repo.commits.v1",
				params: {
					owner: data.owner,
					repo: data.repo,
					ref: ref ?? null,
					path: path ?? null,
					author: author ?? null,
					page,
					perPage,
				},
				request: (signal) =>
					context.octokit.rest.repos.listCommits({
						owner: data.owner,
						repo: data.repo,
						sha: ref,
						path,
						author,
						per_page: perPage,
						page,
						request: { signal },
					}),
				mapData: (items): RepoCommitsPage => ({
					commits: items.map((item) =>
						mapRepoCommitSummary(item as GitHubCommitListItem),
					),
					hasNextPage: items.length === perPage,
					searched: false,
				}),
			});
		} catch (error) {
			// 404: unknown ref/path. 409: empty repository. 422: invalid search.
			if (
				error instanceof RequestError &&
				(error.status === 404 || error.status === 409 || error.status === 422)
			) {
				return emptyRepoCommitsPage(Boolean(query));
			}
			throw error;
		}
	});

export const getRepoRefNames = createServerFn({ method: "GET" })
	.validator(identityValidator<RepoRefNamesInput>)
	.handler(async ({ data }): Promise<RepoRefNames> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) return { names: [], truncated: false };
		const perPage = 100;
		const mapNames = (items: Array<{ name: string }>): RepoRefNames => ({
			names: items.map((item) => item.name),
			truncated: items.length === perPage,
		});

		try {
			if (data.kind === "tags") {
				return await fetchGitHubResource({
					context,
					resource: "repo.refNames.tags.v1",
					params: { owner: data.owner, repo: data.repo },
					request: (signal) =>
						context.octokit.rest.repos.listTags({
							owner: data.owner,
							repo: data.repo,
							per_page: perPage,
							request: { signal },
						}),
					mapData: mapNames,
				});
			}

			return await fetchGitHubResource({
				context,
				resource: "repo.refNames.branches.v1",
				params: { owner: data.owner, repo: data.repo },
				request: (signal) =>
					context.octokit.rest.repos.listBranches({
						owner: data.owner,
						repo: data.repo,
						per_page: perPage,
						request: { signal },
					}),
				mapData: mapNames,
			});
		} catch (error) {
			if (
				error instanceof RequestError &&
				(error.status === 404 || error.status === 409)
			) {
				return { names: [], truncated: false };
			}
			throw error;
		}
	});

type GitHubGraphQLRefCommitTarget = {
	__typename?: string;
	oid?: string;
	committedDate?: string;
	author?: {
		name?: string | null;
		user?: { login: string; avatarUrl: string; url: string } | null;
	} | null;
} | null;

type GitHubGraphQLBranchNode = {
	name: string;
	target: GitHubGraphQLRefCommitTarget;
	associatedPullRequests?: {
		nodes: Array<{
			number: number;
			state: "OPEN" | "CLOSED" | "MERGED";
			isDraft: boolean;
			title: string;
		} | null>;
	} | null;
};

type GitHubGraphQLBranchesResponse = {
	repository: {
		defaultBranchRef: GitHubGraphQLBranchNode | null;
		refs: {
			totalCount: number;
			pageInfo: { hasNextPage: boolean; endCursor: string | null };
			nodes: Array<GitHubGraphQLBranchNode | null>;
		} | null;
	} | null;
};

const BRANCH_NODE_FIELDS = `
	name
	target {
		__typename
		... on Commit {
			oid
			committedDate
			author {
				name
				user { login avatarUrl url }
			}
		}
	}
	associatedPullRequests(first: 1, orderBy: { field: UPDATED_AT, direction: DESC }) {
		nodes { number state isDraft title }
	}
`;

function mapGraphQLBranchNode(
	node: GitHubGraphQLBranchNode,
): RepoBranchListItem {
	const target = node.target;
	const pr = node.associatedPullRequests?.nodes?.[0] ?? null;
	return {
		name: node.name,
		commit: target?.oid
			? {
					sha: target.oid,
					date: target.committedDate ?? null,
					author: mapGraphQLActor(target.author?.user ?? null),
					authorName: target.author?.name ?? null,
				}
			: null,
		pullRequest: pr
			? {
					number: pr.number,
					state: pr.state,
					isDraft: pr.isDraft,
					title: pr.title,
				}
			: null,
	};
}

/** Branches page size. GitHub can't order branches by date, so we load in big pages and sort client-side. */
const REPO_BRANCHES_PAGE_SIZE = 100;
const REPO_TAGS_PAGE_SIZE = 30;

export const getRepoBranchesList = createServerFn({ method: "GET" })
	.validator(identityValidator<RepoBranchesListInput>)
	.handler(async ({ data }): Promise<RepoBranchesListPage> => {
		const empty: RepoBranchesListPage = {
			defaultBranch: null,
			branches: [],
			totalCount: 0,
			endCursor: null,
			hasNextPage: false,
		};
		const context = await getGitHubContextForRepository(data);
		if (!context) return empty;
		const query = data.query?.trim() || null;
		const after = data.after ?? null;

		return dedupeGitHubRead<RepoBranchesListPage>({
			userId: context.session.user.id,
			resource: "repo.branchesList.v1",
			params: { owner: data.owner, repo: data.repo, query, after },
			fetcher: async () => {
				const response =
					await executeGitHubGraphQL<GitHubGraphQLBranchesResponse>(
						context,
						`github repo branches ${data.owner}/${data.repo}`,
						`query($owner: String!, $repo: String!, $first: Int!, $after: String, $refQuery: String) {
							repository(owner: $owner, name: $repo) {
								defaultBranchRef { ${BRANCH_NODE_FIELDS} }
								refs(refPrefix: "refs/heads/", first: $first, after: $after, query: $refQuery) {
									totalCount
									pageInfo { hasNextPage endCursor }
									nodes { ${BRANCH_NODE_FIELDS} }
								}
							}
						}`,
						{
							owner: data.owner,
							repo: data.repo,
							first: REPO_BRANCHES_PAGE_SIZE,
							after,
							refQuery: query,
						},
					);

				const repository = response.repository;
				const refs = repository?.refs;
				return refs
					? {
							defaultBranch: repository?.defaultBranchRef
								? mapGraphQLBranchNode(repository.defaultBranchRef)
								: null,
							branches: refs.nodes
								.filter((node): node is GitHubGraphQLBranchNode =>
									Boolean(node),
								)
								.map(mapGraphQLBranchNode),
							totalCount: refs.totalCount,
							endCursor: refs.pageInfo.endCursor,
							hasNextPage: refs.pageInfo.hasNextPage,
						}
					: empty;
			},
		});
	});

type GitHubGraphQLTagNode = {
	name: string;
	target:
		| (GitHubGraphQLRefCommitTarget & {
				message?: string | null;
				tagger?: {
					date?: string | null;
					name?: string | null;
					user?: { login: string; avatarUrl: string; url: string } | null;
				} | null;
				target?: GitHubGraphQLRefCommitTarget;
		  })
		| null;
};

type GitHubGraphQLTagsResponse = {
	repository: {
		refs: {
			totalCount: number;
			pageInfo: { hasNextPage: boolean; endCursor: string | null };
			nodes: Array<GitHubGraphQLTagNode | null>;
		} | null;
	} | null;
};

function mapGraphQLTagNode(node: GitHubGraphQLTagNode): RepoTagListItem {
	const target = node.target;
	// Annotated tags point at a Tag object which in turn points at the commit.
	if (target?.__typename === "Tag") {
		const commit = target.target;
		return {
			name: node.name,
			commitSha: commit?.oid ?? null,
			date: target.tagger?.date ?? commit?.committedDate ?? null,
			message: target.message?.trim() || null,
			tagger: mapGraphQLActor(target.tagger?.user ?? null),
		};
	}
	return {
		name: node.name,
		commitSha: target?.oid ?? null,
		date: target?.committedDate ?? null,
		message: null,
		tagger: mapGraphQLActor(target?.author?.user ?? null),
	};
}

export const getRepoTagsList = createServerFn({ method: "GET" })
	.validator(identityValidator<RepoTagsListInput>)
	.handler(async ({ data }): Promise<RepoTagsListPage> => {
		const empty: RepoTagsListPage = {
			tags: [],
			totalCount: 0,
			endCursor: null,
			hasNextPage: false,
		};
		const context = await getGitHubContextForRepository(data);
		if (!context) return empty;
		const query = data.query?.trim() || null;
		const after = data.after ?? null;

		return dedupeGitHubRead<RepoTagsListPage>({
			userId: context.session.user.id,
			resource: "repo.tagsList.v1",
			params: { owner: data.owner, repo: data.repo, query, after },
			fetcher: async () => {
				const response = await executeGitHubGraphQL<GitHubGraphQLTagsResponse>(
					context,
					`github repo tags ${data.owner}/${data.repo}`,
					`query($owner: String!, $repo: String!, $first: Int!, $after: String, $refQuery: String) {
						repository(owner: $owner, name: $repo) {
							refs(
								refPrefix: "refs/tags/"
								first: $first
								after: $after
								query: $refQuery
								orderBy: { field: TAG_COMMIT_DATE, direction: DESC }
							) {
								totalCount
								pageInfo { hasNextPage endCursor }
								nodes {
									name
									target {
										__typename
										oid
										... on Commit {
											committedDate
											author { name user { login avatarUrl url } }
										}
										... on Tag {
											message
											tagger { date name user { login avatarUrl url } }
											target {
												__typename
												oid
												... on Commit { committedDate }
											}
										}
									}
								}
							}
						}
					}`,
					{
						owner: data.owner,
						repo: data.repo,
						first: REPO_TAGS_PAGE_SIZE,
						after,
						refQuery: query,
					},
				);

				const refs = response.repository?.refs;
				return refs
					? {
							tags: refs.nodes
								.filter((node): node is GitHubGraphQLTagNode => Boolean(node))
								.map(mapGraphQLTagNode),
							totalCount: refs.totalCount,
							endCursor: refs.pageInfo.endCursor,
							hasNextPage: refs.pageInfo.hasNextPage,
						}
					: empty;
			},
		});
	});

type GitHubGraphQLRefSplatResponse = {
	repository: Record<string, { name: string } | null> | null;
};

/**
 * Resolves a `/commits/$` splat whose ref may contain slashes (`feature/x`,
 * `@scope/pkg@1.0.0`). One GraphQL request checks every prefix as both a
 * branch and a tag; the longest existing prefix wins.
 */
export const resolveRepoRefSplat = createServerFn({ method: "GET" })
	.validator(identityValidator<RepoRefSplatInput>)
	.handler(async ({ data }): Promise<RepoRefSplatResolution> => {
		const candidates = refPrefixCandidates(data.splat);
		const fallback = (): RepoRefSplatResolution => ({
			...splitCommitsSplat(data.splat, null),
			kind: null,
		});
		if (candidates.length <= 1) return fallback();

		const context = await getGitHubContextForRepository(data);
		if (!context) return fallback();
		const variables: Record<string, string> = {
			owner: data.owner,
			repo: data.repo,
		};
		const declarations: string[] = [];
		const fields: string[] = [];
		candidates.forEach((candidate, index) => {
			variables[`h${index}`] = `refs/heads/${candidate}`;
			variables[`t${index}`] = `refs/tags/${candidate}`;
			declarations.push(`$h${index}: String!`, `$t${index}: String!`);
			fields.push(
				`h${index}: ref(qualifiedName: $h${index}) { name }`,
				`t${index}: ref(qualifiedName: $t${index}) { name }`,
			);
		});

		try {
			return await dedupeGitHubRead<RepoRefSplatResolution>({
				userId: context.session.user.id,
				resource: "repo.refSplat.v1",
				params: { owner: data.owner, repo: data.repo, splat: data.splat },
				fetcher: async () => {
					const response =
						await executeGitHubGraphQL<GitHubGraphQLRefSplatResponse>(
							context,
							`github resolve ref ${data.owner}/${data.repo}`,
							`query($owner: String!, $repo: String!, ${declarations.join(", ")}) {
								repository(owner: $owner, name: $repo) { ${fields.join(" ")} }
							}`,
							variables,
						);
					const repository = response.repository ?? {};
					let resolved: RepoRefSplatResolution = fallback();
					for (let index = candidates.length - 1; index >= 0; index--) {
						const kind = repository[`h${index}`]
							? "branch"
							: repository[`t${index}`]
								? "tag"
								: null;
						if (kind) {
							resolved = {
								...splitCommitsSplat(data.splat, candidates[index]),
								kind,
							};
							break;
						}
					}
					return resolved;
				},
			});
		} catch (error) {
			console.error("[resolveRepoRefSplat]", error);
			return fallback();
		}
	});
