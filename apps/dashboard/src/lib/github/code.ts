import { createServerFn } from "@tanstack/react-start";
import type { FileLastCommit, RepoTreeEntry } from "../github.types";
import { executeGitHubGraphQL, fetchGitHubResource } from "./client";
import { getGitHubContextForRepository } from "./installations";
import { dedupeGitHubRead } from "./request-dedup";
import type { GitHubClient, GitHubGraphQLRateLimit } from "./shared";
import { identityValidator } from "./validators";

type RepoTreeInput = {
	owner: string;
	repo: string;
	ref: string;
	path: string;
};

export const getRepoTree = createServerFn({ method: "GET" })
	.validator(identityValidator<RepoTreeInput>)
	.handler(async ({ data }): Promise<RepoTreeEntry[]> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) return [];

		return fetchGitHubResource<
			Awaited<ReturnType<GitHubClient["rest"]["repos"]["getContent"]>>["data"],
			RepoTreeEntry[]
		>({
			context,
			resource: "repo.tree.v1",
			params: data,
			request: () =>
				context.octokit.rest.repos.getContent({
					owner: data.owner,
					repo: data.repo,
					path: data.path,
					ref: data.ref,
				}),
			mapData: (content) => {
				if (!Array.isArray(content)) return [];

				const entries: RepoTreeEntry[] = content.map((item) => ({
					name: item.name,
					type:
						item.type === "dir"
							? "dir"
							: item.type === "submodule"
								? "submodule"
								: "file",
					path: item.path,
					sha: item.sha,
					size: item.size ?? null,
					lastCommit: null,
				}));

				entries.sort((a, b) => {
					if (a.type === "dir" && b.type !== "dir") return -1;
					if (a.type !== "dir" && b.type === "dir") return 1;
					return a.name.localeCompare(b.name);
				});

				return entries;
			},
		});
	});

type FileLastCommitInput = {
	owner: string;
	repo: string;
	path: string;
	ref: string;
};

export const getFileLastCommit = createServerFn({ method: "GET" })
	.validator(identityValidator<FileLastCommitInput>)
	.handler(async ({ data }): Promise<FileLastCommit | null> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) return null;

		return fetchGitHubResource<
			Awaited<ReturnType<GitHubClient["rest"]["repos"]["listCommits"]>>["data"],
			FileLastCommit | null
		>({
			context,
			resource: "repo.fileLastCommit.v1",
			params: data,
			request: () =>
				context.octokit.rest.repos.listCommits({
					owner: data.owner,
					repo: data.repo,
					sha: data.ref,
					path: data.path,
					per_page: 1,
				}),
			mapData: (commits) => {
				const commit = commits[0];
				if (!commit) return null;
				return {
					sha: commit.sha,
					message: commit.commit.message,
					date:
						commit.commit.committer?.date ?? commit.commit.author?.date ?? "",
					author: commit.author
						? {
								login: commit.author.login,
								avatarUrl: commit.author.avatar_url,
								url: commit.author.html_url,
								type: commit.author.type,
							}
						: null,
				};
			},
		}).catch(() => null);
	});

type RefHeadCommitInput = {
	owner: string;
	repo: string;
	ref: string;
};

export const getRefHeadCommit = createServerFn({ method: "GET" })
	.validator(identityValidator<RefHeadCommitInput>)
	.handler(async ({ data }): Promise<FileLastCommit | null> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) return null;

		return fetchGitHubResource<
			Awaited<ReturnType<GitHubClient["rest"]["repos"]["listCommits"]>>["data"],
			FileLastCommit | null
		>({
			context,
			resource: "repo.refHeadCommit.v1",
			params: data,
			request: () =>
				context.octokit.rest.repos.listCommits({
					owner: data.owner,
					repo: data.repo,
					sha: data.ref,
					per_page: 1,
				}),
			mapData: (commits) => {
				const commit = commits[0];
				if (!commit) return null;
				return {
					sha: commit.sha,
					message: commit.commit.message,
					date:
						commit.commit.committer?.date ?? commit.commit.author?.date ?? "",
					author: commit.author
						? {
								login: commit.author.login,
								avatarUrl: commit.author.avatar_url,
								url: commit.author.html_url,
								type: commit.author.type,
							}
						: null,
				};
			},
		}).catch(() => null);
	});

type TreeEntryCommitsInput = {
	owner: string;
	repo: string;
	ref: string;
	/** Empty string for the repository root. */
	dirPath: string;
	entries: string[];
};

type TreeEntryCommitsResult = Record<string, FileLastCommit | null>;

export const getTreeEntryCommits = createServerFn({ method: "GET" })
	.validator(identityValidator<TreeEntryCommitsInput>)
	.handler(async ({ data }): Promise<TreeEntryCommitsResult> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) return {};

		return dedupeGitHubRead<TreeEntryCommitsResult>({
			userId: context.session.user.id,
			resource: "repo.treeEntryCommits.v1",
			params: {
				owner: data.owner,
				repo: data.repo,
				ref: data.ref,
				dirPath: data.dirPath,
			},
			fetcher: async () => {
				const aliases = data.entries.map((name, i) => {
					const entryPath = data.dirPath ? `${data.dirPath}/${name}` : name;
					return `e${i}: history(first: 1, path: ${JSON.stringify(entryPath)}) {
						nodes {
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
					}`;
				});

				const query = `query($owner: String!, $repo: String!, $ref: String!) {
					repository(owner: $owner, name: $repo) {
						object(expression: $ref) {
							... on Commit {
								${aliases.join("\n")}
							}
						}
					}
					rateLimit { cost remaining resetAt }
				}`;

				const response = await executeGitHubGraphQL<{
					repository: {
						object: Record<
							string,
							{
								nodes: Array<{
									oid: string;
									message: string;
									committedDate: string;
									author: {
										user: {
											login: string;
											avatarUrl: string;
											url: string;
										} | null;
									} | null;
								}>;
							}
						> | null;
					} | null;
					rateLimit: GitHubGraphQLRateLimit | null;
				}>(
					context,
					`github tree entry commits ${data.owner}/${data.repo}`,
					query,
					{
						owner: data.owner,
						repo: data.repo,
						ref: data.ref,
					},
				);

				const commitObj = response.repository?.object;
				const result: TreeEntryCommitsResult = {};

				for (let i = 0; i < data.entries.length; i++) {
					const alias = `e${i}`;
					const node = commitObj?.[alias]?.nodes?.[0];
					const name = data.entries[i];
					if (!name) continue;
					if (!node) {
						result[name] = null;
						continue;
					}
					const user = node.author?.user;
					result[name] = {
						sha: node.oid,
						message: node.message,
						date: node.committedDate,
						author: user
							? {
									login: user.login,
									avatarUrl: user.avatarUrl,
									url: user.url,
									type: "User",
								}
							: null,
					};
				}

				return result;
			},
		});
	});
