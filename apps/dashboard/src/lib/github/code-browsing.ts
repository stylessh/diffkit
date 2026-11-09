import { createServerFn } from "@tanstack/react-start";
import { RequestError } from "octokit";
import { classifyContentsFile } from "../code-browsing/blob-classify";
import {
	type GraphQLBlameResponse,
	mapBlameResponse,
	mapCodeSearchItem,
	type RestCodeSearchItem,
} from "../code-browsing/mappers";
import {
	CODE_SEARCH_PAGE_SIZE,
	type CodeTreeEntry,
	type CodeTreeEntryType,
	type RepoBlame,
	type RepoBlob,
	type RepoCodeInput,
	type RepoCodePathInput,
	type RepoCodeSearch,
	type RepoCodeSearchInput,
	type RepoGitTree,
} from "../code-browsing/types";
import { executeGitHubGraphQL, fetchGitHubResource } from "./client";
import { getGitHubContextForRepository } from "./installations";
import { dedupeGitHubRead } from "./request-dedup";
import type { GitHubClient } from "./shared";
import { identityValidator } from "./validators";

const GIT_TREE_TYPES: Record<string, CodeTreeEntryType> = {
	blob: "file",
	tree: "dir",
	commit: "submodule",
};

function statusOf(error: unknown) {
	return error instanceof RequestError ? error.status : undefined;
}

type GitTreeData = Awaited<
	ReturnType<GitHubClient["rest"]["git"]["getTree"]>
>["data"];

const EMPTY_TREE: RepoGitTree = { sha: null, truncated: false, entries: [] };

export const getRepoGitTree = createServerFn({ method: "GET" })
	.validator(identityValidator<RepoCodeInput>)
	.handler(async ({ data }): Promise<RepoGitTree> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) return EMPTY_TREE;
		try {
			return await fetchGitHubResource<GitTreeData, RepoGitTree>({
				context,
				resource: "code.gitTree.v1",
				params: data,
				request: (signal) =>
					context.octokit.rest.git.getTree({
						owner: data.owner,
						repo: data.repo,
						tree_sha: data.ref,
						recursive: "1",
						request: { signal },
					}),
				mapData: (tree) => ({
					sha: tree.sha,
					truncated: tree.truncated,
					entries: tree.tree.flatMap((item): CodeTreeEntry[] => {
						const type = item.type ? GIT_TREE_TYPES[item.type] : undefined;
						if (!type || !item.path || !item.sha) return [];
						return [
							{ path: item.path, type, sha: item.sha, size: item.size ?? null },
						];
					}),
				}),
			});
		} catch (error) {
			// 409: the repository has no commits yet.
			if (statusOf(error) === 409) return EMPTY_TREE;
			throw error;
		}
	});

type ContentsData = Awaited<
	ReturnType<GitHubClient["rest"]["repos"]["getContent"]>
>["data"];

function mapContents(content: ContentsData, path: string): RepoBlob {
	if (Array.isArray(content)) return { kind: "missing" };
	switch (content.type) {
		case "file":
			return classifyContentsFile({
				path,
				sha: content.sha,
				size: content.size,
				encoding: "encoding" in content ? String(content.encoding) : "none",
				content: "content" in content ? String(content.content) : "",
			});
		case "submodule":
			return { kind: "submodule", sha: content.sha };
		case "symlink":
			return {
				kind: "text",
				sha: content.sha,
				size: content.size,
				text: "target" in content ? String(content.target) : "",
			};
		default:
			return { kind: "missing" };
	}
}

export const getRepoBlob = createServerFn({ method: "GET" })
	.validator(identityValidator<RepoCodePathInput>)
	.handler(async ({ data }): Promise<RepoBlob> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) return { kind: "missing" };
		try {
			return await fetchGitHubResource<ContentsData, RepoBlob>({
				context,
				resource: "code.blob.v1",
				params: data,
				request: (signal) =>
					context.octokit.rest.repos.getContent({
						owner: data.owner,
						repo: data.repo,
						path: data.path,
						ref: data.ref,
						request: { signal },
					}),
				mapData: (content) => mapContents(content, data.path),
			});
		} catch (error) {
			const status = statusOf(error);
			if (status === 404) return { kind: "missing" };
			// 403 `too_large`: files over 100 MB are not served at all.
			if (status === 403 && /too.?large/i.test(String(error))) {
				return { kind: "tooLarge", sha: null, size: null };
			}
			throw error;
		}
	});

const BLAME_QUERY = `query($owner: String!, $repo: String!, $ref: String!, $path: String!) {
	repository(owner: $owner, name: $repo) {
		object(expression: $ref) {
			... on Commit {
				blame(path: $path) {
					ranges {
						startingLine
						endingLine
						age
						commit {
							oid
							abbreviatedOid
							messageHeadline
							committedDate
							author {
								name
								avatarUrl
								user {
									login
									avatarUrl
								}
							}
							parents(first: 1) {
								nodes {
									oid
								}
							}
						}
					}
				}
			}
		}
	}
}`;

export const getRepoBlame = createServerFn({ method: "GET" })
	.validator(identityValidator<RepoCodePathInput>)
	.handler(async ({ data }): Promise<RepoBlame> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) return { status: "missing" };
		return dedupeGitHubRead<RepoBlame>({
			userId: context.session.user.id,
			resource: "code.blame.v1",
			params: data,
			fetcher: async () =>
				mapBlameResponse(
					await executeGitHubGraphQL<GraphQLBlameResponse>(
						context,
						`github blame ${data.owner}/${data.repo}`,
						BLAME_QUERY,
						{
							owner: data.owner,
							repo: data.repo,
							ref: data.ref,
							path: data.path,
						},
					),
				),
		});
	});

type CodeSearchData = {
	total_count: number;
	incomplete_results: boolean;
	items: RestCodeSearchItem[];
};

function rateLimitReset(error: RequestError) {
	const headers = error.response?.headers ?? {};
	const retryAfter = Number(headers["retry-after"]);
	if (Number.isFinite(retryAfter) && retryAfter > 0) {
		return new Date(Date.now() + retryAfter * 1000).toISOString();
	}
	const reset = Number(headers["x-ratelimit-reset"]);
	return Number.isFinite(reset) && reset > 0
		? new Date(reset * 1000).toISOString()
		: null;
}

function isRateLimited(error: RequestError) {
	if (error.status === 429) return true;
	return (
		error.status === 403 &&
		(error.response?.headers?.["x-ratelimit-remaining"] === "0" ||
			/rate limit/i.test(error.message))
	);
}

export const searchRepoCode = createServerFn({ method: "GET" })
	.validator(identityValidator<RepoCodeSearchInput>)
	.handler(async ({ data }): Promise<RepoCodeSearch> => {
		const query = data.query.trim();
		if (!query) return { status: "invalid", message: "Enter a search term." };
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return { status: "invalid", message: "This repository is unavailable." };
		}
		try {
			return await fetchGitHubResource<CodeSearchData, RepoCodeSearch>({
				context,
				resource: "code.search.v1",
				params: data,
				request: (signal) =>
					context.octokit.request("GET /search/code", {
						q: `${query} repo:${data.owner}/${data.repo}`,
						per_page: CODE_SEARCH_PAGE_SIZE,
						page: data.page,
						headers: { accept: "application/vnd.github.text-match+json" },
						request: { signal },
					}) as Promise<{
						data: CodeSearchData;
						status: number;
						headers: Record<string, string>;
					}>,
				mapData: (result) => ({
					status: "ok",
					totalCount: result.total_count,
					incomplete: result.incomplete_results,
					hits: result.items.map(mapCodeSearchItem),
				}),
			});
		} catch (error) {
			if (!(error instanceof RequestError)) throw error;
			if (isRateLimited(error)) {
				return { status: "rateLimited", retryAt: rateLimitReset(error) };
			}
			if (error.status === 422) {
				return { status: "invalid", message: error.message };
			}
			throw error;
		}
	});
